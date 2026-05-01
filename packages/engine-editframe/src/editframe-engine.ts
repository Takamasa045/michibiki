import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { renderBrowserVideo } from "@video-router/browser-renderer";
import { validateLicense } from "@video-router/compliance";
import type {
  AssetSpec,
  GeneratedProject,
  GenerateProjectContext,
  PreviewResult,
  RenderContext,
  RenderResult,
  SceneSpec,
  VideoEngine,
  VideoSpec
} from "@video-router/video-spec";

export type TimelineClip = {
  id: string;
  type: "video" | "audio" | "image" | "text" | "subtitle" | "data";
  source?: string;
  text?: string;
  startSec: number;
  durationSec: number;
  layer: number;
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
  const assetClips = spec.assets.flatMap((asset, index) =>
    buildAssetClips(asset, index, spec.format.durationSec)
  );
  const ctaClip = spec.content.cta
    ? [
        {
          id: "clip_cta",
          type: "text" as const,
          text: spec.content.cta,
          startSec: Math.max(0, spec.format.durationSec - 4),
          durationSec: Math.min(4, spec.format.durationSec),
          layer: 20
        }
      ]
    : [];

  return {
    id: `timeline_${randomUUID()}`,
    title: spec.title,
    format: spec.format,
    clips: [...assetClips, ...sceneClips, ...ctaClip].sort(
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
      layer: 10
    };
    cursor += scene.durationSec;
    return clip;
  });
}

function buildAssetClips(
  asset: AssetSpec,
  index: number,
  totalDurationSec: number
): TimelineClip[] {
  const base = {
    id: `clip_asset_${index + 1}`,
    source: asset.source,
    startSec: 0,
    durationSec: totalDurationSec,
    layer: index
  };

  if (asset.type === "video") {
    return [{ ...base, type: "video" }];
  }
  if (asset.type === "audio") {
    return [{ ...base, type: "audio", layer: -10 }];
  }
  if (asset.type === "image") {
    return [{ ...base, type: "image" }];
  }
  if (asset.type === "subtitle") {
    return [{ ...base, type: "subtitle", layer: 30 }];
  }

  return [{ ...base, type: "data" }];
}

function buildPreviewHtml(spec: VideoSpec, timeline: EditframeTimeline): string {
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
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #111; color: #f7f7f7; }
    .stage {
      position: relative;
      width: min(100vw, ${spec.format.width}px);
      aspect-ratio: ${spec.format.width} / ${spec.format.height};
      min-height: min(100vh, ${spec.format.height}px);
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(125, 211, 252, 0.22), transparent 36%),
        linear-gradient(315deg, rgba(244, 114, 182, 0.22), transparent 40%),
        #111827;
    }
    .stage-content {
      position: absolute;
      inset: 0;
      display: grid;
      align-content: center;
      gap: 18px;
      padding: 7%;
    }
    .kicker { color: #7dd3fc; font-weight: 800; text-transform: uppercase; }
    .stage h2 { margin: 0; max-width: 18ch; font-size: clamp(40px, 8vw, 112px); line-height: 0.94; }
    .stage p { margin: 0; max-width: 64ch; color: #d1d5db; font-size: clamp(16px, 2vw, 28px); line-height: 1.45; }
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
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.08);
    }
    .asset-row.active { background: #7dd3fc; box-shadow: 0 0 28px rgba(125,211,252,0.42); }
    .playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #fbbf24;
      box-shadow: 0 0 18px rgba(251,191,36,0.85);
    }
    body[data-render="1"] main { display: none; }
    main { width: min(960px, calc(100vw - 32px)); margin: 40px auto; }
    h1 { font-size: 40px; line-height: 1; }
    .meta { color: #aaa; }
    ol { display: grid; gap: 12px; padding: 0; list-style: none; }
    li { border: 1px solid #333; padding: 16px; background: #181818; }
    span { color: #7dd3fc; margin-left: 8px; }
    p { margin-bottom: 0; color: #ddd; }
  </style>
</head>
<body>
  <section class="stage" aria-label="timeline preview">
    <div class="stage-content">
      <div class="kicker">Editframe Timeline</div>
      <h2 id="active-title">${escapeHtml(spec.title)}</h2>
      <p id="active-body">${escapeHtml(spec.goal)}</p>
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
        title.textContent = active.type.toUpperCase();
        body.textContent = active.text || active.source || active.id;
      } else {
        title.textContent = timeline.title;
        body.textContent = "Timeline preview";
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

function buildReadme(spec: VideoSpec): string {
  return `# ${spec.title}

Generated by Michibiki's Editframe adapter.

- Aspect ratio: ${spec.format.aspectRatio}
- Size: ${spec.format.width}x${spec.format.height}
- FPS target: ${spec.format.fps}
- Duration: ${spec.format.durationSec}s

Use \`timeline.json\` as the handoff file for the real Editframe SDK/CLI integration.
When rendered through Michibiki, this project also produces \`render/output.mp4\`.
`;
}

function createProjectName(spec: VideoSpec): string {
  return `editframe-${slugify(spec.title)}-${Date.now()}`;
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

async function readTimeline(projectRoot: string): Promise<EditframeTimeline> {
  const timelinePath = path.join(projectRoot, "timeline.json");
  return JSON.parse(await fs.readFile(timelinePath, "utf8")) as EditframeTimeline;
}
