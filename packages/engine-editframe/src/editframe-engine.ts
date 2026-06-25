import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { renderBrowserVideo } from "@michibiki/browser-renderer";
import { validateLicense } from "@michibiki/compliance";
import {
  slugify,
  type AssetSpec,
  type GeneratedProject,
  type GenerateProjectContext,
  type PreviewResult,
  type RenderContext,
  type RenderResult,
  type SceneSpec,
  type VideoEngine,
  type VideoSpec
} from "@michibiki/video-spec";
import { EDITFRAME_PACKAGE_VERSIONS } from "./editframe-versions.js";

export type TimelineClip = {
  id: string;
  type: "video" | "audio" | "image" | "text" | "subtitle" | "data";
  source?: string;
  text?: string;
  startSec: number;
  durationSec: number;
  layer: number;
  role?: "primary" | "insert" | "bed" | "caption" | "overlay";
  fit?: "cover" | "contain";
  transition?: "cut" | "crossfade" | "pop";
  layout?: "full-frame" | "picture-in-picture";
};

export type EditframeTimeline = {
  id: string;
  title: string;
  format: VideoSpec["format"];
  clips: TimelineClip[];
  notes: string[];
};

export function createEditframeEngine(): VideoEngine {
  return {
    name: "editframe",
    canHandle: (spec) => canEditframeHandle(spec),
    generateProject: (spec, context) => generateEditframeProject(spec, context),
    preview: (project) =>
      Promise.resolve({
        ok: true,
        projectId: project.id,
        url: path.join(project.rootPath, "preview.html"),
        message: "Open preview.html to inspect the Editframe timeline draft."
      }),
    render: (project, context) => renderEditframeProject(project, context),
    validateLicense: (context) =>
      Promise.resolve(validateLicense("editframe", context))
  };
}

export function canEditframeHandle(spec: VideoSpec): boolean {
  const preference = spec.constraints.enginePreference ?? "auto";
  if (preference === "editframe") return true;
  if (preference !== "auto") return false;

  return (
    spec.assets.some((asset) => asset.type === "video" || asset.type === "audio") ||
    /(timeline|タイムライン|字幕|caption|b-roll|broll|カット編集|vlog|素材|音声|voice)/i.test(
      [spec.title, spec.goal, spec.style.motionStyle, spec.style.visualTone].join(" ")
    )
  );
}

export function buildEditframeTimeline(spec: VideoSpec): EditframeTimeline {
  const scenes = spec.content.scenes ?? [
    {
      id: "scene_1",
      order: 1,
      durationSec: spec.format.durationSec,
      description: spec.goal
    }
  ];
  const sceneClips = buildSceneTextClips(scenes);
  const assetClips = buildAssetTimelineClips(spec.assets, spec.format.durationSec);
  const motionOverlayClips = buildMotionOverlayClips(spec);
  const ctaClip = spec.content.cta
    ? [
        {
          id: "clip_cta",
          type: "text" as const,
          text: spec.content.cta,
          startSec: Math.max(0, spec.format.durationSec - 4),
          durationSec: Math.min(4, spec.format.durationSec),
          layer: 20,
          role: "caption" as const
        }
      ]
    : [];

  return {
    id: `timeline_${randomUUID()}`,
    title: spec.title,
    format: spec.format,
    clips: [...assetClips, ...sceneClips, ...motionOverlayClips, ...ctaClip].sort(
      (a, b) => a.startSec - b.startSec || a.layer - b.layer
    ),
    notes: [
      "This is an Editframe-compatible timeline draft generated from VideoSpec.",
      "Wire this JSON into the real Editframe SDK/CLI in the next integration step."
    ]
  };
}

async function generateEditframeProject(
  spec: VideoSpec,
  context: GenerateProjectContext = {}
): Promise<GeneratedProject> {
  const projectId = `project_${randomUUID()}`;
  const projectName = createProjectName(spec);
  const projectRoot = context.outputDir
    ? path.join(context.outputDir, "project", "editframe")
    : path.resolve("outputs", "editframe", projectName);
  const timeline = buildEditframeTimeline(spec);

  await fs.mkdir(projectRoot, { recursive: true });

  const files = {
    "video-spec.json": `${JSON.stringify(spec, null, 2)}\n`,
    "timeline.json": `${JSON.stringify(timeline, null, 2)}\n`,
    "package.json": buildPackageJson(projectName),
    "preview.html": buildPreviewHtml(spec, timeline),
    "README.md": buildReadme(spec)
  };

  for (const [fileName, content] of Object.entries(files)) {
    await fs.writeFile(path.join(projectRoot, fileName), content, "utf8");
  }

  const manifest = {
    id: projectId,
    engine: "editframe",
    projectName,
    projectPath: projectRoot,
    timelinePath: path.join(projectRoot, "timeline.json"),
    editframePackages: EDITFRAME_PACKAGE_VERSIONS,
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
    `Generated Editframe timeline project at ${projectRoot}\n`
  );

  return {
    id: projectId,
    engine: "editframe",
    name: projectName,
    rootPath: projectRoot,
    files: Object.keys(files).map((fileName) => path.join(projectRoot, fileName)),
    metadata: manifest
  };
}

async function renderEditframeProject(
  project: GeneratedProject,
  context: RenderContext = {}
): Promise<RenderResult> {
  const renderDir = context.outputDir
    ? path.join(context.outputDir, "render")
    : path.join(project.rootPath, "render");
  const timeline = await readTimeline(project.rootPath);

  const renderResult = await renderBrowserVideo({
    entryFile: path.join(project.rootPath, "preview.html"),
    renderDir,
    width: timeline.format.width,
    height: timeline.format.height,
    fps: timeline.format.fps,
    durationSec: timeline.format.durationSec,
    logLabel: "Editframe timeline",
    extraQuery: { render: "1" }
  });
  await writeLog(context.logDir, "render.log", renderResult.log);

  return {
    ok: renderResult.ok,
    projectId: project.id,
    outputPath: renderResult.outputPath,
    command: renderResult.command,
    logs: renderResult.log,
    message: renderResult.ok
      ? "Editframe render completed."
      : "Editframe render failed. Inspect logs/render.log."
  };
}

function buildSceneTextClips(scenes: SceneSpec[]): TimelineClip[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const clip: TimelineClip = {
      id: `clip_${scene.id}`,
      type: "text",
      text: scene.text ?? scene.description,
      startSec: cursor,
      durationSec: scene.durationSec,
      layer: 10,
      role: "caption"
    };
    cursor += scene.durationSec;
    return clip;
  });
}

function buildAssetTimelineClips(
  assets: AssetSpec[],
  totalDurationSec: number
): TimelineClip[] {
  const audioAndSubtitleClips = assets.flatMap((asset, index) => {
    if (asset.type === "audio") {
      return [buildFullDurationAssetClip(asset, index, totalDurationSec, "audio")];
    }
    if (asset.type === "subtitle") {
      return [
        buildFullDurationAssetClip(asset, index, totalDurationSec, "subtitle")
      ];
    }
    return [];
  });
  const visualAssets = assets
    .map((asset, index) => ({ asset, index }))
    .filter(({ asset }) => asset.type !== "audio" && asset.type !== "subtitle");

  if (visualAssets.length <= 1) {
    return [
      ...audioAndSubtitleClips,
      ...visualAssets.flatMap(({ asset, index }) =>
        buildFullDurationAssetClip(
          asset,
          index,
          totalDurationSec,
          toTimelineClipType(asset)
        )
      )
    ];
  }

  const primaryDurationSec = roundSeconds(totalDurationSec / visualAssets.length);
  const primaryClips = visualAssets.map(({ asset, index }, visualIndex) => {
    const startSec = roundSeconds(visualIndex * primaryDurationSec);
    const durationSec =
      visualIndex === visualAssets.length - 1
        ? roundSeconds(totalDurationSec - startSec)
        : primaryDurationSec;
    return {
      ...buildBaseAssetClip(asset, index, startSec, durationSec),
      id: `clip_asset_${index + 1}_primary`,
      type: toTimelineClipType(asset),
      layer: 0,
      role: "primary" as const,
      fit: "cover" as const,
      layout: "full-frame" as const,
      transition: visualIndex === 0 ? "cut" as const : "crossfade" as const
    };
  });
  const insertClips = visualAssets.map((_, visualIndex) => {
    const source = visualAssets[(visualIndex + 1) % visualAssets.length]!;
    const primary = primaryClips[visualIndex]!;
    const insertStartSec = roundSeconds(
      Math.min(
        totalDurationSec - 0.5,
        primary.startSec + primary.durationSec * 0.58
      )
    );
    const insertDurationSec = roundSeconds(
      Math.min(
        2,
        Math.max(1, primary.durationSec * 0.3),
        totalDurationSec - insertStartSec
      )
    );
    return {
      ...buildBaseAssetClip(
        source.asset,
        source.index,
        insertStartSec,
        insertDurationSec
      ),
      id: `clip_asset_${source.index + 1}_insert_${visualIndex + 1}`,
      type: toTimelineClipType(source.asset),
      layer: 5,
      role: "insert" as const,
      fit: "contain" as const,
      layout: "picture-in-picture" as const,
      transition: "pop" as const
    };
  });

  return [...audioAndSubtitleClips, ...primaryClips, ...insertClips];
}

function buildFullDurationAssetClip(
  asset: AssetSpec,
  index: number,
  totalDurationSec: number,
  type: TimelineClip["type"]
): TimelineClip {
  const base = buildBaseAssetClip(asset, index, 0, totalDurationSec);
  if (type === "audio") {
    return { ...base, type, layer: -10, role: "bed" };
  }
  if (type === "subtitle") {
    return { ...base, type, layer: 30, role: "caption" };
  }
  return {
    ...base,
    type,
    layer: index,
    role: "primary",
    fit: type === "data" ? undefined : "cover",
    layout: type === "data" ? undefined : "full-frame"
  };
}

function buildBaseAssetClip(
  asset: AssetSpec,
  index: number,
  startSec: number,
  durationSec: number
): Omit<TimelineClip, "type"> {
  const base = {
    id: `clip_asset_${index + 1}`,
    source: asset.source,
    startSec,
    durationSec,
    layer: index
  };

  return base;
}

function toTimelineClipType(asset: AssetSpec): TimelineClip["type"] {
  if (
    asset.type === "video" ||
    asset.type === "audio" ||
    asset.type === "image" ||
    asset.type === "subtitle"
  ) {
    return asset.type;
  }
  return "data";
}

function buildMotionOverlayClips(spec: VideoSpec): TimelineClip[] {
  if (!/(手書き|ライン|線|星|スター|スピード|speed|line|star)/i.test(spec.goal)) {
    return [];
  }
  const beats = [0.15, 0.5, 0.82];
  return beats.map((beat, index) => ({
    id: `clip_motion_overlay_${index + 1}`,
    type: "text",
    text:
      index === 0
        ? "white hand-drawn line"
        : index === 1
          ? "speed accent"
          : "star pop",
    startSec: roundSeconds(spec.format.durationSec * beat),
    durationSec: Math.min(1.6, Math.max(0.8, spec.format.durationSec * 0.12)),
    layer: 25,
    role: "overlay",
    transition: "pop"
  }));
}

function roundSeconds(value: number): number {
  return Math.max(0, Math.round(value * 10) / 10);
}

function buildPreviewHtml(spec: VideoSpec, timeline: EditframeTimeline): string {
  const previewCopy = buildPreviewCopy(spec, timeline);
  const clips = timeline.clips
    .map(
      (clip) => `<li>
  <strong>${escapeHtml(clip.type)}</strong>
  <span>${clip.startSec}s - ${clip.startSec + clip.durationSec}s</span>
  <p>${escapeHtml(clip.text ?? clip.source ?? clip.id)}</p>
</li>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(spec.title)} Timeline</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f1117;
      --panel: #171b23;
      --fg: #f7f0e6;
      --muted: #aeb8c2;
      --accent: #7dd3fc;
      --sharp: #fbbf24;
      --rule: rgba(247, 240, 230, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Avenir Next", "Hiragino Sans", "Yu Gothic", ui-sans-serif, system-ui, sans-serif;
      background: #090b10;
      color: var(--fg);
    }
    .stage {
      position: relative;
      width: min(100vw, ${spec.format.width}px);
      aspect-ratio: ${spec.format.width} / ${spec.format.height};
      min-height: min(100vh, ${spec.format.height}px);
      overflow: hidden;
      container-type: inline-size;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,0.035) 1px, transparent 1px),
        linear-gradient(135deg, rgba(125, 211, 252, 0.22), transparent 36%),
        linear-gradient(315deg, rgba(251, 191, 36, 0.18), transparent 40%),
        var(--bg);
      background-size: 72px 72px, 72px 72px, auto, auto, auto;
    }
    .stage::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(115deg, transparent 0 40%, rgba(247, 240, 230, 0.1) 41%, transparent 52% 100%);
      pointer-events: none;
    }
    .stage-content {
      position: absolute;
      inset: 0;
      display: grid;
      align-content: center;
      gap: 18px;
      padding: 7%;
    }
    .kicker {
      color: var(--accent);
      font-size: clamp(12px, 1.4cqw, 18px);
      font-weight: 800;
      text-transform: uppercase;
    }
    .stage h2 {
      margin: 0;
      max-width: 18ch;
      font-size: clamp(40px, 7.8cqw, 112px);
      line-height: 0.94;
    }
    .stage p {
      margin: 0;
      max-width: 38ch;
      color: var(--muted);
      font-size: clamp(18px, 2.2cqw, 30px);
      line-height: 1.35;
      font-weight: 700;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      max-width: 72ch;
    }
    .pill {
      border: 1px solid var(--rule);
      padding: 8px 11px;
      background: rgba(23, 27, 35, 0.74);
      color: var(--fg);
      font-size: clamp(12px, 1.25cqw, 17px);
    }
    .asset-strip {
      position: absolute;
      left: 7%;
      right: 7%;
      bottom: 7%;
      display: grid;
      gap: 8px;
    }
    .asset-row {
      height: 12px;
      border: 1px solid var(--rule);
      background: rgba(255,255,255,0.08);
    }
    .asset-row.active { background: var(--accent); box-shadow: 0 0 28px rgba(125,211,252,0.42); }
    .playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--sharp);
      box-shadow: 0 0 18px rgba(251,191,36,0.85);
    }
    body[data-render="1"] main { display: none; }
    main { width: min(960px, calc(100vw - 32px)); margin: 40px auto; }
    h1 { font-size: 40px; line-height: 1; }
    .meta { color: var(--muted); }
    ol { display: grid; gap: 12px; padding: 0; list-style: none; }
    li { border: 1px solid var(--rule); padding: 16px; background: var(--panel); }
    span { color: var(--accent); margin-left: 8px; }
    p { margin-bottom: 0; color: #ddd; }
  </style>
</head>
<body>
  <section class="stage" aria-label="timeline preview">
    <div class="stage-content">
      <div class="kicker">Editframe Timeline</div>
      <h2 id="active-title">${escapeHtml(spec.title)}</h2>
      <p id="active-body">${escapeHtml(previewCopy.hook)}</p>
      <div class="pill-row" aria-label="timeline status">
        ${previewCopy.pills.map((pill) => `<span class="pill">${escapeHtml(pill)}</span>`).join("")}
      </div>
    </div>
    <div class="asset-strip" id="asset-strip"></div>
    <div class="playhead" id="playhead"></div>
  </section>
  <main>
    <h1>${escapeHtml(spec.title)}</h1>
    <p class="meta">${spec.format.width}x${spec.format.height} / ${spec.format.durationSec}s / ${spec.format.fps}fps</p>
    <ol>${clips}</ol>
  </main>
  <script>
    const timeline = ${JSON.stringify(timeline)};
    const title = document.getElementById("active-title");
    const body = document.getElementById("active-body");
    const strip = document.getElementById("asset-strip");
    const playhead = document.getElementById("playhead");
    const visualClips = timeline.clips.filter((clip) => clip.type !== "audio");
    const rows = visualClips.map((clip) => {
      const row = document.createElement("div");
      row.className = "asset-row";
      row.dataset.clipId = clip.id;
      strip.appendChild(row);
      return { clip, row };
    });

    function renderAt(seconds) {
      const active = visualClips
        .filter((clip) => seconds >= clip.startSec && seconds <= clip.startSec + clip.durationSec)
        .sort((a, b) => b.layer - a.layer)[0];
      if (active) {
        title.textContent = active.role === "caption" ? "Caption" : active.type.charAt(0).toUpperCase() + active.type.slice(1);
        body.textContent = active.text || active.source || active.id;
      } else {
        title.textContent = timeline.title;
        body.textContent = ${JSON.stringify(previewCopy.hook)};
      }
      for (const { clip, row } of rows) {
        row.classList.toggle("active", seconds >= clip.startSec && seconds <= clip.startSec + clip.durationSec);
      }
      const progress = Math.max(0, Math.min(1, seconds / timeline.format.durationSec));
      playhead.style.left = \`\${progress * 100}%\`;
    }

    function tick(now) {
      renderAt((now / 1000) % timeline.format.durationSec);
      requestAnimationFrame(tick);
    }

    const params = new URLSearchParams(window.location.search);
    const frameParam = params.get("frame");
    const fps = Number(params.get("fps") || timeline.format.fps);
    if (params.get("render") === "1") {
      document.body.dataset.render = "1";
    }
    if (frameParam !== null) {
      const frame = Number(frameParam);
      renderAt((Number.isFinite(frame) ? frame : 0) / (Number.isFinite(fps) && fps > 0 ? fps : timeline.format.fps));
      document.documentElement.dataset.videoRouterFrame = String(frame);
    } else {
      requestAnimationFrame(tick);
    }
  </script>
</body>
</html>
`;
}

function buildPreviewCopy(
  spec: VideoSpec,
  timeline: EditframeTimeline
): { hook: string; pills: string[] } {
  const captions = (
    spec.content.captions ??
    spec.content.scenes?.map((scene) => scene.text ?? scene.description) ??
    []
  )
    .map((caption) => caption.trim())
    .filter(Boolean);
  const visualClipCount = timeline.clips.filter((clip) => clip.type !== "audio")
    .length;
  const audioClipCount = timeline.clips.filter((clip) => clip.type === "audio")
    .length;

  return {
    hook: truncateCopy(captions[0] ?? spec.content.script?.split("\n")[0] ?? spec.title, 46),
    pills: [
      `${spec.format.durationSec}s`,
      spec.format.aspectRatio,
      `${visualClipCount} visual clips`,
      `${audioClipCount} audio clips`
    ]
  };
}

function truncateCopy(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function buildReadme(spec: VideoSpec): string {
  return `# ${spec.title}

Generated by Michibiki's Editframe adapter.

- Aspect ratio: ${spec.format.aspectRatio}
- Size: ${spec.format.width}x${spec.format.height}
- FPS target: ${spec.format.fps}
- Duration: ${spec.format.durationSec}s

Use \`timeline.json\` as the handoff file for the real Editframe SDK/CLI integration.
The generated \`package.json\` pins the current official Editframe package baseline:

${Object.entries(EDITFRAME_PACKAGE_VERSIONS)
  .map(([name, version]) => `- \`${name}\`: \`${version}\``)
  .join("\n")}

When rendered through Michibiki, this project also produces \`render/output.mp4\`.
`;
}

function buildPackageJson(projectName: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      private: true,
      type: "module",
      scripts: {
        editframe: "editframe"
      },
      dependencies: EDITFRAME_PACKAGE_VERSIONS
    },
    null,
    2
  )}\n`;
}

function createProjectName(spec: VideoSpec): string {
  return `editframe-${slugify(spec.title)}-${Date.now()}`;
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

async function readTimeline(projectRoot: string): Promise<EditframeTimeline> {
  const timelinePath = path.join(projectRoot, "timeline.json");
  return JSON.parse(await fs.readFile(timelinePath, "utf8")) as EditframeTimeline;
}
