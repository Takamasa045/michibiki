import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { validateLicense } from "@video-router/compliance";
import type {
  GeneratedProject,
  GenerateProjectContext,
  LicenseContext,
  LicenseResult,
  PreviewResult,
  RenderContext,
  RenderResult,
  VideoEngine,
  VideoSpec
} from "@video-router/video-spec";
import { resolveRemotionRepoPath } from "./paths.js";

export type RemotionEngineOptions = {
  remotionRepoPath?: string;
  cwd?: string;
};

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};

export function createRemotionEngine(
  options: RemotionEngineOptions = {}
): VideoEngine {
  const cwd = options.cwd ?? process.cwd();
  const remotionRepoPath = resolveRemotionRepoPath(
    options.remotionRepoPath,
    cwd
  );

  return {
    name: "remotion",
    canHandle: (spec) => canRemotionHandle(spec),
    generateProject: (spec, context) =>
      generateRemotionProject(spec, {
        ...context,
        remotionRepoPath
      }),
    preview: (project) => previewRemotionProject(project, remotionRepoPath),
    render: (project, context) =>
      renderRemotionProject(project, {
        ...context,
        remotionRepoPath
      }),
    validateLicense: (context) => Promise.resolve(validateLicense("remotion", context))
  };
}

export function canRemotionHandle(spec: VideoSpec): boolean {
  const preference = spec.constraints.enginePreference ?? "auto";
  if (preference === "remotion") return true;
  if (preference !== "auto") return false;

  return !spec.assets.some(
    (asset) => asset.type === "video" || asset.type === "audio"
  );
}

export function selectRemotionTemplate(spec: VideoSpec): "default" | "3d" {
  const text = [
    spec.title,
    spec.goal,
    spec.style.visualTone,
    spec.style.motionStyle
  ]
    .join(" ")
    .toLowerCase();

  return /(3d|three|立体|空間|webgl|three\.js)/i.test(text) ? "3d" : "default";
}

async function generateRemotionProject(
  spec: VideoSpec,
  context: GenerateProjectContext & { remotionRepoPath: string }
): Promise<GeneratedProject> {
  assertRemotionRepo(context.remotionRepoPath);

  const appName = createAppName(spec);
  const compositionId = "Main";
  const template = selectRemotionTemplate(spec);
  const durationInFrames = Math.round(spec.format.durationSec * spec.format.fps);
  const projectPath = path.join(context.remotionRepoPath, "apps", appName);
  const commandArgs = [
    "create:project",
    appName,
    "--yes",
    "--no-install",
    "--template",
    template
  ];

  if (!context.dryRun) {
    const result = await run("pnpm", commandArgs, {
      cwd: context.remotionRepoPath
    });
    await writeLog(context.logDir, "generate.log", result);

    if (result.code !== 0) {
      throw new Error(`Remotion project generation failed: ${result.stderr}`);
    }

    await writeRemotionSpecFiles(projectPath, spec, {
      appName,
      compositionId,
      template,
      durationInFrames
    });
  } else {
    await writeLog(context.logDir, "generate.log", {
      code: 0,
      stdout: `DRY RUN: pnpm ${commandArgs.join(" ")}\n`,
      stderr: "",
      command: `pnpm ${commandArgs.join(" ")}`
    });
  }

  const manifest = {
    id: `project_${randomUUID()}`,
    engine: "remotion",
    appName,
    compositionId,
    template,
    projectPath,
    remotionRepoPath: context.remotionRepoPath,
    generatedAt: new Date().toISOString()
  };

  if (context.outputDir) {
    const projectDir = path.join(context.outputDir, "project");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, "project.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
  }

  return {
    id: manifest.id,
    engine: "remotion",
    name: appName,
    rootPath: projectPath,
    files: [
      path.join(projectPath, "app.meta.json"),
      path.join(projectPath, "public/assets/data/video-spec.json"),
      path.join(projectPath, "public/assets/data/props.json")
    ],
    metadata: manifest
  };
}

function previewRemotionProject(
  project: GeneratedProject,
  remotionRepoPath: string
): Promise<PreviewResult> {
  const command = `pnpm -C ${quotePath(remotionRepoPath)} forge studio`;

  return Promise.resolve({
    ok: true,
    projectId: project.id,
    command,
    message: "Run the Forge Studio command to preview the generated project."
  });
}

async function renderRemotionProject(
  project: GeneratedProject,
  context: RenderContext & { remotionRepoPath: string }
): Promise<RenderResult> {
  assertRemotionRepo(context.remotionRepoPath);

  const appName = getStringMetadata(project, "appName") ?? project.name;
  const compositionId = getStringMetadata(project, "compositionId") ?? "Main";
  const outputDir = context.outputDir
    ? path.join(context.outputDir, "render")
    : path.join(project.rootPath, "out");
  const outputPath = path.join(outputDir, "output.mp4");
  const engineOutputDir = path.join(project.rootPath, "out");
  const engineOutputPath = path.join(
    engineOutputDir,
    `video-router-${Date.now()}.mp4`
  );
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(engineOutputDir, { recursive: true });

  const args = [
    "forge",
    "render",
    "--app",
    appName,
    "--composition",
    compositionId,
    "--output",
    engineOutputPath
  ];

  if (context.skipBuildPackages) {
    args.push("--skip-build-packages");
  }

  const result = await run("pnpm", args, {
    cwd: context.remotionRepoPath
  });
  let copyMessage = "";
  if (result.code === 0 && existsSync(engineOutputPath)) {
    await fs.copyFile(engineOutputPath, outputPath);
    copyMessage = `\nCopied render output to ${outputPath}\n`;
  }
  result.stdout += copyMessage;
  await writeLog(context.logDir, "render.log", result);
  const ok = result.code === 0 && existsSync(outputPath);

  return {
    ok,
    projectId: project.id,
    outputPath,
    command: `pnpm ${args.join(" ")}`,
    logs: `${result.stdout}${result.stderr}`,
    message:
      ok
        ? "Remotion render completed."
        : "Remotion render failed. Inspect logs/render.log."
  };
}

async function writeRemotionSpecFiles(
  projectPath: string,
  spec: VideoSpec,
  metadata: {
    appName: string;
    compositionId: string;
    template: string;
    durationInFrames: number;
  }
): Promise<void> {
  const dataDir = path.join(projectPath, "public", "assets", "data");
  await fs.mkdir(dataDir, { recursive: true });
  await applyVideoSpecToRemotionProject(projectPath, spec, metadata);

  const props = {
    videoSpec: spec,
    router: {
      generatedBy: "michibiki",
      generatedAt: new Date().toISOString()
    }
  };

  await fs.writeFile(
    path.join(dataDir, "video-spec.json"),
    `${JSON.stringify(spec, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(dataDir, "props.json"),
    `${JSON.stringify(props, null, 2)}\n`,
    "utf8"
  );

  const metaPath = path.join(projectPath, "app.meta.json");
  const existingMeta = existsSync(metaPath)
    ? (JSON.parse(await fs.readFile(metaPath, "utf8")) as Record<string, unknown>)
    : {};

  const meta = {
    ...existingMeta,
    title: spec.title,
    description: spec.goal,
    tags: [
      "video-router",
      "remotion",
      metadata.template,
      spec.format.aspectRatio
    ],
    category: "video-router",
    videoRouter: {
      specId: spec.id,
      appName: metadata.appName,
      compositionId: metadata.compositionId,
      durationInFrames: metadata.durationInFrames
    }
  };

  await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function applyVideoSpecToRemotionProject(
  projectPath: string,
  spec: VideoSpec,
  metadata: { durationInFrames: number }
): Promise<void> {
  await patchTextFileIfExists(path.join(projectPath, "src", "Root.tsx"), (source) =>
    source
      .replace(/const\s+WIDTH\s*=\s*\d+\s*;/, `const WIDTH = ${spec.format.width};`)
      .replace(/const\s+HEIGHT\s*=\s*\d+\s*;/, `const HEIGHT = ${spec.format.height};`)
      .replace(/const\s+FPS\s*=\s*\d+\s*;/, `const FPS = ${spec.format.fps};`)
      .replace(
        /const\s+DURATION\s*=\s*\d+\s*;/,
        `const DURATION = ${metadata.durationInFrames};`
      )
      .replace(/title:\s*"[^"]*"/, `title: ${JSON.stringify(spec.title)}`)
      .replace(
        /subtitle:\s*"[^"]*"/,
        `subtitle: ${JSON.stringify(spec.content.cta ?? spec.goal.slice(0, 80))}`
      )
  );

  await patchTextFileIfExists(
    path.join(projectPath, "src", "project.config.ts"),
    (source) =>
      source
        .replace(/title:\s*"[^"]*"/, `title: ${JSON.stringify(spec.title)}`)
        .replace(/width:\s*\d+\s*,/, `width: ${spec.format.width},`)
        .replace(/height:\s*\d+\s*,/, `height: ${spec.format.height},`)
        .replace(/fps:\s*\d+\s*,/, `fps: ${spec.format.fps},`)
        .replace(
          /durationInFrames:\s*\d+\s*,?/,
          `durationInFrames: ${metadata.durationInFrames},`
        )
  );
}

async function patchTextFileIfExists(
  filePath: string,
  patcher: (source: string) => string
): Promise<void> {
  if (!existsSync(filePath)) return;

  const source = await fs.readFile(filePath, "utf8");
  const patched = patcher(source);
  if (patched !== source) {
    await fs.writeFile(filePath, patched, "utf8");
  }
}

function assertRemotionRepo(remotionRepoPath: string): void {
  const packageJsonPath = path.join(remotionRepoPath, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(
      `Remotion monorepo not found at ${remotionRepoPath}. Set VIDEO_ROUTER_REMOTION_REPO or clone it into engines/remotion-studio-monorepo.`
    );
  }
}

function createAppName(spec: VideoSpec): string {
  const slug = slugify(spec.title || "video-router");
  return `${slug}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8)}`;
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.length > 0 ? normalized.slice(0, 40) : "video-router";
}

function getStringMetadata(
  project: GeneratedProject,
  key: string
): string | undefined {
  const value = project.metadata[key];
  return typeof value === "string" ? value : undefined;
}

function quotePath(value: string): string {
  return value.includes(" ") ? `"${value.replaceAll('"', '\\"')}"` : value;
}

async function writeLog(
  logDir: string | undefined,
  fileName: string,
  result: CommandResult
): Promise<void> {
  if (!logDir) return;

  await fs.mkdir(logDir, { recursive: true });
  const body = [
    `$ ${result.command}`,
    "",
    `exitCode=${result.code}`,
    "",
    "STDOUT:",
    result.stdout,
    "",
    "STDERR:",
    result.stderr
  ].join("\n");

  await fs.writeFile(path.join(logDir, fileName), body, "utf8");
}

function run(
  command: string,
  args: string[],
  options: { cwd: string }
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      env: process.env
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      resolve({
        code: 1,
        stdout,
        stderr,
        command: `${command} ${args.join(" ")}`
      });
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        command: `${command} ${args.join(" ")}`
      });
    });
  });
}
