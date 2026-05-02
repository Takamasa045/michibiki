import type {
  EngineDecision,
  EngineName,
  EngineRecommendation,
  VideoSpec
} from "@michibiki/video-spec";

export function selectEngine(spec: VideoSpec): EngineDecision {
  const enginePreference = spec.constraints.enginePreference ?? "auto";
  if (enginePreference !== "auto") {
    return {
      engine: enginePreference,
      confidence: 1,
      reason: "User explicitly selected engine.",
      recommendation: buildEngineRecommendation(enginePreference, spec),
      licenseRisk: defaultLicenseRisk(enginePreference)
    };
  }

  const hasVideoOrAudioAssets = spec.assets.some(
    (asset) => asset.type === "video" || asset.type === "audio"
  );
  if (hasVideoOrAudioAssets || mentionsTimelineEditing(spec)) {
    return {
      engine: "editframe",
      confidence: 0.82,
      reason: "Video/audio asset editing workflow detected.",
      recommendation: buildEngineRecommendation("editframe", spec),
      licenseRisk: "medium",
      fallback: "remotion"
    };
  }

  const hasUrlAsset = spec.assets.some((asset) => asset.type === "url");
  if (hasUrlAsset || mentionsWebDomWorkflow(spec)) {
    return {
      engine: "hyperframes",
      confidence: 0.88,
      reason: "DOM/Web/URL based video request detected.",
      recommendation: buildEngineRecommendation("hyperframes", spec),
      licenseRisk: "low",
      fallback: "remotion"
    };
  }

  if (mentionsDataDrivenOrTemplateWorkflow(spec)) {
    return {
      engine: "remotion",
      confidence: 0.86,
      reason: "Template/data-driven motion graphics workflow detected.",
      recommendation: buildEngineRecommendation("remotion", spec),
      licenseRisk: "medium",
      fallback: "hyperframes"
    };
  }

  return {
    engine: "remotion",
    confidence: 0.75,
    reason: "Template-based motion graphics workflow is suitable.",
    recommendation: buildEngineRecommendation("remotion", spec),
    licenseRisk: "medium",
    fallback: "hyperframes"
  };
}

function defaultLicenseRisk(engine: EngineName): EngineDecision["licenseRisk"] {
  if (engine === "hyperframes") return "low";
  return "medium";
}

function normalizedSpecText(spec: VideoSpec): string {
  return [
    spec.title,
    spec.goal,
    spec.style.mood,
    spec.style.visualTone,
    spec.style.motionStyle,
    spec.content.script,
    spec.content.cta,
    ...(spec.content.captions ?? []),
    ...(spec.content.scenes?.map((scene) => scene.description) ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function mentionsTimelineEditing(spec: VideoSpec): boolean {
  return /(timeline|タイムライン|字幕|caption|b-roll|broll|カット編集|vlog|素材|音声|voice)/i.test(
    normalizedSpecText(spec)
  );
}

function mentionsWebDomWorkflow(spec: VideoSpec): boolean {
  return /(webサイト|website|landing page|ランディングページ|\blp\b|dom|html|css|javascript|gsap|スクロール|url)/i.test(
    normalizedSpecText(spec)
  );
}

function mentionsDataDrivenOrTemplateWorkflow(spec: VideoSpec): boolean {
  return /(react|remotion|テンプレート|template|json|csv|データ|data-driven|props|量産|自動レンダリング)/i.test(
    normalizedSpecText(spec)
  );
}

function buildEngineRecommendation(
  engine: EngineName,
  spec: VideoSpec
): EngineRecommendation {
  const format = `${spec.format.durationSec}-second ${spec.format.aspectRatio}`;
  const cta = spec.content.cta
    ? ` End with the "${spec.content.cta}" lockup.`
    : " End with a clear CTA or title lockup.";

  if (engine === "editframe") {
    return {
      summary:
        "Use Editframe when the request is really an edit: source footage, audio, captions, and timeline decisions matter most.",
      strengths: [
        "timeline-first editing for video/audio assets",
        "caption, voice, music, B-roll, and recap workflows",
        "timeline.json handoff that preserves media-editing intent"
      ],
      tradeoffs: [
        "current adapter is a timeline handoff and local preview, not the full Editframe SDK integration",
        "less efficient for pure template or data-driven motion graphics",
        "commercial, team, or cloud use depends on Editframe terms and plan requirements"
      ],
      creativeDirection: `Cut a ${format} timeline around the strongest source clip, then layer voice/music, captions, B-roll beats, and a final title card.${cta}`
    };
  }

  if (engine === "hyperframes") {
    return {
      summary:
        "Use HyperFrames when the video should feel like a web page becoming motion: DOM, CSS, JavaScript, URLs, and LP structure are the source material.",
      strengths: [
        "DOM/CSS/JavaScript motion from URL, LP, and Web UI content",
        "fast local browser preview and MP4 rendering path",
        "low license-risk path for browser-native drafts"
      ],
      tradeoffs: [
        "draft adapter output is HTML/CSS/JS and does not bundle the official HyperFrames SDK",
        "less suited to footage-heavy edits, complex audio timelines, or source clip assembly",
        "browser rendering is best for deterministic motion, not advanced media compositing"
      ],
      creativeDirection: `Create a browser-native ${format} piece: animate DOM sections as scroll beats, turn the page content into cards or panels, and use CSS/JS transitions for rhythm.${cta}`
    };
  }

  return {
    summary:
      "Use Remotion when the request benefits from coded templates, React/TypeScript control, data-driven variants, or repeatable motion graphics.",
    strengths: [
      "template-driven React/TypeScript motion graphics",
      "repeatable data/props variants and batch renders",
      "strong fit for event promos, product explainers, dashboards, and title-heavy pieces"
    ],
    tradeoffs: [
      "requires an external Remotion Studio Monorepo checkout",
      "commercial automation, team use, SaaS, or client work may require a Remotion Company License",
      "less natural for raw footage timelines than a media-editing engine"
    ],
    creativeDirection: `Structure a ${format} template with an opening hook, two or three modular scenes, layered typography/motion, and a final CTA lockup.${cta} Keep text, dates, and data as props for variants.`
  };
}
