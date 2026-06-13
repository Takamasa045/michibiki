import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderBrowserVideo, resolveChromePath } from "@michibiki/browser-renderer";
import { validateLicense } from "@michibiki/compliance";
import {
  slugify,
  type GeneratedProject,
  type GenerateProjectContext,
  type PreviewResult,
  type RenderContext,
  type RenderResult,
  type VideoEngine,
  type VideoSpec
} from "@michibiki/video-spec";
import {
  HTML_IN_CANVAS_REGISTRY_NAME,
  parseRegistryInstalledItems,
  selectHtmlInCanvasRegistryBlock,
  type HtmlInCanvasRegistryBlock
} from "./registry.js";
import {
  buildCss,
  buildHtml,
  buildMotionJs,
  buildReadme
} from "./templates.js";

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

const DEFAULT_RENDER_BACKEND: HyperFramesRenderBackend = "official-cli";

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

function createProjectName(spec: VideoSpec): string {
  return `hyperframes-${slugify(spec.title)}-${Date.now()}`;
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
