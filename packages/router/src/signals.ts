import type { EngineName, VideoSpec } from "@michibiki/video-spec";

// Input-analysis layer: turns a VideoSpec into routing signals and matches
// the current-capability catalog. Kept separate from the scoring/copy and
// orchestration logic in router.ts.

export type RouterSignals = {
  hasVideoOrAudioAssets: boolean;
  hasMultipleImageAssets: boolean;
  hasUrlAsset: boolean;
  urlIsReferenceOnly: boolean;
  capabilityMatches: EngineCapability[];
  mentionsTimelineEditing: boolean;
  mentionsAudioSupport: boolean;
  mentionsAudioTimelineEditing: boolean;
  mentionsAudioDrivenMotion: boolean;
  mentionsTransitionsOrOverlays: boolean;
  mentionsWebDomWorkflow: boolean;
  mentionsHtmlInCanvasWorkflow: boolean;
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

export type EngineCapability = {
  id: string;
  engine: EngineName;
  label: string;
  pattern: RegExp;
  scoreDelta: Partial<Record<EngineName, number>>;
  reason: string;
  featureHighlight: string;
  switchCondition: string;
  switchWhy: string;
};

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

export function getRouterSignals(spec: VideoSpec): RouterSignals {
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
    capabilityMatches: getCapabilityMatches(text),
    mentionsTimelineEditing: mentionsTimelineEditing(text),
    mentionsAudioSupport: mentionsAudioSupport(text),
    mentionsAudioTimelineEditing: mentionsAudioTimelineEditing(text),
    mentionsAudioDrivenMotion: mentionsAudioDrivenMotion(text),
    mentionsTransitionsOrOverlays: mentionsTransitionsOrOverlays(text),
    mentionsWebDomWorkflow: mentionsWebDomWorkflow(text),
    mentionsHtmlInCanvasWorkflow: mentionsHtmlInCanvasWorkflow(text),
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

function mentionsHtmlInCanvasWorkflow(text: string): boolean {
  return hasContextualMatch(
    text,
    /(html[- ]?in[- ]?canvas|htmlincanvas|drawelement(?:image)?|canvas-draw-element|dom[^、。.!?\n]{0,24}(?:canvas|キャンバス|post[- ]?process|ポスト処理|shader|シェーダー|webgl|webgpu|blur|glitch|グリッチ)|(?:canvas|キャンバス)[^、。.!?\n]{0,24}(?:dom|html|webgl|webgpu|shader|シェーダー|blur|glitch|グリッチ|vintage|magnifying|拡大鏡))/i
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
  return (
    /(参照|詳細はこちら|詳しくは|reference|see\s+(here|below|the link)|details? at|詳しい情報|リンクは)/i.test(
      text
    ) ||
    /(?:ページ|サイト|web\s?page|website|\blp\b|url|リンク)[^、。.!?\n]{0,24}(?:内容|情報|本文|テキスト|コピー|文章)[^、。.!?\n]{0,24}(?:使|元に|もとに|基に|参照|拾|抽出)/i.test(
      text
    ) ||
    /(?:ページ|サイト|web\s?page|website|\blp\b|dom|url|リンク)[^、。.!?\n]{0,24}(?:自体|そのもの)?[^、。.!?\n]{0,8}(?:映さ(?:ない|ず)|見せ(?:ない|ず)|出さ(?:ない|ず)|使わ(?:ない|ず)|キャプチャしない|スクショしない|captureしない|recordしない)/i.test(
      text
    )
  );
}

const ENGINE_CAPABILITY_CATALOG: EngineCapability[] = [
  {
    id: "remotion-html-in-canvas-transitions",
    engine: "remotion",
    label: "Remotion HTML-in-canvas transitions/client renderer",
    pattern:
      /(<htmlincanvas>|remotion[^、。.!?\n]{0,36}(?:html[- ]?in[- ]?canvas|htmlincanvas|drawelementimage|transitionseries|zoomblur|zoominout|web-renderer|client[- ]side renderer|クライアント側レンダ)|makehtmlincanvaspresentation|zoomblur|zoominout|@remotion\/transitions|transitionseries|@remotion\/web-renderer|client[- ]side renderer|クライアント側レンダ)/i,
    scoreDelta: {
      remotion: 16,
      hyperframes: -2,
      editframe: -4
    },
    reason:
      "Remotion now has first-class <HtmlInCanvas>, HTML-in-canvas transition presentations, and client-side rendering hooks for React-controlled DOM post-processing.",
    featureHighlight:
      "Current Remotion capability: <HtmlInCanvas>, HTML-in-canvas transition presentations such as zoomBlur/zoomInOut, and client-side rendering paths for React-controlled DOM post-processing.",
    switchCondition:
      "If the new requirement is React-controlled DOM-to-canvas post-processing, zoomBlur/zoomInOut transitions, or client-side renderer fidelity",
    switchWhy:
      "Remotion becomes stronger because the effect can stay inside typed React composition code while using the latest HTML-in-canvas rendering path."
  },
  {
    id: "hyperframes-website-capture-registry",
    engine: "hyperframes",
    label: "HyperFrames website capture, registry, snapshot, and inspect",
    pattern:
      /(hyperframes\s+(?:capture|snapshot|inspect|registry|add)|website[- ]?to[- ]?video|サイト(?:を)?(?:capture|キャプチャ|動画化)|capture[^、。.!?\n]{0,30}(?:brand|design|font|asset|section|animation|ブランド|デザイン|フォント|素材|セクション)|snapshot[^、。.!?\n]{0,24}(?:frame|png|検証)|inspect[^、。.!?\n]{0,24}(?:overflow|layout|text|レイアウト|文字)|registry[^、。.!?\n]{0,24}(?:block|component|shader|transition)|shader[- ]?wipe|tailwind v4|data-layout-allow-overflow)/i,
    scoreDelta: {
      hyperframes: 18,
      remotion: 2,
      editframe: -4
    },
    reason:
      "HyperFrames has current website-capture, registry block/component, snapshot, inspect, and Tailwind-oriented CLI capabilities that directly support page-to-video workflows.",
    featureHighlight:
      "Current HyperFrames capability: website capture extracts brand/design/assets/sections, registry add installs blocks/components, and snapshot/inspect help verify frames and layout before render.",
    switchCondition:
      "If the new requirement is website capture, registry blocks/components, frame snapshots, layout inspection, or Tailwind-based HTML video authoring",
    switchWhy:
      "HyperFrames becomes stronger because the official CLI already treats HTML as the source of truth and includes capture, add, snapshot, inspect, lint, preview, and render workflows."
  },
  {
    id: "editframe-elements-render-api",
    engine: "editframe",
    label: "Editframe elements, waveform/captions, React, and Render API",
    pattern:
      /(@editframe\/(?:cli|elements|react|api|create)|ef-(?:timegroup|waveform|captions|audio|video|text|preview|controls)|timegroup|word_segments|caption segments|render api|editor ui|preview components|waveform[^、。.!?\n]{0,24}(?:audio|video|音声|動画)|(?:字幕|captions?|transcription|文字起こし)[^、。.!?\n]{0,30}(?:word|単語|highlight|ハイライト|segments?))/i,
    scoreDelta: {
      editframe: 18,
      remotion: 2
    },
    reason:
      "Editframe exposes official HTML elements, React components, waveform/caption primitives, editor UI concepts, and Render API/package surfaces for timeline-first composition.",
    featureHighlight:
      "Current Editframe capability: ef-timegroup/ef-waveform/ef-captions elements, @editframe/react, editor UI primitives, and Render API paths for timeline-first media composition.",
    switchCondition:
      "If the new requirement is Editframe elements, React timeline components, waveform/caption primitives, editor UI, or Render API handoff",
    switchWhy:
      "Editframe becomes stronger because those features map directly to a timegroup-based editing model with media, captions, waveform, preview controls, and render workflows."
  }
];

function getCapabilityMatches(text: string): EngineCapability[] {
  return ENGINE_CAPABILITY_CATALOG.filter((capability) =>
    hasContextualMatch(text, capability.pattern)
  );
}

export function getCapabilitiesForEngine(
  signals: RouterSignals,
  engine: EngineName
): EngineCapability[] {
  return signals.capabilityMatches.filter(
    (capability) => capability.engine === engine
  );
}
