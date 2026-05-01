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
  const cta = inferCta(prompt);
  const style = inferStyle(prompt);

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
      script: prompt,
      scenes: inferScenes(prompt, durationSec),
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

  return prompt
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

function inferCta(prompt: string): string | undefined {
  const quoted = [...prompt.matchAll(/[「『"]([^」』"]{2,80})[」』"]/g)].map(
    (match) => match[1]
  );
  if (quoted.length > 0) {
    return quoted.at(-1);
  }

  const finalText = prompt.match(/最後に(.{2,80})?(出したい|表示|入れたい)/);
  if (!finalText?.[1]) {
    return undefined;
  }

  return finalText[1].replace(/[、。,.]$/g, "").trim();
}

function inferScenes(prompt: string, durationSec: number): SceneSpec[] {
  const sceneCount = durationSec <= 12 ? 2 : 3;
  const baseDuration = Math.round((durationSec / sceneCount) * 10) / 10;
  const scenes: SceneSpec[] = [
    {
      id: "scene_intro",
      order: 1,
      durationSec: baseDuration,
      description: `Establish the request: ${prompt.slice(0, 96)}`,
      camera: "wide",
      transition: "fade",
      motion: "slow reveal"
    },
    {
      id: "scene_body",
      order: 2,
      durationSec: baseDuration,
      description: "Develop the main visual idea and supporting message.",
      camera: "medium",
      transition: "cut",
      motion: "layered motion"
    }
  ];

  if (sceneCount === 3) {
    scenes.push({
      id: "scene_cta",
      order: 3,
      durationSec: Math.max(1, durationSec - baseDuration * 2),
      description: "Close with title, CTA, or final information.",
      camera: "push-in",
      transition: "fade-out",
      motion: "title lockup"
    });
  }

  return scenes;
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

