import path from "node:path";
import type { VideoSpec } from "@michibiki/video-spec";

// HTML-in-Canvas registry: the official block catalog plus selection,
// detection, and install-output parsing. Pure data + spec->block logic,
// decoupled from the engine generate/render flow.

export type HtmlInCanvasRegistryBlock = {
  id: string;
  src: string;
  title: string;
  durationSec: number;
  width: number;
  height: number;
};

export const HTML_IN_CANVAS_REGISTRY_NAME = "html-in-canvas";

const HTML_IN_CANVAS_REGISTRY_BLOCKS: Record<string, HtmlInCanvasRegistryBlock> =
  {
    "vfx-text-cursor": {
      id: "vfx-text-cursor",
      src: "compositions/vfx-text-cursor.html",
      title: "VFX Text Cursor",
      durationSec: 8,
      width: 1920,
      height: 1080
    },
    "vfx-liquid-background": {
      id: "vfx-liquid-background",
      src: "compositions/vfx-liquid-background.html",
      title: "Liquid Background",
      durationSec: 12,
      width: 1920,
      height: 1080
    },
    "vfx-iphone-device": {
      id: "vfx-iphone-device",
      src: "compositions/vfx-iphone-device.html",
      title: "iPhone & MacBook 3D Showcase",
      durationSec: 15,
      width: 1920,
      height: 1080
    },
    "vfx-magnetic": {
      id: "vfx-magnetic",
      src: "compositions/vfx-magnetic.html",
      title: "Magnetic",
      durationSec: 15,
      width: 1920,
      height: 1080
    },
    "vfx-portal": {
      id: "vfx-portal",
      src: "compositions/vfx-portal.html",
      title: "Portal",
      durationSec: 10,
      width: 1920,
      height: 1080
    },
    "vfx-liquid-glass": {
      id: "vfx-liquid-glass",
      src: "compositions/vfx-liquid-glass.html",
      title: "Liquid Glass",
      durationSec: 20,
      width: 1920,
      height: 1080
    },
    "vfx-shatter": {
      id: "vfx-shatter",
      src: "compositions/vfx-shatter.html",
      title: "Shatter",
      durationSec: 12,
      width: 1920,
      height: 1080
    }
  };

export function parseRegistryInstalledItems(
  stdout: string,
  fallbackName: string
): string[] {
  try {
    const parsed = JSON.parse(stdout) as {
      installed?: unknown;
      written?: unknown;
      name?: unknown;
    };
    if (Array.isArray(parsed.installed)) {
      return parsed.installed.filter((item): item is string => typeof item === "string");
    }
    if (Array.isArray(parsed.written)) {
      return parsed.written
        .filter((item): item is string => typeof item === "string")
        .map((item) => path.basename(item, path.extname(item)));
    }
    if (typeof parsed.name === "string") {
      return [parsed.name];
    }
  } catch {
    // Fall back to the registry name when the CLI output is not JSON.
  }
  return [fallbackName];
}

export function selectHtmlInCanvasRegistryBlock(
  spec: VideoSpec
): HtmlInCanvasRegistryBlock | undefined {
  const text = [spec.goal, spec.title, spec.style.motionStyle, spec.style.visualTone]
    .join(" ")
    .toLowerCase();
  if (!mentionsHtmlInCanvasRegistry(text)) return undefined;

  if (/(iphone|macbook|device|デバイス|スマホ|スマートフォン|phone|3d|gltf)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-iphone-device"];
  }
  if (/(liquid glass|glass|ガラス|voronoi|parallax|パララックス)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-liquid-glass"];
  }
  if (/(liquid|fluid|background|背景|波|wave|ripple)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-liquid-background"];
  }
  if (/(portal|ポータル|dimension|次元)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-portal"];
  }
  if (/(shatter|break|破片|割れ|砕け|ガラス片)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-shatter"];
  }
  if (/(magnetic|磁場|磁力|particle|粒子)/i.test(text)) {
    return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-magnetic"];
  }
  return HTML_IN_CANVAS_REGISTRY_BLOCKS["vfx-text-cursor"];
}

function mentionsHtmlInCanvasRegistry(text: string): boolean {
  return /(html[- ]?in[- ]?canvas|drawElementImage|canvas-draw-element|canvasdrawelement|layoutsubtree|dom[^、。.!?\n]{0,24}(?:canvas|キャンバス|webgl|shader|シェーダー)|html[^、。.!?\n]{0,24}(?:canvas|キャンバス|webgl|shader|シェーダー)|(?:canvas|キャンバス)[^、。.!?\n]{0,24}(?:dom|html))/i.test(
    text
  );
}
