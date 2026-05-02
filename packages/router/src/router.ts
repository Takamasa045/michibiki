import type {
  EngineDecision,
  EngineFit,
  EngineName,
  EngineRecommendation,
  VideoSpec
} from "@michibiki/video-spec";

type RouterSignals = {
  hasVideoOrAudioAssets: boolean;
  hasUrlAsset: boolean;
  mentionsTimelineEditing: boolean;
  mentionsWebDomWorkflow: boolean;
  mentionsDataDrivenOrTemplateWorkflow: boolean;
  mentionsShortSocialWorkflow: boolean;
  mentionsPromoWorkflow: boolean;
};

export function selectEngine(spec: VideoSpec): EngineDecision {
  const enginePreference = spec.constraints.enginePreference ?? "auto";
  const signals = getRouterSignals(spec);
  const engineFits = buildEngineFits(spec, signals);
  const selectedEngine =
    enginePreference === "auto" ? selectAutoEngine(signals) : enginePreference;
  const selectedFit = getEngineFit(engineFits, selectedEngine);

  if (enginePreference !== "auto") {
    return {
      engine: selectedEngine,
      confidence: 1,
      reason: "User explicitly selected engine.",
      recommendation: selectedFit.recommendation,
      engineFits,
      selectionGuide: buildSelectionGuide(engineFits, selectedEngine),
      licenseRisk: defaultLicenseRisk(selectedEngine)
    };
  }

  return {
    engine: selectedEngine,
    confidence: selectedFit.fitPercent / 100,
    reason: selectedFit.reason,
    recommendation: selectedFit.recommendation,
    engineFits,
    selectionGuide: buildSelectionGuide(engineFits, selectedEngine),
    licenseRisk: defaultLicenseRisk(selectedEngine),
    fallback: getFallbackEngine(engineFits, selectedEngine)
  };
}

function defaultLicenseRisk(engine: EngineName): EngineDecision["licenseRisk"] {
  if (engine === "hyperframes") return "low";
  return "medium";
}

function normalizedUserRequestText(spec: VideoSpec): string {
  return [
    spec.title,
    spec.goal,
    spec.content.script,
    spec.content.cta,
    ...(spec.content.captions ?? []),
    ...(spec.content.scenes?.map((scene) => scene.description) ?? [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getRouterSignals(spec: VideoSpec): RouterSignals {
  const text = normalizedUserRequestText(spec);
  return {
    hasVideoOrAudioAssets: spec.assets.some(
      (asset) => asset.type === "video" || asset.type === "audio"
    ),
    hasUrlAsset: spec.assets.some((asset) => asset.type === "url"),
    mentionsTimelineEditing: mentionsTimelineEditing(text),
    mentionsWebDomWorkflow: mentionsWebDomWorkflow(text),
    mentionsDataDrivenOrTemplateWorkflow:
      mentionsDataDrivenOrTemplateWorkflow(text),
    mentionsShortSocialWorkflow:
      /(shorts?|reels?|tiktok|ショート|縦型|縦長|字幕)/i.test(text),
    mentionsPromoWorkflow:
      /(イベント|告知|開催|商品|プロダクト|ec|広告|promo|promotion|ad\b|lp)/i.test(
        text
      )
  };
}

function mentionsTimelineEditing(text: string): boolean {
  return /(timeline|タイムライン|字幕|caption|b-roll|broll|カット編集|vlog|素材|音声|voice)/i.test(
    text
  );
}

function mentionsWebDomWorkflow(text: string): boolean {
  return /(webサイト|website|landing page|ランディングページ|\blp\b|dom|html|css|javascript|gsap|スクロール|url)/i.test(
    text
  );
}

function mentionsDataDrivenOrTemplateWorkflow(text: string): boolean {
  return /(react|remotion|テンプレート|template|json|csv|データ|data-driven|props|量産|自動レンダリング)/i.test(
    text
  );
}

function selectAutoEngine(signals: RouterSignals): EngineName {
  if (signals.hasVideoOrAudioAssets || signals.mentionsTimelineEditing) {
    return "editframe";
  }
  if (signals.hasUrlAsset || signals.mentionsWebDomWorkflow) {
    return "hyperframes";
  }
  return "remotion";
}

function buildEngineFits(spec: VideoSpec, signals: RouterSignals): EngineFit[] {
  const scores: Record<EngineName, number> = {
    remotion: 42,
    hyperframes: 32,
    editframe: 26
  };

  if (signals.hasVideoOrAudioAssets) {
    scores.editframe += 52;
    scores.remotion -= 8;
    scores.hyperframes -= 7;
  }
  if (signals.mentionsTimelineEditing) {
    scores.editframe += 36;
    scores.remotion -= 4;
    scores.hyperframes -= 4;
  }
  if (signals.hasUrlAsset || signals.mentionsWebDomWorkflow) {
    scores.hyperframes += 48;
    scores.remotion += 4;
    scores.editframe -= 8;
  }
  if (signals.mentionsDataDrivenOrTemplateWorkflow) {
    scores.remotion += 36;
    scores.hyperframes += 6;
    scores.editframe -= 4;
  }
  if (signals.mentionsShortSocialWorkflow) {
    scores.editframe += 8;
    scores.remotion += 6;
  }
  if (signals.mentionsPromoWorkflow) {
    scores.remotion += 12;
    scores.hyperframes += 7;
  }

  const normalized = normalizeFitPercents(scores);
  return (["remotion", "hyperframes", "editframe"] as const)
    .map((engine) => ({
      engine,
      fitPercent: normalized[engine],
      reason: buildFitReason(engine, signals),
      bestUse: buildBestUse(engine, spec),
      recommendation: buildEngineRecommendation(engine, spec)
    }))
    .sort((left, right) => right.fitPercent - left.fitPercent);
}

function normalizeFitPercents(
  scores: Record<EngineName, number>
): Record<EngineName, number> {
  const entries = (Object.entries(scores) as Array<[EngineName, number]>).map(
    ([engine, score]) => [engine, Math.max(5, score)] as const
  );
  const total = entries.reduce((sum, [, score]) => sum + score, 0);
  const normalized = Object.fromEntries(
    entries.map(([engine, score]) => [
      engine,
      Math.round((score / total) * 100)
    ])
  ) as Record<EngineName, number>;
  const diff =
    100 -
    (normalized.remotion + normalized.hyperframes + normalized.editframe);
  const strongest = entries
    .slice()
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? "remotion";
  normalized[strongest] += diff;
  return normalized;
}

function buildFitReason(engine: EngineName, signals: RouterSignals): string {
  if (engine === "editframe") {
    if (signals.hasVideoOrAudioAssets || signals.mentionsTimelineEditing) {
      return "Source media, captions, voice, B-roll, or timeline-editing signals make Editframe a strong fit.";
    }
    return "Editframe is useful if the project later brings footage, voiceover, music, captions, or B-roll, but it is less central for a code-first prompt.";
  }

  if (engine === "hyperframes") {
    if (signals.hasUrlAsset || signals.mentionsWebDomWorkflow) {
      return "URL, LP, DOM, CSS, JavaScript, or scroll-motion signals make HyperFrames a strong fit.";
    }
    return "HyperFrames can work when the video should feel like a browser-native story with panels, cards, and web motion.";
  }

  if (signals.mentionsDataDrivenOrTemplateWorkflow) {
    return "Template, React, data, props, or repeatable-render signals make Remotion a strong fit.";
  }
  return "Remotion is a good default for coded motion graphics, event promos, title sequences, and reusable video templates.";
}

function buildBestUse(engine: EngineName, spec: VideoSpec): string {
  const format = `${spec.format.durationSec}-second ${spec.format.aspectRatio}`;
  if (engine === "editframe") {
    return `Use Editframe for this ${format} video if you want to assemble clips, voice, music, captions, and B-roll into a timeline-first edit.`;
  }
  if (engine === "hyperframes") {
    return `Use HyperFrames for this ${format} video if you want the concept to feel like a web page or LP turning into motion with browser-native sections and transitions.`;
  }
  return `Use Remotion for this ${format} video if you want a reusable coded template where titles, dates, CTA text, colors, and data can be changed as props.`;
}

function getEngineFit(engineFits: EngineFit[], engine: EngineName): EngineFit {
  const fit = engineFits.find((candidate) => candidate.engine === engine);
  if (!fit) {
    throw new Error(`Missing engine fit for ${engine}.`);
  }
  return fit;
}

function getFallbackEngine(
  engineFits: EngineFit[],
  selectedEngine: EngineName
): EngineName | undefined {
  return engineFits.find((fit) => fit.engine !== selectedEngine)?.engine;
}

function buildSelectionGuide(
  engineFits: EngineFit[],
  selectedEngine: EngineName
): string {
  const selectedFit = getEngineFit(engineFits, selectedEngine);
  const alternatives = engineFits
    .filter((fit) => fit.engine !== selectedEngine)
    .map((fit) => `${fit.engine} ${fit.fitPercent}%`)
    .join(", ");

  return [
    `Recommended engine: ${selectedEngine} (${selectedFit.fitPercent}%).`,
    selectedFit.bestUse,
    `Alternatives: ${alternatives}.`,
    "Use the percentages as a relative fit among Remotion, HyperFrames, and Editframe, then override with --engine when the creative direction points elsewhere."
  ].join(" ");
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
      "uses an external Remotion Studio Monorepo when available, otherwise generates a standalone Remotion project that needs dependency install",
      "commercial automation, team use, SaaS, or client work may require a Remotion Company License",
      "less natural for raw footage timelines than a media-editing engine"
    ],
    creativeDirection: `Structure a ${format} template with an opening hook, two or three modular scenes, layered typography/motion, and a final CTA lockup.${cta} Keep text, dates, and data as props for variants.`
  };
}
