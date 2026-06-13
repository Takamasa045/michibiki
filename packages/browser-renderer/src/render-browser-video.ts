import { createReadStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { resolveChromePath } from "./chrome.js";
import {
  runCommand,
  type CommandResult,
  type CommandRunner
} from "./commands.js";

export type { CommandRunner } from "./commands.js";

export type BrowserRenderRequest = {
  entryFile: string;
  renderDir: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  logLabel: string;
  extraQuery?: Record<string, string>;
  chromePath?: string;
  commandRunner?: CommandRunner;
};

export type BrowserRenderResult = {
  ok: boolean;
  outputPath: string;
  frameDir: string;
  command?: string;
  log: string;
  error?: string;
};

export async function renderBrowserVideo(
  request: BrowserRenderRequest
): Promise<BrowserRenderResult> {
  const frameDir = path.join(request.renderDir, "frames");
  const outputPath = path.join(request.renderDir, "output.mp4");
  const commandRunner = request.commandRunner ?? runCommand;
  await fs.mkdir(request.renderDir, { recursive: true });
  await fs.rm(frameDir, { recursive: true, force: true });
  await fs.mkdir(frameDir, { recursive: true });

  const chromePath = request.chromePath ?? resolveChromePath();
  if (!chromePath) {
    return {
      ok: false,
      outputPath,
      frameDir,
      log:
        "Google Chrome or Chromium was not found. Set VIDEO_ROUTER_CHROME to a Chrome-compatible executable.\n",
      error:
        "Google Chrome or Chromium was not found. Set VIDEO_ROUTER_CHROME to a Chrome-compatible executable."
    };
  }

  const entryFile = await fs.realpath(request.entryFile);
  const server = await createStaticFileServer(path.dirname(entryFile));
  try {
    const frameCount = Math.max(1, Math.round(request.durationSec * request.fps));
    const captureResult = await captureFrames({
      chromePath,
      entryUrl: server.urlForFile(entryFile),
      frameDir,
      width: request.width,
      height: request.height,
      fps: request.fps,
      frameCount,
      logLabel: request.logLabel,
      extraQuery: request.extraQuery ?? {},
      commandRunner
    });

    if (!captureResult.ok) {
      return {
        ok: false,
        outputPath,
        frameDir,
        log: captureResult.log,
        error: `${request.logLabel} frame capture failed.`
      };
    }

    const ffmpegResult = await commandRunner("ffmpeg", [
      "-y",
      "-framerate",
      String(request.fps),
      "-i",
      path.join(frameDir, "%06d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-movflags",
      "+faststart",
      outputPath
    ]);
    const log = [
      captureResult.log,
      `$ ${ffmpegResult.command}`,
      ffmpegResult.stdout,
      ffmpegResult.stderr
    ].join("\n");
    const ok = ffmpegResult.code === 0 && existsSync(outputPath);

    return {
      ok,
      outputPath,
      frameDir,
      command: ffmpegResult.command,
      log,
      error: ok ? undefined : `${request.logLabel} ffmpeg encode failed.`
    };
  } finally {
    await server.close();
  }
}

async function captureFrames(params: {
  chromePath: string;
  entryUrl: string;
  frameDir: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  logLabel: string;
  extraQuery: Record<string, string>;
  commandRunner: CommandRunner;
}): Promise<{ ok: boolean; log: string }> {
  const logLines: string[] = [
    `Capturing ${params.frameCount} ${params.logLabel} frames at ${params.width}x${params.height} ${params.fps}fps`,
    `Chrome: ${params.chromePath}`
  ];

  for (let frame = 0; frame < params.frameCount; frame += 1) {
    const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "michibiki-chrome-frame-"));
    const framePath = path.join(params.frameDir, `${String(frame).padStart(6, "0")}.png`);
    const frameUrl = new URL(params.entryUrl);
    frameUrl.searchParams.set("frame", String(frame));
    frameUrl.searchParams.set("fps", String(params.fps));
    for (const [key, value] of Object.entries(params.extraQuery)) {
      frameUrl.searchParams.set(key, value);
    }

    try {
      const result = await params.commandRunner(
        params.chromePath,
        [
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-application-cache",
          "--aggressive-cache-discard",
          "--disk-cache-size=1",
          "--media-cache-size=1",
          `--user-data-dir=${profileDir}`,
          `--window-size=${params.width},${params.height}`,
          "--force-device-scale-factor=1",
          "--virtual-time-budget=250",
          `--screenshot=${framePath}`,
          frameUrl.href
        ],
        { detached: true, timeoutMs: 10000, successFile: framePath }
      );

      appendCommandLog(logLines, result);

      if (result.code !== 0 || !existsSync(framePath)) {
        logLines.push(`Frame capture failed at frame ${frame}.`);
        return { ok: false, log: logLines.join("\n") };
      }
    } finally {
      await fs.rm(profileDir, { recursive: true, force: true });
    }
  }

  return { ok: true, log: logLines.join("\n") };
}

function appendCommandLog(logLines: string[], result: CommandResult): void {
  logLines.push(`$ ${result.command}`);
  if (result.stdout.trim()) logLines.push(result.stdout);
  if (result.stderr.trim()) logLines.push(result.stderr);
}

async function createStaticFileServer(rootDir: string): Promise<{
  urlForFile: (filePath: string) => string;
  close: () => Promise<void>;
}> {
  const rootPath = await fs.realpath(rootDir);
  const server = http.createServer((request, response) => {
    void serveStaticRequest(rootPath, request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Failed to start local browser render server.");
  }

  const origin = `http://127.0.0.1:${address.port}/`;
  return {
    urlForFile(filePath) {
      const relative = path.relative(rootPath, path.resolve(filePath));
      if (!isPathInside(path.resolve(filePath), rootPath)) {
        throw new Error(`Entry file is outside the render server root: ${filePath}`);
      }

      return new URL(toUrlPath(relative), origin).href;
    },
    close: () => closeServer(server)
  };
}

async function serveStaticRequest(
  rootPath: string,
  request: http.IncomingMessage,
  response: http.ServerResponse
): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requestedPath = decodeURIComponent(requestUrl.pathname);
    const targetPath = path.resolve(rootPath, `.${requestedPath}`);
    if (!isPathInside(targetPath, rootPath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const stat = await fs.stat(targetPath);
    const filePath = stat.isDirectory() ? path.join(targetPath, "index.html") : targetPath;
    const fileStat = await fs.stat(filePath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypeForPath(filePath),
      "Cache-Control": "no-store"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toUrlPath(relativePath: string): string {
  return relativePath
    .split(path.sep)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
