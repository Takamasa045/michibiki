import type { VideoSpec } from "@michibiki/video-spec";
import type { HtmlInCanvasRegistryBlock } from "./registry.js";

// HTML/CSS/JS/README emitters for the generated HyperFrames draft project.

export function buildHtml(spec: VideoSpec): string {
  const scenes = spec.content.scenes ?? [];
  const previewCopy = buildPreviewCopy(spec);
  const sceneMarkup = scenes
    .map(
      (scene) => `<section class="scene">
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
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
</head>
<body data-aspect="${spec.format.aspectRatio}">
  <main id="root" class="stage" data-composition-id="root" data-start="0" data-duration="${spec.format.durationSec}" data-width="${spec.format.width}" data-height="${spec.format.height}" data-track-index="0">
    <div class="status-bar" aria-label="draft status">
      <span>HyperFrames draft</span>
      <span>${previewCopy.status.join(" · ")}</span>
    </div>
    <section class="hero">
      <h1>${escapeHtml(spec.title)}</h1>
      <p class="hook">${escapeHtml(previewCopy.hook)}</p>
      ${previewCopy.cues.length > 0 ? `<ul class="cue-list">${previewCopy.cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")}</ul>` : ""}
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

export function buildCss(spec: VideoSpec): string {
  const width = spec.format.width;
  const height = spec.format.height;

  return `:root {
  color-scheme: dark;
  --bg: #101217;
  --panel: #171c22;
  --fg: #f6f1e8;
  --muted: #b7c0c8;
  --accent: #33d6a6;
  --sharp: #f2b84b;
  --rule: rgba(246, 241, 232, 0.14);
  font-family: "Avenir Next", "Hiragino Sans", "Yu Gothic", ui-sans-serif, system-ui, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #080a0d;
  color: var(--fg);
}

.stage {
  position: relative;
  width: min(100vw, ${width}px);
  aspect-ratio: ${width} / ${height};
  min-height: min(100vh, ${height}px);
  overflow: hidden;
  container-type: inline-size;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,255,255,0.035) 1px, transparent 1px),
    linear-gradient(135deg, rgba(51, 214, 166, 0.2), transparent 34%),
    linear-gradient(315deg, rgba(242, 184, 75, 0.18), transparent 42%),
    var(--bg);
  background-size: 74px 74px, 74px 74px, auto, auto, auto;
}

.stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 0 44%, rgba(246, 241, 232, 0.1) 45%, transparent 54% 100%);
  mix-blend-mode: screen;
  opacity: 0.72;
  pointer-events: none;
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

.status-bar {
  position: absolute;
  left: 7%;
  right: 7%;
  top: 6%;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  color: var(--muted);
  font-size: clamp(12px, 1.35cqw, 18px);
  font-weight: 700;
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

.eyebrow,
.scene-kicker {
  color: var(--accent);
  font-size: clamp(12px, 1.4cqw, 18px);
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
  font-size: clamp(44px, 8.5cqw, 118px);
  line-height: 0.94;
}

h2 {
  max-width: 18ch;
  font-size: clamp(30px, 5.6cqw, 76px);
  line-height: 1;
}

.hook {
  max-width: 32ch;
  color: var(--muted);
  font-size: clamp(18px, 2.4cqw, 32px);
  line-height: 1.35;
  font-weight: 700;
}

.cue-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 68ch;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.cue-list li {
  border: 1px solid var(--rule);
  padding: 8px 11px;
  background: rgba(23, 28, 34, 0.72);
  color: var(--fg);
  font-size: clamp(12px, 1.35cqw, 18px);
}

.cta {
  width: fit-content;
  border: 1px solid rgba(242, 184, 75, 0.75);
  padding: 12px 18px;
  color: #120f08;
  background: var(--sharp);
  box-shadow: 0 18px 60px rgba(242, 184, 75, 0.18);
}
`;
}

export function buildMotionJs(spec: VideoSpec): string {
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
if (panels[0]) {
  gsap.set(panels[0], { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" });
}

const tl = gsap.timeline({ paused: true });

panels.forEach((panel, index) => {
  const pad = Math.min(0.22, panelDuration * 0.04);
  const start = index * panelDuration + pad;
  const end = (index + 1) * panelDuration - pad;
  const holdEnd = Math.max(start + 0.9, end - 0.48);

  if (index === 0) {
    tl.set(panel, { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }, 0);
  }
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

export function buildReadme(
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPreviewCopy(spec: VideoSpec): {
  hook: string;
  cues: string[];
  status: string[];
} {
  const captions = (
    spec.content.captions ??
    spec.content.scenes?.map((scene) => scene.text ?? scene.description) ??
    []
  )
    .map((caption) => caption.trim())
    .filter(Boolean);
  const hook = captions[0] ?? spec.content.script?.split("\n")[0] ?? spec.title;

  return {
    hook: truncateCopy(hook, 46),
    cues: captions.slice(1, 4).map((caption) => truncateCopy(caption, 34)),
    status: [
      `${spec.format.durationSec}s`,
      spec.format.aspectRatio,
      `${spec.format.fps}fps`
    ]
  };
}

function truncateCopy(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
