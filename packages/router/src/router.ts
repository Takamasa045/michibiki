import type {
  EngineDecision,
  EngineFit,
  EngineName,
  EngineRecommendation,
  SwitchHint,
  VideoSpec
} from "@michibiki/video-spec";

type RouterSignals = {
  hasVideoOrAudioAssets: boolean;
  hasMultipleImageAssets: boolean;
  hasUrlAsset: boolean;
  urlIsReferenceOnly: boolean;
  mentionsTimelineEditing: boolean;
  mentionsAudioSupport: boolean;
  mentionsAudioTimelineEditing: boolean;
  mentionsAudioDrivenMotion: boolean;
  mentionsTransitionsOrOverlays: boolean;
  mentionsWebDomWorkflow: boolean;
  mentionsAvatarOrTalkingHead: boolean;
  mentionsDataDrivenOrTemplateWorkflow: boolean;
  mentionsDataVisualization: boolean;
  mentionsExplainerOrTutorial: boolean;
  mentionsLyricOrMusicVideo: boolean;
  mentionsCodedMotionDesign: boolean;
  mentionsCloudBatchRender: boolean;
  mentionsShortSocialWorkflow: boolean;
  mentionsPromoWorkflow: boolean;
  mentionsWebinarRecap: boolean;
  isVerticalShortFormat: boolean;
  isLongFormFormat: boolean;
};

export function selectEngine(spec: VideoSpec): EngineDecision {
  const enginePreference = spec.constraints.enginePreference ?? "auto";
  const signals = getRouterSignals(spec);
  const engineFits = buildEngineFits(spec, signals);
  const selectedEngine =
    enginePreference === "auto"
      ? selectAutoEngine(engineFits)
      : enginePreference;
  const selectedFit = getEngineFit(engineFits, selectedEngine);
  const switchHints = buildSwitchHints(engineFits, selectedEngine, signals);
  const clarifyingQuestions = buildClarifyingQuestions(
    engineFits,
    selectedEngine
  );

  if (enginePreference !== "auto") {
    return {
      engine: selectedEngine,
      confidence: 1,
      reason: "User explicitly selected engine.",
      recommendation: selectedFit.recommendation,
      engineFits,
      selectionGuide: buildSelectionGuide(engineFits, selectedEngine),
      switchHints,
      clarifyingQuestions: [],
      licenseRisk: defaultLicenseRisk(selectedEngine)
    };
  }

  return {
    engine: selectedEngine,
    confidence: computeConfidence(engineFits, selectedFit.fitPercent),
    reason: selectedFit.reason,
    recommendation: selectedFit.recommendation,
    engineFits,
    selectionGuide: buildSelectionGuide(engineFits, selectedEngine),
    switchHints,
    clarifyingQuestions,
    licenseRisk: defaultLicenseRisk(selectedEngine),
    fallback: getFallbackEngine(engineFits, selectedEngine)
  };
}

function computeConfidence(
  engineFits: EngineFit[],
  selectedPercent: number
): number {
  const sorted = [...engineFits].sort(
    (left, right) => right.fitPercent - left.fitPercent
  );
  const runnerUp = sorted.find((fit) => fit.fitPercent < selectedPercent);
  if (!runnerUp) return 0.5;
  const margin = selectedPercent - runnerUp.fitPercent;
  const marginFactor = Math.min(1, margin / 25);
  return Math.round((selectedPercent / 100) * marginFactor * 100) / 100;
}

function buildClarifyingQuestions(
  engineFits: EngineFit[],
  selectedEngine: EngineName
): string[] {
  const sorted = [...engineFits].sort(
    (left, right) => right.fitPercent - left.fitPercent
  );
  const top = sorted[0];
  const second = sorted[1];
  if (!top || !second) return [];
  const margin = top.fitPercent - second.fitPercent;
  if (margin > 8) return [];

  const pair = orderEnginePair(top.engine, second.engine);
  return [buildClarifyingQuestion(pair, selectedEngine)];
}

function orderEnginePair(
  a: EngineName,
  b: EngineName
): readonly [EngineName, EngineName] {
  const order: EngineName[] = ["remotion", "hyperframes", "editframe"];
  const sorted = [a, b].sort((left, right) => order.indexOf(left) - order.indexOf(right));
  return [sorted[0]!, sorted[1]!] as const;
}

const PAIR_QUESTIONS: Record<string, string> = {
  "remotion|hyperframes":
    "Two engines tied: should this video feel like (A) a coded React motion piece with custom typography and choreography (Remotion), or (B) a Web/LP-style page captured as motion (HyperFrames)?",
  "remotion|editframe":
    "Two engines tied: should this video feel like (A) a coded motion piece with sound-timed typography and reusable structure (Remotion), or (B) a waveform/beat-cut timeline with captions and layered media (Editframe)?",
  "hyperframes|editframe":
    "Two engines tied: should this video feel like (A) a Web/LP page becoming motion with HTML/CSS/JS (HyperFrames), or (B) a waveform/beat-cut timeline with captions and layered media (Editframe)?"
};

function buildClarifyingQuestion(
  pair: readonly [EngineName, EngineName],
  selectedEngine: EngineName
): string {
  const key = `${pair[0]}|${pair[1]}`;
  const base =
    PAIR_QUESTIONS[key] ??
    "Two engines are nearly tied. Which direction fits the creative intent better?";
  return `${base} Currently leaning ${selectedEngine} by a small margin — answer A or B (or pass --engine) to lock it in.`;
}

function defaultLicenseRisk(engine: EngineName): EngineDecision["licenseRisk"] {
  if (engine === "hyperframes") return "low";
  return "medium";
}

function normalizedUserRequestText(spec: VideoSpec): string {
  // Use only the raw user prompt (spec.goal) plus an explicitly user-provided
  // CTA. spec.title / spec.content.script / spec.content.captions /
  // spec.content.scenes are heuristically inferred from the prompt by
  // from-prompt.ts and re-introduce keywords without their negation context
  // (e.g. an "LPは作らない" prompt gets a "Website Trailer" title that
  // would falsely re-fire the web/DOM signal). We deliberately do not look
  // at those derived fields when extracting routing signals.
  return [spec.goal, spec.content.cta].filter(Boolean).join(" ").toLowerCase();
}

const NEGATION_AFTER =
  /^(?:[\s　]*(?:を|は|も|の|が|に|で|と|から|まで)?\s*)(?:なし|無し|不要|要らない|不必要|ない|なく(?:て)?|じゃない|ではない|ではなく|以外|は(?:な|無)い|抜き|抜きで)/i;

const VERB_NEGATION_AFTER =
  /^(?:[\s　]*(?:を|は|も|の|が|に|で|と|から|まで)?\s*)[一-龯々ぁ-んァ-ヶー]{0,6}[ぁ-ん](?:ない|なかった|ません|ませんでした|ぬ|なくて|なくても)/i;

const META_AFTER =
  /^(?:[\s　]*(?:を|は|も|の|が|に|と)?\s*)(?:について|の話|を解説|を解説する|を取り上げ|を取り上げる|に関する|の説明|の概要|に触れ|の例|を題材|の例として)/i;

const NEGATION_BEFORE =
  /(?:なし|無し|不要|不必要|なく|じゃなく|ではなく|以外|抜き|抜きで|without|no\s)\s*(?:[、。\s]|の|で|な)?\s*$/i;

function hasContextualMatch(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  while ((match = globalPattern.exec(text)) !== null) {
    const matchEnd = match.index + match[0].length;
    const tail = text.substring(matchEnd, matchEnd + 20);
    const head = text.substring(Math.max(0, match.index - 16), match.index);
    if (NEGATION_AFTER.test(tail)) continue;
    if (VERB_NEGATION_AFTER.test(tail)) continue;
    if (META_AFTER.test(tail)) continue;
    if (NEGATION_BEFORE.test(head)) continue;
    return true;
  }
  return false;
}

function getRouterSignals(spec: VideoSpec): RouterSignals {
  const text = normalizedUserRequestText(spec);
  const hasUrlAsset = spec.assets.some((asset) => asset.type === "url");
  const imageAssetCount = spec.assets.filter(
    (asset) => asset.type === "image"
  ).length;
  const hasVideoOrAudioAssets = spec.assets.some(
    (asset) => asset.type === "video" || asset.type === "audio"
  );
  return {
    hasVideoOrAudioAssets,
    hasMultipleImageAssets: !hasVideoOrAudioAssets && imageAssetCount >= 2,
    hasUrlAsset,
    urlIsReferenceOnly: hasUrlAsset && urlIsReferenceOnly(text),
    mentionsTimelineEditing: mentionsTimelineEditing(text),
    mentionsAudioSupport: mentionsAudioSupport(text),
    mentionsAudioTimelineEditing: mentionsAudioTimelineEditing(text),
    mentionsAudioDrivenMotion: mentionsAudioDrivenMotion(text),
    mentionsTransitionsOrOverlays: mentionsTransitionsOrOverlays(text),
    mentionsWebDomWorkflow: mentionsWebDomWorkflow(text),
    mentionsAvatarOrTalkingHead: mentionsAvatarOrTalkingHead(text),
    mentionsDataDrivenOrTemplateWorkflow:
      mentionsDataDrivenOrTemplateWorkflow(text),
    mentionsDataVisualization: mentionsDataVisualization(text),
    mentionsExplainerOrTutorial: mentionsExplainerOrTutorial(text),
    mentionsLyricOrMusicVideo: mentionsLyricOrMusicVideo(text),
    mentionsCodedMotionDesign: mentionsCodedMotionDesign(text),
    mentionsCloudBatchRender: mentionsCloudBatchRender(text),
    mentionsShortSocialWorkflow:
      /(shorts?|reels?|tiktok|ショート|縦型|縦長)/i.test(text),
    mentionsPromoWorkflow:
      /(イベント|告知|開催|商品|プロダクト|ec|広告|promo|promotion|ad\b)/i.test(
        text
      ),
    mentionsWebinarRecap: mentionsWebinarRecap(text),
    isVerticalShortFormat:
      spec.format.aspectRatio === "9:16" && spec.format.durationSec <= 60,
    isLongFormFormat: spec.format.durationSec >= 120
  };
}

function mentionsTimelineEditing(text: string): boolean {
  return hasContextualMatch(
    text,
    /(timeline|タイムライン|b-roll|broll|カット編集|vlog|編集する|編集したい|動画編集|編集動画|video\s+edit(?:ing)?|edit(?:ing)?\s+(?:a\s+)?video|effects? edit|エディトリアル|editorial|スライドショー|slide\s?show|フォトムービー|photo\s?movie)/i
  );
}

function mentionsAudioSupport(text: string): boolean {
  return hasContextualMatch(
    text,
    /(bgm|背景音楽|効果音|sfx|sound effects?|sound design|サウンドデザイン|音声|voice|narration|ナレーション)/i
  );
}

function mentionsAudioTimelineEditing(text: string): boolean {
  return hasContextualMatch(
    text,
    /(波形|waveform|beat marker|beat markers|ビートマーカー|(?:bgm|背景音楽|music|beat|ビート|音)[^、。.!?\n]{0,18}(?:カット|cut|切る|尺|シーン尺|timegroup|タイムライン|timeline)|(?:カット|cut|尺|シーン尺|timegroup|タイムライン|timeline)[^、。.!?\n]{0,18}(?:bgm|背景音楽|music|beat|ビート|音))/i
  );
}

function mentionsAudioDrivenMotion(text: string): boolean {
  return hasContextualMatch(
    text,
    /((?:効果音|sfx|sound effects?|音|voice|narration|ナレーション)[^、。.!?\n]{0,24}(?:タイミング|合わせ|同期|sync|文節)[^、。.!?\n]{0,24}(?:ズーム|zoom|切り替え|transition|テロップ|字幕|caption|subtitle|画面要素|表示|出す|motion|モーション|アニメーション)|(?:ズーム|zoom|切り替え|transition|テロップ|字幕|caption|subtitle|画面要素|表示|出す|motion|モーション|アニメーション)[^、。.!?\n]{0,24}(?:効果音|sfx|sound effects?|音|voice|narration|ナレーション))/i
  );
}

function mentionsTransitionsOrOverlays(text: string): boolean {
  return hasContextualMatch(
    text,
    /(トランジション|transition|オーバーレイ|overlay|クロスフェード|crossfade|ピクチャインピクチャ|picture[- ]in[- ]picture|pip|ロワーサード|lower[- ]?third|テロップ|テキスト合成|chyron)/i
  );
}

function mentionsWebDomWorkflow(text: string): boolean {
  return hasContextualMatch(
    text,
    /(webサイト|website|web\s?page|webページ|landing page|ランディングページ|\blp\b|dom|html|css|javascript|gsap|スクロール|セクション|section|サイト動画化|page-to-video|プロダクトページ|商品ページ|webflow|framer)/i
  );
}

function mentionsAvatarOrTalkingHead(text: string): boolean {
  return hasContextualMatch(
    text,
    /(アバター|avatar|talking[- ]?head|toking head|トーキングヘッド|ai presenter|aiプレゼンター|virtual presenter|バーチャルプレゼンター|heygen)/i
  );
}

function mentionsDataDrivenOrTemplateWorkflow(text: string): boolean {
  return hasContextualMatch(
    text,
    /(react|remotion|テンプレート|template|csv|data-driven|データ駆動|props|量産|自動レンダリング|バッチレンダ|batch render|バリアント|variant|スプレッドシート|spreadsheet)/i
  );
}

function mentionsDataVisualization(text: string): boolean {
  return hasContextualMatch(
    text,
    /(ダッシュボード|dashboard|チャート|chart|グラフ|graph|data\s?viz|データ可視化|可視化|kpi|メトリクス|metrics|アナリティクス|analytics|プロット|plot)/i
  );
}

function mentionsExplainerOrTutorial(text: string): boolean {
  return hasContextualMatch(
    text,
    /(解説動画|解説ビデオ|explainer|tutorial|チュートリアル|how[- ]?to|ハウツー|how it works|仕組み解説|エデュケーション動画|education video|onboarding|オンボーディング)/i
  );
}

function mentionsLyricOrMusicVideo(text: string): boolean {
  return hasContextualMatch(
    text,
    /(\bmv\b|music\s?video|ミュージックビデオ|リリックビデオ|lyric\s?video|歌詞動画|歌詞付き)/i
  );
}

function mentionsCodedMotionDesign(text: string): boolean {
  return hasContextualMatch(
    text,
    /(kinetic typo|キネティックタイポ|タイポグラフィ|typography|spring|easing|frame-accurate|フレーム精度|モーショングラフィックス|motion graphics|motion design|モーションデザイン|three\.?js|react three fiber|r3f|lottie|パララックス|parallax|シェーダー|shader)/i
  );
}

function mentionsCloudBatchRender(text: string): boolean {
  return hasContextualMatch(
    text,
    /(\blambda\b|aws lambda|cloud render|クラウドレンダ|クラウドレンダリング|バッチレンダ|batch render|大量レンダ|多変量|n\s*variants?|何百本|何千本)/i
  );
}

function mentionsWebinarRecap(text: string): boolean {
  return hasContextualMatch(
    text,
    /(ウェビナー|webinar|recap|リキャップ|ダイジェスト|digest|ハイライト動画|highlight\s+video|登壇|conference\s+recap|キーノート|keynote)/i
  );
}

function urlIsReferenceOnly(text: string): boolean {
  return /(参照|詳細はこちら|詳しくは|reference|see\s+(here|below|the link)|details? at|詳しい情報|リンクは)/i.test(
    text
  );
}

function selectAutoEngine(engineFits: EngineFit[]): EngineName {
  const sorted = [...engineFits].sort((left, right) => {
    if (right.fitPercent !== left.fitPercent) {
      return right.fitPercent - left.fitPercent;
    }
    return tieBreakOrder(left.engine) - tieBreakOrder(right.engine);
  });
  const top = sorted[0];
  if (!top) {
    throw new Error("buildEngineFits returned no engine fits.");
  }
  return top.engine;
}

function tieBreakOrder(engine: EngineName): number {
  if (engine === "remotion") return 0;
  if (engine === "hyperframes") return 1;
  return 2;
}

function buildSwitchHints(
  engineFits: EngineFit[],
  selectedEngine: EngineName,
  signals: RouterSignals
): SwitchHint[] {
  return engineFits
    .filter((fit) => fit.engine !== selectedEngine)
    .sort((left, right) => right.fitPercent - left.fitPercent)
    .map((fit) => buildSwitchHint(fit.engine, signals));
}

function buildSwitchHint(
  targetEngine: EngineName,
  signals: RouterSignals
): SwitchHint {
  if (targetEngine === "editframe") {
    const condition = signals.hasVideoOrAudioAssets
      ? "If you want to edit those clips/voice on a timeline with captions, BGM beats, transitions, and overlays"
      : signals.mentionsAudioTimelineEditing
        ? "If waveform, beat markers, BGM cuts, or scene durations should drive the timeline edit"
      : signals.mentionsAudioDrivenMotion
        ? "If the sound cues become timeline edits with captions, layered media, and beat-cut scene timing"
      : signals.mentionsAudioSupport
        ? "If the generated BGM/SFX, voice, captions, or beat cuts should drive a timeline edit"
      : "If you want narration/voice sync, captions, BGM beats, transitions, or to layer existing media on a timeline";
    return {
      targetEngine,
      condition,
      why: "Editframe becomes the strongest fit because timeline rhythm, captions, audio sync, and layered media drive the piece."
    };
  }

  if (targetEngine === "hyperframes") {
    const condition = signals.hasUrlAsset
      ? "If you want the page itself to become the video (sections, scroll, GSAP/Lottie/CSS motion captured from the DOM)"
      : "If you'd rather author the video as a web page (HTML/CSS/JS), reuse an existing LP/DOM, or use GSAP/Lottie/CSS motion";
    return {
      targetEngine,
      condition,
      why: "HyperFrames becomes the strongest fit because it captures DOM/CSS/JS motion deterministically through headless Chrome and ffmpeg."
    };
  }

  const condition = signals.mentionsDataDrivenOrTemplateWorkflow
    ? "If you want to template this and render many data-driven variants (props/JSON/CSV) at once"
    : "If you want frame-accurate React motion, kinetic typography, spring/easing choreography, or to template the same video for many data variants";
  return {
    targetEngine,
    condition,
    why: "Remotion becomes the strongest fit because React/TSX gives precise frame-by-frame control and reusable, prop-driven variants."
  };
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
  if (signals.hasMultipleImageAssets) {
    scores.editframe += 14;
    scores.remotion += 10;
    scores.hyperframes -= 2;
  }
  if (signals.mentionsTimelineEditing) {
    scores.editframe += 30;
    scores.remotion -= 2;
    scores.hyperframes -= 3;
  }
  if (signals.mentionsAudioSupport) {
    scores.editframe += 6;
    scores.remotion += 3;
  }
  if (signals.mentionsAudioTimelineEditing) {
    scores.editframe += 28;
    scores.remotion += 2;
  }
  if (signals.mentionsAudioDrivenMotion) {
    scores.remotion += 18;
    scores.editframe += 4;
  }
  if (signals.mentionsTransitionsOrOverlays) {
    scores.editframe += 14;
    scores.remotion += 2;
  }
  if (signals.mentionsWebDomWorkflow) {
    scores.hyperframes += 48;
    scores.remotion += 4;
    scores.editframe -= 8;
  } else if (signals.hasUrlAsset && !signals.urlIsReferenceOnly) {
    scores.hyperframes += 40;
    scores.remotion += 4;
    scores.editframe -= 6;
  } else if (signals.hasUrlAsset && signals.urlIsReferenceOnly) {
    scores.hyperframes += 12;
  }
  if (signals.mentionsAvatarOrTalkingHead) {
    scores.hyperframes += 24;
    scores.editframe += 8;
  }
  if (signals.mentionsDataDrivenOrTemplateWorkflow) {
    scores.remotion += 36;
    scores.hyperframes += 6;
    scores.editframe -= 4;
  }
  if (signals.mentionsDataVisualization) {
    scores.remotion += 26;
    scores.hyperframes += 4;
    scores.editframe -= 4;
  }
  if (signals.mentionsExplainerOrTutorial) {
    scores.remotion += 18;
    scores.editframe += 4;
  }
  if (signals.mentionsLyricOrMusicVideo) {
    scores.remotion += 22;
    scores.editframe += 6;
  }
  if (signals.mentionsCodedMotionDesign) {
    scores.remotion += 30;
    scores.editframe -= 6;
  }
  if (signals.mentionsCloudBatchRender) {
    scores.remotion += 18;
  }
  if (signals.mentionsShortSocialWorkflow) {
    scores.editframe += 6;
    scores.remotion += 8;
  }
  if (signals.mentionsPromoWorkflow) {
    scores.remotion += 12;
    scores.hyperframes += 7;
  }
  if (signals.mentionsWebinarRecap) {
    scores.editframe += 28;
    scores.remotion += 4;
  }
  if (signals.isVerticalShortFormat) {
    scores.editframe += 6;
    scores.remotion += 4;
  }
  if (signals.isLongFormFormat) {
    scores.remotion += 10;
    scores.editframe += 4;
    scores.hyperframes -= 4;
  }

  const normalized = normalizeFitPercents(scores);
  return (["remotion", "hyperframes", "editframe"] as const)
    .map((engine) => ({
      engine,
      fitPercent: normalized[engine],
      reason: buildFitReason(engine, signals),
      bestUse: buildBestUse(engine, spec),
      featureHighlights: buildFeatureHighlights(engine),
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
    if (
      signals.hasVideoOrAudioAssets ||
      signals.mentionsAudioTimelineEditing ||
      signals.mentionsTimelineEditing ||
      signals.mentionsWebinarRecap ||
      signals.hasMultipleImageAssets
    ) {
      return "Source media, multi-image slideshow, transitions, webinar/recap rhythm, or timeline-editing signals make Editframe a strong fit.";
    }
    if (signals.mentionsTransitionsOrOverlays) {
      return "Transitions and overlays can fit Editframe, especially in a layered timeline, but frame-accurate sound-cued motion may still fit Remotion better.";
    }
    if (signals.mentionsAudioSupport) {
      return "BGM, SFX, voice, or narration support makes Editframe worth considering, especially if waveform, beat cuts, or timeline edits become central.";
    }
    return "Editframe can still shape a polished timeline-driven promo with captions, audio beats, transitions, and generated or static visual layers, but it is less central when no media or editorial signals are present.";
  }

  if (engine === "hyperframes") {
    if (
      signals.mentionsWebDomWorkflow ||
      (signals.hasUrlAsset && !signals.urlIsReferenceOnly) ||
      signals.mentionsAvatarOrTalkingHead
    ) {
      return "URL, LP, DOM, CSS, JavaScript, scroll-motion, or avatar/talking-head signals make HyperFrames a strong fit.";
    }
    return "HyperFrames can work when the video should feel like a browser-native story with panels, cards, and web motion.";
  }

  if (
    signals.mentionsDataDrivenOrTemplateWorkflow ||
    signals.mentionsCodedMotionDesign ||
    signals.mentionsDataVisualization ||
    signals.mentionsAudioDrivenMotion ||
    signals.mentionsExplainerOrTutorial ||
    signals.mentionsLyricOrMusicVideo ||
    signals.mentionsCloudBatchRender
  ) {
    return "Template, props, kinetic typography, sound-timed motion, data viz, explainer, lyric/MV, or cloud/batch-render signals make Remotion a strong fit.";
  }
  return "Remotion is a good default for coded motion graphics, one-off animated promos, kinetic title sequences, and reusable video templates.";
}

function buildBestUse(engine: EngineName, spec: VideoSpec): string {
  const format = `${spec.format.durationSec}-second ${spec.format.aspectRatio}`;
  if (engine === "editframe") {
    return `Use Editframe for this ${format} video if you want a timeline-shaped promo with explicit scene timegroups, caption or word-level text beats, voice/music sync, waveform-informed pacing, transitions, overlays, and B-roll or generated visual layers. It is not only for existing footage; it is strongest when the edit rhythm, audio, subtitles, and layered media should drive the piece.`;
  }
  if (engine === "hyperframes") {
    return `Use HyperFrames for this ${format} video if you want the concept to feel like a web page or LP turning into motion with plain HTML/CSS/JS, GSAP/Lottie/CSS animations, frame-seekable timing, browser-native sections, and deterministic page-to-video rendering.`;
  }
  return `Use Remotion for this ${format} video if you want a one-off, frame-accurate React motion piece with Sequence-based timing, useCurrentFrame choreography, kinetic typography, custom easing/spring motion, layered transitions, captions/audio, Lottie or Three.js-style flourishes, and optional props for later reuse.`;
}

function buildFeatureHighlights(engine: EngineName): string[] {
  if (engine === "editframe") {
    return [
      "HTML web components or React compositions built from timegroups, so scenes can be sequence, fixed, or layered.",
      "First-class media elements for video, audio, images, text, captions, waveform, and transitions.",
      "Text can split by word, character, or line with stagger, easing, custom animations, and deterministic CSS variables.",
      "Good fit for editor-like workflows: timeline, scrubber, preview, transform handles, render API, and cloud/local rendering paths."
    ];
  }

  if (engine === "hyperframes") {
    return [
      "HTML-first authoring: compositions are plain HTML/CSS/JS with data attributes for timing and layout.",
      "Seek-driven deterministic capture: each frame is positioned independently in headless Chrome and encoded through FFmpeg.",
      "Strong with GSAP, Lottie, CSS, Motion One, CodePen-style effects, and existing website/LP DOM that should become motion.",
      "Agent-friendly and low-friction: no React rewrite, no custom DSL, non-interactive CLI, and strong website-to-video workflows."
    ];
  }

  return [
    "React/TypeScript composition model for frame-accurate videos rendered to MP4/WebM with browser preview.",
    "Sequence, Series, useCurrentFrame, interpolate, spring, and animation utilities enable precise choreographed motion.",
    "Rich ecosystem for captions, audio, Lottie, Three.js/React Three Fiber, transitions, shapes, fonts, and cloud rendering.",
    "Works for both one-off high-polish animations and prop-driven/programmatic variants."
  ];
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
  const sorted = [...engineFits].sort(
    (left, right) => right.fitPercent - left.fitPercent
  );
  const runnerUp = sorted.find((fit) => fit.engine !== selectedEngine);
  const alternatives = sorted
    .filter((fit) => fit.engine !== selectedEngine)
    .map((fit) => `${fit.engine} ${fit.fitPercent}%`)
    .join(", ");
  const closeCallNotice =
    runnerUp && selectedFit.fitPercent - runnerUp.fitPercent <= 8
      ? ` Close call: ${selectedEngine} only leads ${runnerUp.engine} by ${selectedFit.fitPercent - runnerUp.fitPercent}%, so review switchHints before locking the engine.`
      : "";

  return [
    `Recommended engine: ${selectedEngine} (${selectedFit.fitPercent}%).`,
    selectedFit.bestUse,
    `Alternatives: ${alternatives}.`,
    "The recommended engine is chosen by highest relative fit. Switch with --engine when creative direction or scope changes (see switchHints)." +
      closeCallNotice
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
        "Use Editframe when timeline rhythm, captions, audio, transitions, layered media, and edit decisions should lead the video.",
      strengths: [
        "timeline-first composition for scenes, captions, audio, overlays, and B-roll",
        "word/character text animation, subtitles, music/voice sync, and transition-heavy story edits",
        "timeline.json handoff that preserves pacing, sequencing, and media-editing intent"
      ],
      tradeoffs: [
        "current adapter is a timeline handoff and local preview, not the full Editframe SDK integration",
        "less efficient for pure code-only template variants or data-driven batch renders",
        "commercial, team, or cloud use depends on Editframe terms and plan requirements"
      ],
      creativeDirection: `Design a ${format} timeline with an opening beat, caption-led message steps, music/voice sync points, crossfades or zoom transitions, overlay cards, and a final title card.${cta} Use clips if available; otherwise use generated stills, page captures, text, and sound as layered media.`
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
      "Use Remotion when the request benefits from frame-accurate coded animation, custom motion design, React/TypeScript control, or reusable variants.",
    strengths: [
      "frame-accurate choreography for kinetic typography, custom easing, springs, and scene transitions",
      "single-use high-polish animations as well as repeatable data/props variants and batch renders",
      "strong fit for event promos, product explainers, dashboards, title-heavy pieces, Lottie-style motion, and 3D-like flourishes"
    ],
    tradeoffs: [
      "uses an external Remotion Studio Monorepo when available, otherwise generates a standalone Remotion project that needs dependency install",
      "commercial automation, team use, SaaS, or client work may require a Remotion Company License",
      "less natural for raw footage timelines than a media-editing engine"
    ],
    creativeDirection: `Build a ${format} animated promo with an opening hook, kinetic title reveal, staggered detail callouts, custom easing/spring transitions, depth/parallax or Lottie/3D-style accents, and a final CTA lockup.${cta} Expose text, dates, and colors as props only when reuse is useful.`
  };
}
