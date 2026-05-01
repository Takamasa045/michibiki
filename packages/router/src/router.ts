import type {
  EngineDecision,
  EngineName,
  VideoSpec
} from "@michibiki/video-spec";

export function selectEngine(spec: VideoSpec): EngineDecision {
  const enginePreference = spec.constraints.enginePreference ?? "auto";
  if (enginePreference !== "auto") {
    return {
      engine: enginePreference,
      confidence: 1,
      reason: "User explicitly selected engine.",
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
      licenseRisk: "low",
      fallback: "remotion"
    };
  }

  if (mentionsDataDrivenOrTemplateWorkflow(spec)) {
    return {
      engine: "remotion",
      confidence: 0.86,
      reason: "Template/data-driven motion graphics workflow detected.",
      licenseRisk: "medium",
      fallback: "hyperframes"
    };
  }

  return {
    engine: "remotion",
    confidence: 0.75,
    reason: "Template-based motion graphics workflow is suitable.",
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

