import { randomUUID } from "node:crypto";
import type {
  AspectRatio,
  AssetSpec,
  AssetType,
  EnginePreference,
  LicenseMode,
  OutputType,
  SceneSpec,
  VideoSpec
} from "./types.js";

export type PromptToVideoSpecInput = {
  prompt: string;
  id?: string;
  title?: string;
  durationSec?: number;
  aspectRatio?: AspectRatio;
  fps?: number;
  outputType?: OutputType;
  assetSources?: string[];
  referenceUrls?: string[];
  enginePreference?: EnginePreference;
  licenseMode?: LicenseMode;
  allowCloudRender?: boolean;
};

const DIMENSIONS_BY_ASPECT_RATIO: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 }
};

export function createVideoSpecFromPrompt(
  input: PromptToVideoSpecInput
): VideoSpec {
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    throw new Error("Prompt is required.");
  }

  const urls = [
    ...extractUrls(prompt),
    ...(input.referenceUrls ?? [])
  ].filter((value, index, array) => array.indexOf(value) === index);
  const aspectRatio = input.aspectRatio ?? inferAspectRatio(prompt);
  const dimensions = DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];
  const durationSec = input.durationSec ?? inferDurationSec(prompt);
  const fps = input.fps ?? 30;
  const assets = buildAssets(input.assetSources ?? [], urls);
  const cta = inferCta(prompt, urls);
  const style = inferStyle(prompt);
  const videoCopy = buildVideoCopy(prompt, durationSec, cta);

  return {
    id: input.id ?? `spec_${randomUUID()}`,
    title: input.title ?? inferTitle(prompt),
    goal: prompt,
    format: {
      aspectRatio,
      width: dimensions.width,
      height: dimensions.height,
      fps,
      durationSec
    },
    style: {
      ...style,
      reference: urls.length > 0 ? urls : undefined
    },
    content: {
      script: videoCopy.script,
      captions: videoCopy.captions,
      scenes: videoCopy.scenes,
      cta
    },
    assets,
    output: {
      type: input.outputType ?? "mp4",
      needsDownload: true
    },
    constraints: {
      enginePreference: input.enginePreference ?? "auto",
      licenseMode: input.licenseMode ?? "personal",
      allowCloudRender: input.allowCloudRender ?? false
    }
  };
}

export function dimensionsForAspectRatio(aspectRatio: AspectRatio): {
  width: number;
  height: number;
} {
  return DIMENSIONS_BY_ASPECT_RATIO[aspectRatio];
}

function inferAspectRatio(prompt: string): AspectRatio {
  if (/(縦型|縦長|9[:：]16|shorts?|reels?|tiktok|スマホ|スマートフォン)/i.test(prompt)) {
    return "9:16";
  }
  if (/(正方形|square|1[:：]1)/i.test(prompt)) {
    return "1:1";
  }
  if (/(4[:：]5|instagram\s*feed|インスタ投稿)/i.test(prompt)) {
    return "4:5";
  }
  return "16:9";
}

function inferDurationSec(prompt: string): number {
  const match = prompt.match(/(\d{1,3})\s*(秒|sec|secs|second|seconds|s\b)/i);
  if (!match?.[1]) {
    return 30;
  }

  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.min(Math.max(parsed, 3), 600);
}

function inferTitle(prompt: string): string {
  if (/(イベント|告知|開催|セミナー|勉強会)/.test(prompt)) {
    return "Event Promo";
  }
  if (/(LP|ランディングページ|Webサイト|website|site|SaaS)/i.test(prompt)) {
    return "Website Trailer";
  }
  if (/(商品|プロダクト|EC|広告|ad\b)/i.test(prompt)) {
    return "Product Promo";
  }

  const conciseTitle = splitPromptSegments(stripUrls(prompt))
    .map((segment) => rewriteSegmentAsTitle(segment))
    .find((segment): segment is string => Boolean(segment));

  return (conciseTitle ?? prompt)
    .replace(/\s+/g, " ")
    .slice(0, 42)
    .replace(/[、。,.!?！？]$/, "") || "Generated Video";
}

function inferStyle(prompt: string): {
  mood: string;
  visualTone: string;
  motionStyle: string;
} {
  const mood: string[] = [];
  if (/(cinematic|映画|シネマ|ドラマチック|壮大)/i.test(prompt)) {
    mood.push("cinematic");
  }
  if (/(warm|焚き火|温か|やさしい|cozy)/i.test(prompt)) {
    mood.push("warm");
  }
  if (/(mysterious|神秘|星空|宇宙|夜)/i.test(prompt)) {
    mood.push("mysterious");
  }
  if (/(pop|ポップ|明るい|楽しい)/i.test(prompt)) {
    mood.push("bright");
  }

  const visualTone = /(自然|山|雪|森|焚き火|アウトドア|キャンプ)/.test(prompt)
    ? "nature cinematic"
    : /(AI|agent|エージェント|未来|tech|SaaS|データ)/i.test(prompt)
      ? "tech-forward"
      : "clean modern";

  const motionStyle = /(ゆっくり|slow|cinematic|シネマ)/i.test(prompt)
    ? "slow cinematic cuts"
    : /(kinetic|タイポ|文字|字幕|テキスト)/i.test(prompt)
      ? "kinetic typography"
      : "template-based motion graphics";

  return {
    mood: mood.length > 0 ? mood.join(", ") : "clear, polished",
    visualTone,
    motionStyle
  };
}

function inferCta(prompt: string, urls: string[]): string | undefined {
  const quoted = [...prompt.matchAll(/[「『"]([^」』"]{2,80})[」』"]/g)].map(
    (match) => match[1]
  );
  if (quoted.length > 0) {
    return quoted.at(-1);
  }

  const finalText = prompt.match(/最後に(.{2,80})?(出したい|表示|入れたい)/);
  const actionUrl = urls.find((url) =>
    /(peatix|entry|register|signup|申込|予約|ticket)/i.test(url)
  );
  if (!finalText?.[1]) {
    return actionUrl ? formatUrlForCta(actionUrl) : undefined;
  }

  const finalCopy = finalText[1].replace(/[、。,.]$/g, "").trim();
  if (actionUrl && /(CTA|申込|予約|詳細|URL|Peatix)/i.test(finalCopy)) {
    return formatUrlForCta(actionUrl);
  }

  return finalCopy;
}

function buildVideoCopy(
  prompt: string,
  durationSec: number,
  cta: string | undefined
): {
  script: string;
  captions: string[];
  scenes: SceneSpec[];
} {
  const sceneCount = inferSceneCount(durationSec);
  const candidates = extractVideoCopyCandidates(prompt, cta);
  const captions = selectCaptions(candidates, cta, sceneCount);
  const scenes = buildScenesFromCaptions(captions, durationSec);

  return {
    script: captions.join("\n"),
    captions,
    scenes
  };
}

function inferSceneCount(durationSec: number): number {
  if (durationSec <= 8) return 2;
  if (durationSec <= 15) return 3;
  if (durationSec <= 24) return 4;
  if (durationSec <= 45) return 5;
  return 6;
}

function extractVideoCopyCandidates(
  prompt: string,
  cta: string | undefined
): string[] {
  const text = stripUrls(prompt);
  const candidates: string[] = [];
  const subject = extractSubjectCopy(text);
  if (subject) candidates.push(subject);

  const location = extractLocationCopy(text);
  if (location) candidates.push(location);

  const highlights = extractJoinedHighlights(text);
  if (highlights) candidates.push(highlights);

  const outcome = extractOutcomeCopy(text);
  if (outcome) candidates.push(outcome);

  for (const segment of splitPromptSegments(text)) {
    const candidate = rewriteSegmentAsCopy(segment);
    if (candidate) candidates.push(candidate);
  }

  if (cta) candidates.push(cta);
  return uniqueCopy(candidates);
}

function extractSubjectCopy(text: string): string | undefined {
  const match = text.match(
    /([^。\n]{2,42}?)(?:の)?(?:プロモ動画|告知動画|動画|映像)(?:を|に|で|$)/i
  );
  return match?.[1] ? sanitizeCopy(match[1]) : undefined;
}

function extractLocationCopy(text: string): string | undefined {
  const match = text.match(
    /([^、。\n]{0,24}(?:公民館|Mウイング|会場|ホール|スタジオ|オンライン)[^、。\n]{0,18})/
  );
  return match?.[1] ? sanitizeCopy(match[1]) : undefined;
}

function extractJoinedHighlights(text: string): string | undefined {
  const highlights = splitPromptSegments(text)
    .map((segment) => sanitizeCopy(segment))
    .filter((segment) =>
      /(限定|定員|参加枠|未経験|初心者|無料|見学|受付中|少人数)/.test(segment)
    )
    .slice(0, 3);

  return highlights.length >= 2 ? sanitizeCopy(highlights.join("・")) : undefined;
}

function extractOutcomeCopy(text: string): string | undefined {
  const match = text.match(
    /([^、。\n]{0,20}(?:思いつき|アイデア|実践|体験|学び|原型)[^、。\n]{0,24})/
  );
  return match?.[1] ? sanitizeCopy(match[1]) : undefined;
}

function splitPromptSegments(prompt: string): string[] {
  return prompt
    .split(/[\n\r。！？!?、,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function rewriteSegmentAsCopy(segment: string): string | undefined {
  const sanitized = sanitizeCopy(segment);
  if (!sanitized || isProductionDirective(sanitized)) return undefined;

  const rewritten = sanitized
    .replace(/(?:の)?(?:プロモ動画|告知動画|動画|映像)(?:を|に|で)?.*$/i, "")
    .replace(/(?:を)?(?:作りたい|生成したい|動画にしたい|見せたい).*$/i, "")
    .replace(/最後に.*$/i, "")
    .trim();

  return sanitizeCopy(rewritten || sanitized);
}

function rewriteSegmentAsTitle(segment: string): string | undefined {
  const sanitized = sanitizeCopy(segment);
  if (!sanitized) return undefined;

  const rewritten = sanitized
    .replace(/(?:の)?(?:プロモ動画|告知動画|動画|映像)(?:を|に|で)?.*$/i, "")
    .replace(/(?:を)?(?:作りたい|生成したい|動画にしたい|見せたい).*$/i, "")
    .replace(/最後に.*$/i, "")
    .trim();

  return sanitizeCopy(rewritten || sanitized);
}

function isProductionDirective(value: string): boolean {
  const hasProductionTerms =
    /(BGM|効果音|横長|縦型|正方形|ハイテンポ|尺|秒|sec|fps|アスペクト|render|レンダー|生成|作りたい|動画にしたい|出したい)/i.test(
      value
    );
  const hasContentTerms =
    /(イベント|勉強会|セミナー|開催|会場|参加|限定|未経験|無料|松本|AI|エージェント|商品|サービス|原型|申込|CTA)/i.test(
      value
    );

  return hasProductionTerms && !hasContentTerms;
}

function selectCaptions(
  candidates: string[],
  cta: string | undefined,
  sceneCount: number
): string[] {
  const selected = candidates.slice(0, sceneCount);

  while (selected.length < sceneCount) {
    selected.push(fallbackCaption(selected.length + 1, cta));
  }

  if (cta && !selected.includes(cta)) {
    selected[selected.length - 1] = cta;
  }

  return selected.map((caption) => truncateCopy(caption, 34));
}

function fallbackCaption(order: number, cta: string | undefined): string {
  if (cta && order >= 3) return cta;
  if (order === 1) return "見どころを一気に紹介";
  if (order === 2) return "大事な情報をリズムよく整理";
  return "詳細を短くわかりやすく";
}

function buildScenesFromCaptions(
  captions: string[],
  durationSec: number
): SceneSpec[] {
  const baseDuration = Math.round((durationSec / captions.length) * 10) / 10;
  let usedDuration = 0;

  return captions.map((caption, index) => {
    const isLast = index === captions.length - 1;
    const duration = isLast
      ? Math.max(1, Math.round((durationSec - usedDuration) * 10) / 10)
      : baseDuration;
    usedDuration += duration;

    return {
      id: `scene_${index + 1}`,
      order: index + 1,
      durationSec: duration,
      description: buildSceneDescription(caption, index, isLast),
      text: caption,
      camera: index === 0 ? "wide" : isLast ? "push-in" : "medium",
      transition: index === 0 ? "fade" : isLast ? "fade-out" : "cut",
      motion: index === 0 ? "hook reveal" : isLast ? "cta lockup" : "beat cut"
    };
  });
}

function buildSceneDescription(
  caption: string,
  index: number,
  isLast: boolean
): string {
  if (isLast) return `Close on: ${caption}`;
  if (index === 0) return `Open with: ${caption}`;
  return `Show beat ${index + 1}: ${caption}`;
}

function stripUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s)）]+/gi, " ");
}

function formatUrlForCta(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`
      .replace(/\/$/g, "")
      .trim();
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/g, "");
  }
}

function sanitizeCopy(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[「」『』"]/g, "")
    .replace(/^(URLは|URL|CTA|最後に|当日は)\s*/i, "")
    .replace(/(で|を|に|へ|と|、|。|,|\.|です|ます)$/g, "")
    .trim();
}

function truncateCopy(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

function uniqueCopy(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const copy = truncateCopy(sanitizeCopy(value), 42);
    if (!copy || seen.has(copy)) continue;
    seen.add(copy);
    result.push(copy);
  }

  return result;
}

function buildAssets(assetSources: string[], urls: string[]): AssetSpec[] {
  const fileAssets = assetSources.map((source, index) => ({
    id: `asset_${index + 1}`,
    type: inferAssetType(source),
    source,
    usage: inferAssetUsage(source)
  }));

  const urlAssets = urls.map((source, index) => ({
    id: `url_${index + 1}`,
    type: "url" as const,
    source,
    usage: "data" as const
  }));

  return [...fileAssets, ...urlAssets];
}

function inferAssetType(source: string): AssetType {
  if (/^https?:\/\//i.test(source)) return "url";
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(source)) return "image";
  if (/\.(mp4|mov|webm|m4v)$/i.test(source)) return "video";
  if (/\.(wav|mp3|m4a|aac|flac)$/i.test(source)) return "audio";
  if (/\.(srt|vtt|ass)$/i.test(source)) return "subtitle";
  if (/\.(json|csv)$/i.test(source)) return "json";
  return "json";
}

function inferAssetUsage(source: string): AssetSpec["usage"] {
  if (/\.(mp3|wav|m4a|aac|flac)$/i.test(source)) return "music";
  if (/\.(srt|vtt|ass)$/i.test(source)) return "data";
  if (/\.(json|csv)$/i.test(source)) return "data";
  if (/\.(mp4|mov|webm|m4v)$/i.test(source)) return "broll";
  return "background";
}

function extractUrls(input: string): string[] {
  return input.match(/https?:\/\/[^\s)）]+/gi) ?? [];
}
