import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { validateLicense } from "@michibiki/compliance";
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
} from "@michibiki/video-spec";
import { resolveRemotionRepoPath } from "./paths.js";

export type RemotionEngineOptions = {
  remotionRepoPath?: string;
  remotionMode?: RemotionProjectMode;
  cwd?: string;
};

export type RemotionProjectMode = "auto" | "monorepo" | "standalone";

type ResolvedRemotionProjectMode = Exclude<RemotionProjectMode, "auto">;

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};

// renovate: datasource=npm depName=remotion versioning=npm
const REMOTION_VERSION = "^4.0.459";
// renovate: datasource=npm depName=react versioning=npm
const REACT_VERSION = "^19.2.6";
// renovate: datasource=npm depName=@types/react versioning=npm
const REACT_TYPES_VERSION = "^19.2.14";
// renovate: datasource=npm depName=@types/react-dom versioning=npm
const REACT_DOM_TYPES_VERSION = "^19.2.3";
// renovate: datasource=npm depName=typescript versioning=npm
const TYPESCRIPT_VERSION = "^6.0.0";

export function createRemotionEngine(
  options: RemotionEngineOptions = {}
): VideoEngine {
  const cwd = options.cwd ?? process.cwd();
  const remotionMode = options.remotionMode ?? "auto";
  const remotionRepoPath = resolveRemotionRepoPath(
    options.remotionRepoPath,
    cwd
  );
  const hasExplicitRemotionRepoPath = Boolean(options.remotionRepoPath);

  return {
    name: "remotion",
    canHandle: (spec) => canRemotionHandle(spec),
    generateProject: (spec, context) =>
      generateRemotionProject(spec, {
        ...context,
        remotionRepoPath,
        remotionMode,
        hasExplicitRemotionRepoPath
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
  context: GenerateProjectContext & {
    remotionRepoPath: string;
    remotionMode: RemotionProjectMode;
    hasExplicitRemotionRepoPath: boolean;
  }
): Promise<GeneratedProject> {
  const resolvedMode = resolveRemotionProjectMode(context);
  if (resolvedMode === "standalone") {
    return generateStandaloneRemotionProject(spec, context);
  }

  return generateMonorepoRemotionProject(spec, context);
}

async function generateMonorepoRemotionProject(
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
    remotionMode: "monorepo",
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

async function generateStandaloneRemotionProject(
  spec: VideoSpec,
  context: GenerateProjectContext
): Promise<GeneratedProject> {
  const appName = createAppName(spec);
  const compositionId = "Main";
  const template = "official-minimal";
  const durationInFrames = Math.round(spec.format.durationSec * spec.format.fps);
  const projectPath = context.outputDir
    ? path.join(context.outputDir, "project", "remotion")
    : path.resolve("outputs", "remotion", appName);

  await writeStandaloneRemotionProjectFiles(projectPath, spec, {
    appName,
    compositionId,
    durationInFrames
  });

  await writeLog(context.logDir, "generate.log", {
    code: 0,
    stdout: `Generated standalone Remotion project at ${projectPath}\n`,
    stderr: "",
    command: "michibiki remotion standalone"
  });

  const manifest = {
    id: `project_${randomUUID()}`,
    engine: "remotion",
    appName,
    compositionId,
    template,
    remotionMode: "standalone",
    projectPath,
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
      path.join(projectPath, "package.json"),
      path.join(projectPath, "src", "index.ts"),
      path.join(projectPath, "src", "Root.tsx"),
      path.join(projectPath, "src", "video-spec.ts"),
      path.join(projectPath, "public", "assets", "data", "video-spec.json")
    ],
    metadata: manifest
  };
}

function previewRemotionProject(
  project: GeneratedProject,
  remotionRepoPath: string
): Promise<PreviewResult> {
  if (isStandaloneRemotionProject(project)) {
    const command = [
      `pnpm -C ${quotePath(project.rootPath)} install`,
      `pnpm -C ${quotePath(project.rootPath)} exec remotion studio src/index.ts`
    ].join(" && ");

    return Promise.resolve({
      ok: true,
      projectId: project.id,
      command,
      message:
        "Install dependencies, then run Remotion Studio in the standalone project."
    });
  }

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
  if (isStandaloneRemotionProject(project)) {
    return renderStandaloneRemotionProject(project, context);
  }

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
    `michibiki-${Date.now()}.mp4`
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

async function renderStandaloneRemotionProject(
  project: GeneratedProject,
  context: RenderContext
): Promise<RenderResult> {
  const compositionId = getStringMetadata(project, "compositionId") ?? "Main";
  const outputDir = context.outputDir
    ? path.join(context.outputDir, "render")
    : path.join(project.rootPath, "out");
  const outputPath = path.join(outputDir, "output.mp4");
  await fs.mkdir(outputDir, { recursive: true });

  const results: CommandResult[] = [];
  if (!context.skipBuildPackages) {
    const installResult = await run("pnpm", ["install", "--no-frozen-lockfile"], {
      cwd: project.rootPath
    });
    results.push(installResult);
    if (installResult.code !== 0) {
      const failed = combineCommandResults(results);
      await writeLog(context.logDir, "render.log", failed);
      return {
        ok: false,
        projectId: project.id,
        outputPath,
        command: failed.command,
        logs: `${failed.stdout}${failed.stderr}`,
        message: "Standalone Remotion dependency install failed. Inspect logs/render.log."
      };
    }
  }

  const renderResult = await run(
    "pnpm",
    ["exec", "remotion", "render", "src/index.ts", compositionId, outputPath],
    { cwd: project.rootPath }
  );
  results.push(renderResult);
  const combined = combineCommandResults(results);
  await writeLog(context.logDir, "render.log", combined);
  const ok = renderResult.code === 0 && existsSync(outputPath);

  return {
    ok,
    projectId: project.id,
    outputPath,
    command: combined.command,
    logs: `${combined.stdout}${combined.stderr}`,
    message:
      ok
        ? "Standalone Remotion render completed."
        : "Standalone Remotion render failed. Inspect logs/render.log."
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
      "michibiki",
      "remotion",
      metadata.template,
      spec.format.aspectRatio
    ],
    category: "michibiki",
    michibiki: {
      specId: spec.id,
      appName: metadata.appName,
      compositionId: metadata.compositionId,
      durationInFrames: metadata.durationInFrames
    }
  };

  await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function writeStandaloneRemotionProjectFiles(
  projectPath: string,
  spec: VideoSpec,
  metadata: {
    appName: string;
    compositionId: string;
    durationInFrames: number;
  }
): Promise<void> {
  const srcDir = path.join(projectPath, "src");
  const dataDir = path.join(projectPath, "public", "assets", "data");
  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(
    path.join(projectPath, "package.json"),
    `${JSON.stringify(buildStandalonePackageJson(spec), null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(projectPath, "tsconfig.json"),
    `${JSON.stringify(buildStandaloneTsConfig(), null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(projectPath, "remotion.config.ts"),
    buildStandaloneRemotionConfig(),
    "utf8"
  );
  await fs.writeFile(path.join(srcDir, "index.ts"), buildStandaloneEntry(), "utf8");
  await fs.writeFile(
    path.join(srcDir, "Root.tsx"),
    buildStandaloneRoot(spec, metadata),
    "utf8"
  );
  await fs.writeFile(
    path.join(srcDir, "video-spec.ts"),
    `export const videoSpec = ${JSON.stringify(spec, null, 2)} as const;\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(dataDir, "video-spec.json"),
    `${JSON.stringify(spec, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(dataDir, "props.json"),
    `${JSON.stringify(
      {
        videoSpec: spec,
        router: {
          generatedBy: "michibiki",
          generatedAt: new Date().toISOString(),
          remotionMode: "standalone"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(projectPath, "app.meta.json"),
    `${JSON.stringify(
      {
        title: spec.title,
        description: spec.goal,
        tags: ["michibiki", "remotion", "standalone", spec.format.aspectRatio],
        category: "michibiki",
        michibiki: {
          specId: spec.id,
          appName: metadata.appName,
          compositionId: metadata.compositionId,
          durationInFrames: metadata.durationInFrames,
          remotionMode: "standalone"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function buildStandalonePackageJson(spec: VideoSpec): Record<string, unknown> {
  return {
    name: slugify(spec.title || "michibiki-remotion-video"),
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      studio: "remotion studio src/index.ts",
      dev: "remotion studio src/index.ts",
      render: "remotion render src/index.ts Main out/output.mp4"
    },
    dependencies: {
      "@remotion/cli": REMOTION_VERSION,
      "@remotion/renderer": REMOTION_VERSION,
      react: REACT_VERSION,
      "react-dom": REACT_VERSION,
      remotion: REMOTION_VERSION
    },
    devDependencies: {
      "@types/react": REACT_TYPES_VERSION,
      "@types/react-dom": REACT_DOM_TYPES_VERSION,
      typescript: TYPESCRIPT_VERSION
    }
  };
}

function buildStandaloneTsConfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true
    },
    include: ["src", "remotion.config.ts"]
  };
}

function buildStandaloneRemotionConfig(): string {
  return [
    'import { Config } from "@remotion/cli/config";',
    "",
    'Config.setVideoImageFormat("jpeg");',
    'Config.setOverwriteOutput(true);',
    ""
  ].join("\n");
}

function buildStandaloneEntry(): string {
  return [
    'import { registerRoot } from "remotion";',
    'import { RemotionRoot } from "./Root";',
    "",
    "registerRoot(RemotionRoot);",
    ""
  ].join("\n");
}

function buildStandaloneRoot(
  spec: VideoSpec,
  metadata: { compositionId: string; durationInFrames: number }
): string {
  const scenes = (spec.content.scenes ?? []).map((scene) => ({
    label: `Scene ${scene.order}`,
    text: scene.text ?? scene.description
  }));
  const fallbackScenes =
    scenes.length > 0
      ? scenes
      : [
          {
            label: "Scene 1",
            text: spec.goal
          }
        ];

  return [
    'import { AbsoluteFill, Composition, interpolate, useCurrentFrame } from "remotion";',
    'import { videoSpec } from "./video-spec";',
    "",
    `const WIDTH = ${spec.format.width};`,
    `const HEIGHT = ${spec.format.height};`,
    `const FPS = ${spec.format.fps};`,
    `const DURATION = ${metadata.durationInFrames};`,
    `const CTA = ${JSON.stringify(spec.content.cta ?? spec.format.aspectRatio)};`,
    `const scenes = ${JSON.stringify(fallbackScenes, null, 2)} as const;`,
    "const fallbackScene = { label: \"Scene 1\", text: videoSpec.goal };",
    "",
    "function MainVideo() {",
    "  const frame = useCurrentFrame();",
    "  const progress = frame / Math.max(1, DURATION - 1);",
    "  const activeIndex = Math.min(",
    "    scenes.length - 1,",
    "    Math.floor(progress * scenes.length)",
    "  );",
    "  const activeScene = scenes[activeIndex] ?? fallbackScene;",
    "  const reveal = interpolate(frame, [0, Math.min(24, DURATION)], [0, 1], {",
    '    extrapolateRight: "clamp"',
    "  });",
    "  const slide = interpolate(progress, [0, 1], [24, -24]);",
    "",
    "  return (",
    "    <AbsoluteFill",
    "      style={{",
    '        background: "linear-gradient(135deg, #111827 0%, #2563eb 52%, #f8fafc 100%)",',
    '        color: "white",',
    '        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",',
    '        overflow: "hidden"',
    "      }}",
    "    >",
    "      <div",
    "        style={{",
    '          position: "absolute",',
    '          inset: "7%",',
    '          display: "flex",',
    '          flexDirection: "column",',
    '          justifyContent: "space-between",',
    "          opacity: reveal,",
    '          transform: `translateY(${(1 - reveal) * 24}px)`',
    "        }}",
    "      >",
    "        <div",
    "          style={{",
    '            fontSize: 24,',
    '            letterSpacing: 0,',
    '            opacity: 0.78,',
    '            textTransform: "uppercase"',
    "          }}",
    "        >",
    "          Michibiki / Standalone Remotion",
    "        </div>",
    "        <div>",
    "          <div",
    "            style={{",
    '              fontSize: Math.max(58, WIDTH * 0.055),',
    "              fontWeight: 800,",
    "              lineHeight: 0.95,",
    '              letterSpacing: 0,',
    "              maxWidth: WIDTH * 0.72",
    "            }}",
    "          >",
    "            {videoSpec.title}",
    "          </div>",
    "          <div",
    "            style={{",
    '              marginTop: 34,',
    '              fontSize: Math.max(30, WIDTH * 0.025),',
    '              lineHeight: 1.22,',
    "              maxWidth: WIDTH * 0.68,",
    "              opacity: 0.9,",
    '              transform: `translateX(${slide}px)`',
    "            }}",
    "          >",
    "            {activeScene.text}",
    "          </div>",
    "        </div>",
    "        <div",
    "          style={{",
    '            display: "flex",',
    '            alignItems: "center",',
    '            justifyContent: "space-between",',
    '            gap: 32,',
    '            fontSize: 28',
    "          }}",
    "        >",
    "          <span>{activeScene.label}</span>",
    "          <span>{CTA}</span>",
    "        </div>",
    "      </div>",
    "    </AbsoluteFill>",
    "  );",
    "}",
    "",
    "export function RemotionRoot() {",
    "  return (",
    "    <Composition",
    `      id=${JSON.stringify(metadata.compositionId)}`,
    "      component={MainVideo}",
    "      durationInFrames={DURATION}",
    "      fps={FPS}",
    "      width={WIDTH}",
    "      height={HEIGHT}",
    "    />",
    "  );",
    "}",
    ""
  ].join("\n");
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

function resolveRemotionProjectMode(context: {
  remotionRepoPath: string;
  remotionMode: RemotionProjectMode;
  hasExplicitRemotionRepoPath: boolean;
}): ResolvedRemotionProjectMode {
  if (context.remotionMode === "standalone") return "standalone";
  if (
    context.remotionMode === "monorepo" ||
    context.hasExplicitRemotionRepoPath
  ) {
    return "monorepo";
  }

  return existsSync(path.join(context.remotionRepoPath, "package.json"))
    ? "monorepo"
    : "standalone";
}

function isStandaloneRemotionProject(project: GeneratedProject): boolean {
  return getStringMetadata(project, "remotionMode") === "standalone";
}

function createAppName(spec: VideoSpec): string {
  const slug = slugify(spec.title || "michibiki");
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

  return normalized.length > 0 ? normalized.slice(0, 40) : "michibiki";
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

function combineCommandResults(results: CommandResult[]): CommandResult {
  const last = results.at(-1);
  return {
    code: results.find((result) => result.code !== 0)?.code ?? last?.code ?? 0,
    stdout: results.map((result) => result.stdout).join("\n"),
    stderr: results.map((result) => result.stderr).join("\n"),
    command: results.map((result) => result.command).join(" && ")
  };
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
