import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { renderBrowserVideo } from "@video-router/browser-renderer";
import { validateLicense } from "@video-router/compliance";
import type {
  GeneratedProject,
  GenerateProjectContext,
  PreviewResult,
  RenderContext,
  RenderResult,
  VideoEngine,
  VideoSpec
} from "@video-router/video-spec";

export function createHyperFramesEngine(): VideoEngine {
  return {
    name: "hyperframes",
    canHandle: (spec) => canHyperFramesHandle(spec),
    generateProject: (spec, context) => generateHyperFramesProject(spec, context),
    preview: (project) =>
      Promise.resolve({
        ok: true,
        projectId: project.id,
        url: path.join(project.rootPath, "index.html"),
        message: "Open index.html in a browser to preview the HyperFrames draft."
      }),
    render: (project, context) => renderHyperFramesProject(project, context),
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
  context: GenerateProjectContext = {}
): Promise<GeneratedProject> {
  const projectId = `project_${randomUUID()}`;
  const projectName = createProjectName(spec);
  const projectRoot = context.outputDir
    ? path.join(context.outputDir, "project", "hyperframes")
    : path.resolve("outputs", "hyperframes", projectName);

  await fs.mkdir(projectRoot, { recursive: true });

  const files = {
    "video-spec.json": `${JSON.stringify(spec, null, 2)}\n`,
    "index.html": buildHtml(spec),
    "styles.css": buildCss(spec),
    "motion.js": buildMotionJs(spec),
    "README.md": buildReadme(spec)
  };

  for (const [fileName, content] of Object.entries(files)) {
    await fs.writeFile(path.join(projectRoot, fileName), content, "utf8");
  }

  const manifest = {
    id: projectId,
    engine: "hyperframes",
    projectName,
    projectPath: projectRoot,
    entry: path.join(projectRoot, "index.html"),
    renderStatus: "local-render-ready",
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
    `Generated HyperFrames project at ${projectRoot}\n`
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

function buildHtml(spec: VideoSpec): string {
  const scenes = spec.content.scenes ?? [];
  const sceneMarkup = scenes
    .map(
      (scene) => `<section class="scene" data-duration="${scene.durationSec}">
  <p class="scene-kicker">Scene ${scene.order}</p>
  <h2>${escapeHtml(scene.text ?? scene.description)}</h2>
  <p>${escapeHtml(scene.motion ?? "DOM motion")}</p>
</section>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(spec.title)}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body data-aspect="${spec.format.aspectRatio}">
  <main class="stage">
    <section class="hero">
      <p class="eyebrow">HyperFrames Draft</p>
      <h1>${escapeHtml(spec.title)}</h1>
      <p class="goal">${escapeHtml(spec.goal)}</p>
      ${spec.content.cta ? `<strong class="cta">${escapeHtml(spec.content.cta)}</strong>` : ""}
    </section>
    ${sceneMarkup}
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
}

.scene {
  opacity: 0;
  transform: translateY(42px) scale(0.98);
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
  const durationMs = spec.format.durationSec * 1000;

  return `const scenes = [...document.querySelectorAll(".scene")];
const hero = document.querySelector(".hero");
const duration = ${durationMs};
const sceneDuration = duration / Math.max(1, scenes.length + 1);

function renderAt(now) {
  const t = now % duration;
  const heroProgress = Math.min(1, t / sceneDuration);
  if (hero) {
    hero.style.opacity = String(Math.max(0, 1 - heroProgress * 1.2));
    hero.style.transform = \`translateY(\${-heroProgress * 36}px)\`;
  }

  scenes.forEach((scene, index) => {
    const local = (t - sceneDuration * (index + 1)) / sceneDuration;
    const visible = local >= 0 && local <= 1;
    const eased = Math.max(0, Math.min(1, local));
    scene.style.opacity = visible ? String(1 - Math.abs(eased - 0.5) * 1.5) : "0";
    scene.style.transform = \`translateY(\${(1 - eased) * 42}px) scale(\${0.98 + eased * 0.02})\`;
  });
}

function tick(now) {
  renderAt(now);

  requestAnimationFrame(tick);
}

const params = new URLSearchParams(window.location.search);
const frameParam = params.get("frame");
const fpsParam = Number(params.get("fps") || "${spec.format.fps}");

if (frameParam !== null) {
  const frame = Number(frameParam);
  const fps = Number.isFinite(fpsParam) && fpsParam > 0 ? fpsParam : ${spec.format.fps};
  renderAt((Number.isFinite(frame) ? frame : 0) * 1000 / fps);
  document.documentElement.dataset.videoRouterFrame = String(frame);
} else {
  requestAnimationFrame(tick);
}
`;
}

function buildReadme(spec: VideoSpec): string {
  return `# ${spec.title}

Generated by Video Router Agent's HyperFrames adapter.

- Aspect ratio: ${spec.format.aspectRatio}
- Size: ${spec.format.width}x${spec.format.height}
- FPS target: ${spec.format.fps}
- Duration: ${spec.format.durationSec}s

Open \`index.html\` to preview the DOM/CSS/JS motion draft.
`;
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
