import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveChromePath } from "./chrome.js";
import { runCommand, type CommandResult } from "./commands.js";

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

  const frameCount = Math.max(1, Math.round(request.durationSec * request.fps));
  const captureResult = await captureFrames({
    chromePath,
    entryFile: request.entryFile,
    frameDir,
    width: request.width,
    height: request.height,
    fps: request.fps,
    frameCount,
    logLabel: request.logLabel,
    extraQuery: request.extraQuery ?? {}
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

  const ffmpegResult = await runCommand("ffmpeg", [
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
}

async function captureFrames(params: {
  chromePath: string;
  entryFile: string;
  frameDir: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  logLabel: string;
  extraQuery: Record<string, string>;
}): Promise<{ ok: boolean; log: string }> {
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "michibiki-chrome-"));
  const entryUrl = pathToFileURL(params.entryFile);
  const logLines: string[] = [
    `Capturing ${params.frameCount} ${params.logLabel} frames at ${params.width}x${params.height} ${params.fps}fps`,
    `Chrome: ${params.chromePath}`
  ];

  try {
    for (let frame = 0; frame < params.frameCount; frame += 1) {
      const framePath = path.join(params.frameDir, `${String(frame).padStart(6, "0")}.png`);
      const frameUrl = new URL(entryUrl.href);
      frameUrl.searchParams.set("frame", String(frame));
      frameUrl.searchParams.set("fps", String(params.fps));
      for (const [key, value] of Object.entries(params.extraQuery)) {
        frameUrl.searchParams.set(key, value);
      }

      const result = await runCommand(
        params.chromePath,
        [
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--allow-file-access-from-files",
          `--user-data-dir=${profileDir}`,
          `--window-size=${params.width},${params.height}`,
          "--force-device-scale-factor=1",
          "--virtual-time-budget=250",
          `--screenshot=${framePath}`,
          frameUrl.href
        ],
        { detached: true, timeoutMs: 10000 }
      );

      appendCommandLog(logLines, result);

      if (result.code !== 0 || !existsSync(framePath)) {
        logLines.push(`Frame capture failed at frame ${frame}.`);
        return { ok: false, log: logLines.join("\n") };
      }
    }

    return { ok: true, log: logLines.join("\n") };
  } finally {
    await fs.rm(profileDir, { recursive: true, force: true });
  }
}

function appendCommandLog(logLines: string[], result: CommandResult): void {
  logLines.push(`$ ${result.command}`);
  if (result.stdout.trim()) logLines.push(result.stdout);
  if (result.stderr.trim()) logLines.push(result.stderr);
}

