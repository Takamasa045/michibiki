import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderBrowserVideo, resolveChromePath } from "@michibiki/browser-renderer";
import { validateLicense } from "@michibiki/compliance";
import type {
  GeneratedProject,
  GenerateProjectContext,
  PreviewResult,
  RenderContext,
  RenderResult,
  VideoEngine,
  VideoSpec
} from "@michibiki/video-spec";

const require = createRequire(import.meta.url);

export type HyperFramesRenderBackend =
  | "official-cli"
  | "official-producer"
  | "official-engine"
  | "local";

export type HyperFramesRenderQuality = "draft" | "standard" | "high";

export type HyperFramesRenderFormat = "mp4" | "webm" | "mov";

type CommandResult = {
  code: number | null;
  command: string;
  stdout: string;
  stderr: string;
};

type CommandRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  }
) => Promise<CommandResult>;

type ModuleLoader = (specifier: string) => Promise<unknown>;

type HyperFramesRegistryInstallResult = {
  name: string;
  command: string;
  installed: string[];
};

type HtmlInCanvasRegistryBlock = {
  id: string;
  src: string;
  title: string;
  durationSec: number;
  width: number;
  height: number;
};

const HTML_IN_CANVAS_REGISTRY_NAME = "html-in-canvas";
const DEFAULT_RENDER_BACKEND: HyperFramesRenderBackend = "official-cli";

const HTML_IN_CANVAS_REGISTRY_BLOCKS: Record<string, HtmlInCanvasRegistryBlock> =
  {
    "vfx-text-cursor": {
      id: "vfx-text-cursor",
      src: "compositions/vfx-text-cursor.html",
      title: "VFX Text Cursor",
      durationSec: 8,
      width: 1920,
      height: 1080
    },
    "vfx-liquid-background": {
      id: "vfx-liquid-background",
      src: "compositions/vfx-liquid-background.html",
      title: "Liquid Background",
      durationSec: 12,
      width: 1920,
      height: 1080
    },
    "vfx-iphone-device": {
      id: "vfx-iphone-device",
      src: "compositions/vfx-iphone-device.html",
      title: "iPhone & MacBook 3D Showcase",
      durationSec: 15,
      width: 1920,
      height: 1080
    },
    "vfx-magnetic": {
      id: "vfx-magnetic",
      src: "compositions/vfx-magnetic.html",
      title: "Magnetic",
      durationSec: 15,
      width: 1920,
      height: 1080
    },
    "vfx-portal": {
      id: "vfx-portal",
      src: "compositions/vfx-portal.html",
      title: "Portal",
      durationSec: 10,
      width: 1920,
      height: 1080
    },
    "vfx-liquid-glass": {
      id: "vfx-liquid-glass",
      src: "compositions/vfx-liquid-glass.html",
      title: "Liquid Glass",
      durationSec: 20,
      width: 1920,
      height: 1080
    },
    "vfx-shatter": {
      id: "vfx-shatter",
      src: "compositions/vfx-shatter.html",
      title: "Shatter",
      durationSec: 12,
      width: 1920,
      height: 1080
    }
  };

export type HyperFramesEngineOptions = {
  renderBackend?: HyperFramesRenderBackend;
  renderQuality?: HyperFramesRenderQuality;
  renderFormat?: HyperFramesRenderFormat;
  renderWorkers?: number;
  useDocker?: boolean;
  useGpu?: boolean;
  cliPath?: string;
  commandRunner?: CommandRunner;
  moduleLoader?: ModuleLoader;
};

type ResolvedHyperFramesOptions = Required<
  Pick<HyperFramesEngineOptions, "renderQuality">
> &
  Omit<HyperFramesEngineOptions, "renderQuality">;

type HyperFramesProducerModule = {
  createRenderJob: (config: Record<string, unknown>) => unknown;
  executeRenderJob: (
    job: unknown,
    projectDir: string,
    outputPath: string,
    onProgress?: (job: unknown, message: string) => void
  ) => Promise<void>;
  resolveConfig?: (overrides?: Record<string, unknown>) => unknown;
};

type HyperFramesEngineModule = {
  createFileServer: (options: {
    projectDir: string;
    stripEmbeddedRuntime?: boolean;
  }) => Promise<{ url: string; close: () => void }>;
  createCaptureSession: (
    serverUrl: string,
    outputDir: string,
    options: Record<string, unknown>,
    onBeforeCapture?: unknown,
    config?: unknown
  ) => Promise<unknown>;
  initializeSession: (session: unknown) => Promise<void>;
  captureFrame: (
    session: unknown,
    frameIndex: number,
    time: number
  ) => Promise<unknown>;
  closeCaptureSession: (session: unknown) => Promise<void>;
  encodeFramesFromDir: (
    framesDir: string,
    framePattern: string,
    outputPath: string,
    options: Record<string, unknown>,
    signal?: AbortSignal,
    config?: unknown
  ) => Promise<{ success: boolean; error?: string }>;
  getEncoderPreset: (
    quality: HyperFramesRenderQuality,
    format: HyperFramesRenderFormat
  ) => Record<string, unknown>;
  resolveConfig?: (overrides?: Record<string, unknown>) => unknown;
};

export function createHyperFramesEngine(
  options: HyperFramesEngineOptions = {}
): VideoEngine {
  const resolvedOptions: ResolvedHyperFramesOptions = {
    ...options,
    renderQuality: options.renderQuality ?? "standard"
  };

  return {
    name: "hyperframes",
    canHandle: (spec) => canHyperFramesHandle(spec),
    generateProject: (spec, context) =>
      generateHyperFramesProject(spec, context, resolvedOptions),
    preview: (project) =>
      Promise.resolve({
        ok: true,
        projectId: project.id,
        url: path.join(project.rootPath, "index.html"),
        message: "Open index.html in a browser to preview the HyperFrames draft."
      }),
    render: (project, context) =>
      renderHyperFramesProject(project, context, resolvedOptions),
    validateLicense: (context) =>
      Promise.resolve(validateLicense("hyperframes", context))
  };
}

export function canHyperFramesHandle(spec: VideoSpec): boolean {
  const preference = spec.constraints.enginePreference ?? "auto";
  if (preference === "hyperframes") return true;
  if (preference !== "auto") return false;

  return (
    spec.assets.some((asset) => asset.type === "url") ||
    /(webサイト|website|landing page|ランディングページ|\blp\b|dom|html|css|javascript|gsap|scroll|スクロール)/i.test(
      [spec.title, spec.goal, spec.style.motionStyle, spec.style.visualTone].join(" ")
    )
  );
}

async function generateHyperFramesProject(
  spec: VideoSpec,
  context: GenerateProjectContext = {},
  options: ResolvedHyperFramesOptions = {
    renderQuality: "standard"
  }
): Promise<GeneratedProject> {
  const projectId = `project_${randomUUID()}`;
  const projectName = createProjectName(spec);
  const projectRoot = context.outputDir
    ? path.join(context.outputDir, "project", "hyperframes")
    : path.resolve("outputs", "hyperframes", projectName);
  const htmlInCanvasBlock = selectHtmlInCanvasRegistryBlock(spec);

  await fs.mkdir(projectRoot, { recursive: true });

  const files = {
    "video-spec.json": `${JSON.stringify(spec, null, 2)}\n`,
    "index.html": buildHtml(spec),
    "styles.css": buildCss(spec),
    "motion.js": buildMotionJs(spec),
    "README.md": buildReadme(spec, htmlInCanvasBlock)
  };

  for (const [fileName, content] of Object.entries(files)) {
    await fs.writeFile(path.join(projectRoot, fileName), content, "utf8");
  }

  const registryInstalls: HyperFramesRegistryInstallResult[] = [];
  if (htmlInCanvasBlock) {
    registryInstalls.push(
      await installHyperFramesRegistryItem(
        HTML_IN_CANVAS_REGISTRY_NAME,
        projectRoot,
        options
      )
    );
  }

  const manifest = {
    id: projectId,
    engine: "hyperframes",
    projectName,
    projectPath: projectRoot,
    entry: path.join(projectRoot, "index.html"),
    renderStatus: `${options.renderBackend ?? DEFAULT_RENDER_BACKEND}-render-ready`,
    renderBackend: options.renderBackend ?? DEFAULT_RENDER_BACKEND,
    renderQuality: options.renderQuality,
    renderFormat: options.renderFormat ?? inferRenderFormat(spec),
    htmlInCanvasBlock: htmlInCanvasBlock?.id,
    registryInstalls:
      registryInstalls.length > 0 ? registryInstalls : undefined,
    generatedAt: new Date().toISOString()
  };

  if (context.outputDir) {
    await fs.writeFile(
      path.join(context.outputDir, "project", "project.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
  }

  await writeLog(
    context.logDir,
    "generate.log",
    [
      `Generated HyperFrames project at ${projectRoot}`,
      ...registryInstalls.map(
        (install) =>
          `Installed HyperFrames registry item ${install.name}: ${install.installed.join(", ")}`
      )
    ].join("\n") + "\n"
  );

  return {
    id: projectId,
    engine: "hyperframes",
    name: projectName,
    rootPath: projectRoot,
    files: Object.keys(files).map((fileName) => path.join(projectRoot, fileName)),
    metadata: manifest
  };
}

async function renderHyperFramesProject(
  project: GeneratedProject,
  context: RenderContext = {},
  options: ResolvedHyperFramesOptions = {
    renderQuality: "standard"
  }
): Promise<RenderResult> {
  const metadataBackend = parseRenderBackend(project.metadata.renderBackend);
  const backend =
    options.renderBackend ??
    (metadataBackend === "local" ? DEFAULT_RENDER_BACKEND : metadataBackend) ??
    DEFAULT_RENDER_BACKEND;
  if (backend === "official-cli") {
    return renderWithOfficialCli(project, context, options);
  }
  if (backend === "official-producer") {
    return renderWithOfficialProducer(project, context, options);
  }
  if (backend === "official-engine") {
    return renderWithOfficialEngine(project, context, options);
  }

  return renderWithLocalBrowser(project, context);
}

async function renderWithLocalBrowser(
  project: GeneratedProject,
  context: RenderContext = {}
): Promise<RenderResult> {
  const renderDir = context.outputDir
    ? path.join(context.outputDir, "render")
    : path.join(project.rootPath, "render");
  const spec = await readProjectSpec(project.rootPath);

  const renderResult = await renderBrowserVideo({
    entryFile: path.join(project.rootPath, "index.html"),
    renderDir,
    width: spec.format.width,
    height: spec.format.height,
    fps: spec.format.fps,
    durationSec: spec.format.durationSec,
    logLabel: "HyperFrames"
  });
  await writeLog(context.logDir, "render.log", renderResult.log);

  return {
    ok: renderResult.ok,
    projectId: project.id,
    outputPath: renderResult.outputPath,
    command: renderResult.command,
    logs: renderResult.log,
    message: renderResult.ok
      ? "HyperFrames render completed."
      : "HyperFrames render failed. Inspect logs/render.log."
  };
}

async function renderWithOfficialCli(
  project: GeneratedProject,
  context: RenderContext,
  options: ResolvedHyperFramesOptions
): Promise<RenderResult> {
  const renderDir = getRenderDir(project, context);
  const spec = await readProjectSpec(project.rootPath);
  const format = resolveRenderFormat(spec, options);
  const outputPath = path.join(renderDir, `output.${format}`);
  await fs.mkdir(renderDir, { recursive: true });

  const cliPath = options.cliPath ?? (await resolveOfficialCliPath());
  const fps = normalizeOfficialFps(spec.format.fps);
  const args = [
    cliPath,
    "render",
    "--output",
    outputPath,
    "--fps",
    String(fps),
    "--quality",
    options.renderQuality,
    "--format",
    format
  ];
  if (options.renderWorkers) {
    args.push("--workers", String(options.renderWorkers));
  }
  if (options.useDocker) {
    args.push("--docker");
  }
  if (options.useGpu) {
    args.push("--gpu");
  }

  const chromePath = resolveChromePath();
  const env = chromePath
    ? {
        ...process.env,
        PRODUCER_HEADLESS_SHELL_PATH:
          process.env.PRODUCER_HEADLESS_SHELL_PATH ?? chromePath
      }
    : process.env;
  const runner = options.commandRunner ?? runCommand;
  const commandResult = await runner(process.execPath, args, {
    cwd: project.rootPath,
    env
  });
  const logs = [
    `$ ${commandResult.command}`,
    commandResult.stdout,
    commandResult.stderr
  ].join("\n");
  await writeLog(context.logDir, "render.log", logs);

  const ok = commandResult.code === 0 && existsSync(outputPath);
  return {
    ok,
    projectId: project.id,
    outputPath,
    command: commandResult.command,
    logs,
    message: ok
      ? "HyperFrames official CLI render completed."
      : "HyperFrames official CLI render failed. Inspect logs/render.log."
  };
}

async function renderWithOfficialProducer(
  project: GeneratedProject,
  context: RenderContext,
  options: ResolvedHyperFramesOptions,
  fallbackNote?: string
): Promise<RenderResult> {
  const renderDir = getRenderDir(project, context);
  const spec = await readProjectSpec(project.rootPath);
  const format = resolveRenderFormat(spec, options);
  const outputPath = path.join(renderDir, `output.${format}`);
  await fs.mkdir(renderDir, { recursive: true });

  const producer = await loadProducer(options.moduleLoader);
  const progress: string[] = [];
  const chromePath = resolveChromePath();
  const producerConfig =
    producer.resolveConfig && chromePath
      ? producer.resolveConfig({
          chromePath,
          browserGpuMode: options.useGpu ? "hardware" : "software"
        })
      : undefined;
  const job = producer.createRenderJob({
    fps: normalizeOfficialFps(spec.format.fps),
    quality: options.renderQuality,
    format,
    entryFile: "index.html",
    workers: options.renderWorkers,
    useGpu: options.useGpu,
    producerConfig
  });
  const command = `@hyperframes/producer executeRenderJob(${project.rootPath}, ${outputPath})`;

  try {
    await producer.executeRenderJob(job, project.rootPath, outputPath, (_job, message) => {
      progress.push(message);
    });
  } catch (error) {
    const logs = `${command}\n${progress.join("\n")}\n${formatError(error)}`;
    await writeLog(context.logDir, "render.log", logs);
    return {
      ok: false,
      projectId: project.id,
      outputPath,
      command,
      logs,
      message: "HyperFrames official producer render failed. Inspect logs/render.log."
    };
  }

  const logs = [fallbackNote, command, progress.join("\n")]
    .filter(Boolean)
    .join("\n");
  await writeLog(context.logDir, "render.log", logs);
  const ok = existsSync(outputPath);
  return {
    ok,
    projectId: project.id,
    outputPath,
    command,
    logs,
    message: ok
      ? fallbackNote
        ? "HyperFrames official engine fallback used official producer render successfully."
        : "HyperFrames official producer render completed."
      : "HyperFrames official producer render finished without an output file."
  };
}

async function renderWithOfficialEngine(
  project: GeneratedProject,
  context: RenderContext,
  options: ResolvedHyperFramesOptions
): Promise<RenderResult> {
  const renderDir = getRenderDir(project, context);
  const framesDir = path.join(renderDir, "frames");
  const spec = await readProjectSpec(project.rootPath);
  const format = resolveRenderFormat(spec, options);
  const outputPath = path.join(renderDir, `output.${format}`);
  await fs.mkdir(framesDir, { recursive: true });

  let hyperframesEngine: HyperFramesEngineModule;
  try {
    hyperframesEngine = await loadEngine(options.moduleLoader);
  } catch (error) {
    return renderWithOfficialProducer(
      project,
      context,
      options,
      `@hyperframes/engine could not be loaded directly; falling back to @hyperframes/producer. ${formatError(error)}`
    );
  }
  const chromePath = resolveChromePath();
  const engineConfig = hyperframesEngine.resolveConfig
    ? hyperframesEngine.resolveConfig({
        chromePath,
        fps: normalizeOfficialFps(spec.format.fps),
        quality: options.renderQuality,
        browserGpuMode: options.useGpu ? "hardware" : "software"
      })
    : undefined;
  const server = await hyperframesEngine.createFileServer({
    projectDir: project.rootPath,
    stripEmbeddedRuntime: false
  });
  let session: unknown;
  const command = `@hyperframes/engine captureFrame + encodeFramesFromDir(${project.rootPath}, ${outputPath})`;

  try {
    session = await hyperframesEngine.createCaptureSession(
      server.url,
      framesDir,
      {
        width: spec.format.width,
        height: spec.format.height,
        fps: normalizeOfficialFps(spec.format.fps),
        format: "jpeg",
        quality: 90
      },
      null,
      engineConfig
    );
    await hyperframesEngine.initializeSession(session);

    const fps = normalizeOfficialFps(spec.format.fps);
    const totalFrames = Math.max(1, Math.ceil(spec.format.durationSec * fps));
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      await hyperframesEngine.captureFrame(session, frameIndex, frameIndex / fps);
    }

    const preset = hyperframesEngine.getEncoderPreset(
      options.renderQuality,
      format
    );
    const encodeResult = await hyperframesEngine.encodeFramesFromDir(
      framesDir,
      "frame_%06d.jpg",
      outputPath,
      {
        fps,
        width: spec.format.width,
        height: spec.format.height,
        ...preset,
        useGpu: options.useGpu
      },
      undefined,
      engineConfig
    );

    const logs = [
      command,
      `Captured ${totalFrames} frames with @hyperframes/engine.`,
      encodeResult.success
        ? `Encoded ${outputPath}.`
        : `Encode failed: ${encodeResult.error ?? "unknown error"}`
    ].join("\n");
    await writeLog(context.logDir, "render.log", logs);
    const ok = encodeResult.success && existsSync(outputPath);
    return {
      ok,
      projectId: project.id,
      outputPath,
      command,
      logs,
      message: ok
        ? "HyperFrames official engine render completed."
        : "HyperFrames official engine render failed. Inspect logs/render.log."
    };
  } catch (error) {
    const logs = `${command}\n${formatError(error)}`;
    await writeLog(context.logDir, "render.log", logs);
    return {
      ok: false,
      projectId: project.id,
      outputPath,
      command,
      logs,
      message: "HyperFrames official engine render failed. Inspect logs/render.log."
    };
  } finally {
    if (session) {
      await hyperframesEngine.closeCaptureSession(session).catch(() => undefined);
    }
    server.close();
  }
}

function buildHtml(
  spec: VideoSpec,
  htmlInCanvasBlock?: HtmlInCanvasRegistryBlock
): string {
  const scenes = spec.content.scenes ?? [];
  const sceneMarkup = scenes
    .map(
      (scene) => `<section class="scene">
  <p class="scene-kicker">Scene ${scene.order}</p>
  <h2>${escapeHtml(scene.text ?? scene.description)}</h2>
  <p>${escapeHtml(scene.motion ?? "DOM motion")}</p>
</section>`
    )
    .join("\n");
  const htmlInCanvasMarkup = htmlInCanvasBlock
    ? `<div
      class="registry-block registry-block--html-in-canvas"
      data-composition-id="${htmlInCanvasBlock.id}"
      data-composition-src="${htmlInCanvasBlock.src}"
      data-start="0"
      data-duration="${Math.min(spec.format.durationSec, htmlInCanvasBlock.durationSec)}"
      data-track-index="1"
      data-width="${htmlInCanvasBlock.width}"
      data-height="${htmlInCanvasBlock.height}"
      aria-hidden="true"
    ></div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(spec.title)}</title>
  <link rel="stylesheet" href="./styles.css" />
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
</head>
<body data-aspect="${spec.format.aspectRatio}">
  <main id="root" class="stage" data-has-html-in-canvas="${htmlInCanvasBlock ? "true" : "false"}" data-composition-id="root" data-start="0" data-duration="${spec.format.durationSec}" data-width="${spec.format.width}" data-height="${spec.format.height}" data-track-index="0">
    ${htmlInCanvasMarkup}
    <section class="hero">
      <h1>${escapeHtml(spec.title)}</h1>
      <p class="goal">${escapeHtml(spec.goal)}</p>
      ${spec.content.cta ? `<strong class="cta">${escapeHtml(spec.content.cta)}</strong>` : ""}
    </section>
    ${sceneMarkup}
    <div id="driver" class="clip" data-start="0" data-duration="${spec.format.durationSec}" data-track-index="9" aria-hidden="true"></div>
  </main>
  <script src="./motion.js"></script>
</body>
</html>
`;
}

function buildCss(spec: VideoSpec): string {
  const width = spec.format.width;
  const height = spec.format.height;

  return `:root {
  color-scheme: dark;
  --bg: #101418;
  --fg: #f4f7fb;
  --muted: #9fb1c2;
  --accent: #33d6a6;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0b0f14;
  color: var(--fg);
}

.stage {
  position: relative;
  width: min(100vw, ${width}px);
  aspect-ratio: ${width} / ${height};
  min-height: min(100vh, ${height}px);
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(51, 214, 166, 0.22), transparent 38%),
    linear-gradient(315deg, rgba(74, 144, 226, 0.24), transparent 42%),
    var(--bg);
}

.hero,
.scene {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  gap: 18px;
  padding: 8%;
  z-index: 2;
}

.scene {
  opacity: 0;
  transform: translateY(42px) scale(0.98);
}

#driver {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.registry-block--html-in-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.stage[data-has-html-in-canvas="true"] .hero,
.stage[data-has-html-in-canvas="true"] .scene {
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.55), transparent 70%);
  text-shadow: 0 3px 22px rgba(0, 0, 0, 0.55);
}

.eyebrow,
.scene-kicker {
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  max-width: 12ch;
  font-size: clamp(44px, 9vw, 118px);
  line-height: 0.94;
}

h2 {
  max-width: 18ch;
  font-size: clamp(30px, 6vw, 76px);
  line-height: 1;
}

.goal {
  max-width: 58ch;
  color: var(--muted);
  font-size: clamp(16px, 2vw, 28px);
  line-height: 1.5;
}

.cta {
  width: fit-content;
  border: 1px solid rgba(51, 214, 166, 0.55);
  padding: 12px 16px;
  color: var(--fg);
  background: rgba(51, 214, 166, 0.14);
}
`;
}

function buildMotionJs(spec: VideoSpec): string {
  const durationSec = spec.format.durationSec;

  return `const scenes = [...document.querySelectorAll(".scene")];
const hero = document.querySelector(".hero");
const panels = [hero, ...scenes].filter(Boolean);
const panelCount = Math.max(1, panels.length);
const durationSec = ${durationSec};
const panelDuration = durationSec / panelCount;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

gsap.set(panels, {
  opacity: 0,
  y: 42,
  scale: 0.985,
  pointerEvents: "none"
});

const tl = gsap.timeline({ paused: true });

panels.forEach((panel, index) => {
  const pad = Math.min(0.22, panelDuration * 0.04);
  const start = index * panelDuration + pad;
  const end = (index + 1) * panelDuration - pad;
  const holdEnd = Math.max(start + 0.9, end - 0.48);

  tl.set(panel, { pointerEvents: "auto" }, start);
  tl.to(panel, { opacity: 1, y: 0, scale: 1, duration: 0.62, ease: "power3.out" }, start);
  tl.to(panel, { opacity: 0, y: -34, scale: 0.988, duration: 0.48, ease: "power2.in" }, holdEnd);
  tl.set(panel, { pointerEvents: "none" }, end);
});

window.__timelines = window.__timelines || {};
window.__timelines.root = tl;
window.__hf = {
  duration: durationSec,
  seek(time) {
    tl.time(clamp(Number(time) || 0, 0, durationSec));
  }
};
window.__playerReady = true;
window.__renderReady = true;
tl.time(0);

const params = new URLSearchParams(window.location.search);
const frameParam = params.get("frame");
const fpsParam = Number(params.get("fps") || "${spec.format.fps}");

if (frameParam !== null) {
  const frame = Number(frameParam);
  const fps = Number.isFinite(fpsParam) && fpsParam > 0 ? fpsParam : ${spec.format.fps};
  tl.time(clamp((Number.isFinite(frame) ? frame : 0) / fps, 0, durationSec));
  document.documentElement.dataset.videoRouterFrame = String(frame);
} else if (params.get("play") === "1") {
  const startTime = performance.now();
  function tick(now) {
    tl.time(((now - startTime) / 1000) % durationSec);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
`;
}

function buildReadme(
  spec: VideoSpec,
  htmlInCanvasBlock?: HtmlInCanvasRegistryBlock
): string {
  const htmlInCanvasNotes = htmlInCanvasBlock
    ? `
## HyperFrames HTML-in-Canvas

Michibiki detected an HTML-in-Canvas request and installed the official HyperFrames registry bundle as a reference with:

\`\`\`bash
pnpm --filter @michibiki/engine-hyperframes exec hyperframes add html-in-canvas --dir <generated-project> --no-clipboard --json
\`\`\`

Suggested block: \`${htmlInCanvasBlock.id}\` (${htmlInCanvasBlock.title}).

The registry demo block is not wired into \`index.html\` automatically because official examples can include provider branding and heavy WebGL effects. Copy the relevant technique into a brand-neutral composition before rendering.
`
    : "";

  return `# ${spec.title}

Generated by Michibiki's HyperFrames adapter.

- Aspect ratio: ${spec.format.aspectRatio}
- Size: ${spec.format.width}x${spec.format.height}
- FPS target: ${spec.format.fps}
- Duration: ${spec.format.durationSec}s

Open \`index.html\` to preview the DOM/CSS/JS motion draft.
${htmlInCanvasNotes}
`;
}

async function installHyperFramesRegistryItem(
  name: string,
  projectRoot: string,
  options: ResolvedHyperFramesOptions
): Promise<HyperFramesRegistryInstallResult> {
  const cliPath = options.cliPath ?? (await resolveOfficialCliPath());
  const args = [
    cliPath,
    "add",
    name,
    "--dir",
    projectRoot,
    "--no-clipboard",
    "--json"
  ];
  const runner = options.commandRunner ?? runCommand;
  const commandResult = await runner(process.execPath, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      HYPERFRAMES_NO_UPDATE_CHECK:
        process.env.HYPERFRAMES_NO_UPDATE_CHECK ?? "1"
    }
  });

  if (commandResult.code !== 0) {
    throw new Error(
      [
        `HyperFrames registry install failed for ${name}.`,
        `$ ${commandResult.command}`,
        commandResult.stdout,
        commandResult.stderr
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return {
    name,
    command: commandResult.command,
    installed: parseRegistryInstalledItems(commandResult.stdout, name)
  };
}

function parseRegistryInstalledItems(
  stdout: string,
  fallbackName: string
): string[] {
  try {
    const parsed = JSON.parse(stdout) as {
      installed?: unknown;
      written?: unknown;
      name?: unknown;
    };
    if (Array.isArray(parsed.installed)) {
      return parsed.installed.filter((item): item is string => typeof item === "string");
    }
    if (Array.isArray(parsed.written)) {
      return parsed.written
        .filter((item): item is string => typeof item === "string")
        .map((item) => path.basename(item, path.extname(item)));
    }
    if (typeof parsed.name === "string") {
      return [parsed.name];
    }
  } catch {
    // Fall back to the registry name when the CLI output is not JSON.
  }
  return [fallbackName];
}

function selectHtmlInCanvasRegistryBlock(
  spec: VideoSpec
): HtmlInCanvasRegistryBlock | undefined {
  const text = [spec.goal, spec.title, spec.style.motionStyle, spec.style.visualTone]
    .join(" ")
    .toLowerCase();
  if (!mentionsHtmlInCanvasRegistry(text)) return undefined;

  if (/(iphone|macbook|device|デバイス|スマホ|スマートフォン|phone|3d|gltf)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-iphone-device"];
  }
  if (/(liquid glass|glass|ガラス|voronoi|parallax|パララックス)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-liquid-glass"];
  }
  if (/(liquid|fluid|background|背景|波|wave|ripple)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-liquid-background"];
  }
  if (/(portal|ポータル|dimension|次元)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-portal"];
  }
  if (/(shatter|break|破片|割れ|砕け|ガラス片)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-shatter"];
  }
  if (/(magnetic|磁場|磁力|particle|粒子)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-magnetic"];
  }
  return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-text-cursor"];
}

function mentionsHtmlInCanvasRegistry(text: string): boolean {
  return /(html[- ]?in[- ]?canvas|drawElementImage|canvas-draw-element|canvasdrawelement|layoutsubtree|dom[^、。.!?\n]{0,24}(?:canvas|キャンバス|webgl|shader|シェーダー)|html[^、。.!?\n]{0,24}(?:canvas|キャンバス|webgl|shader|シェーダー)|(?:canvas|キャンバス)[^、。.!?\n]{0,24}(?:dom|html))/i.test(
    text
  );
}

function createProjectName(spec: VideoSpec): string {
  return `hyperframes-${slugify(spec.title)}-${Date.now()}`;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "video"
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function writeLog(
  logDir: string | undefined,
  fileName: string,
  message: string
): Promise<void> {
  if (!logDir) return;

  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(path.join(logDir, fileName), message, "utf8");
}

async function readProjectSpec(projectRoot: string): Promise<VideoSpec> {
  const specPath = path.join(projectRoot, "video-spec.json");
  return JSON.parse(await fs.readFile(specPath, "utf8")) as VideoSpec;
}

function getRenderDir(
  project: GeneratedProject,
  context: RenderContext = {}
): string {
  return context.outputDir
    ? path.join(context.outputDir, "render")
    : path.join(project.rootPath, "render");
}

function inferRenderFormat(spec: VideoSpec): HyperFramesRenderFormat {
  return spec.output.type === "webm" ? "webm" : "mp4";
}

function resolveRenderFormat(
  spec: VideoSpec,
  options: ResolvedHyperFramesOptions
): HyperFramesRenderFormat {
  return options.renderFormat ?? inferRenderFormat(spec);
}

function normalizeOfficialFps(fps: number): 24 | 30 | 60 {
  if (fps === 24 || fps === 30 || fps === 60) return fps;
  return 30;
}

function parseRenderBackend(value: unknown): HyperFramesRenderBackend | undefined {
  if (
    value === "official-cli" ||
    value === "official-producer" ||
    value === "official-engine" ||
    value === "local"
  ) {
    return value;
  }
  return undefined;
}

async function resolveOfficialCliPath(): Promise<string> {
  const packageJsonPath = require.resolve("hyperframes/package.json");
  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(
    await fs.readFile(packageJsonPath, "utf8")
  ) as {
    bin?: string | Record<string, string>;
  };
  const binPath =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : packageJson.bin?.hyperframes;
  if (!binPath) {
    throw new Error("The hyperframes package does not expose a CLI binary.");
  }
  return path.join(packageRoot, binPath);
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  }
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        command: [command, ...args].map(shellQuote).join(" "),
        stdout,
        stderr
      });
    });
  });
}

async function loadProducer(
  moduleLoader: ModuleLoader | undefined
): Promise<HyperFramesProducerModule> {
  const loaded = await (moduleLoader ?? importModule)("@hyperframes/producer");
  const producer = loaded as Partial<HyperFramesProducerModule>;
  if (!producer.createRenderJob || !producer.executeRenderJob) {
    throw new Error("@hyperframes/producer does not expose the expected render API.");
  }
  return producer as HyperFramesProducerModule;
}

async function loadEngine(
  moduleLoader: ModuleLoader | undefined
): Promise<HyperFramesEngineModule> {
  const loaded = moduleLoader
    ? await moduleLoader("@hyperframes/engine")
    : await importOfficialEngineModule();
  const engine = loaded as Partial<HyperFramesEngineModule>;
  if (
    !engine.createFileServer ||
    !engine.createCaptureSession ||
    !engine.initializeSession ||
    !engine.captureFrame ||
    !engine.closeCaptureSession ||
    !engine.encodeFramesFromDir ||
    !engine.getEncoderPreset
  ) {
    throw new Error("@hyperframes/engine does not expose the expected capture API.");
  }
  return engine as HyperFramesEngineModule;
}

function importModule(specifier: string): Promise<unknown> {
  return import(specifier);
}

async function importOfficialEngineModule(): Promise<unknown> {
  const exportedEntryPath = require.resolve("@hyperframes/engine");
  const packageRoot = exportedEntryPath.endsWith(path.join("src", "index.ts"))
    ? path.dirname(path.dirname(exportedEntryPath))
    : path.dirname(exportedEntryPath);
  const distEntryPath = path.join(packageRoot, "dist", "index.js");
  if (existsSync(distEntryPath)) {
    return import(pathToFileURL(distEntryPath).href);
  }
  return importModule("@hyperframes/engine");
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}\n${error.stack ?? ""}`.trim();
  }
  return String(error);
}

function shellQuote(value: string): string {
  if (/^[\w./:=@+-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
