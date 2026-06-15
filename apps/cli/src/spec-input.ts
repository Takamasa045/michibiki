import fs from "node:fs/promises";
import path from "node:path";
import type { AssetSpec, VideoSpec } from "@michibiki/video-spec";

const URL_LIKE_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export async function loadVideoSpecFromFile(specPath: string): Promise<VideoSpec> {
  const resolvedPath = path.resolve(specPath);
  const raw = JSON.parse(await fs.readFile(resolvedPath, "utf8")) as VideoSpec;
  const specDir = path.dirname(resolvedPath);

  return {
    ...raw,
    assets: raw.assets.map((asset) => resolveAssetSource(asset, specDir))
  };
}

function resolveAssetSource(asset: AssetSpec, specDir: string): AssetSpec {
  if (URL_LIKE_PATTERN.test(asset.source) || path.isAbsolute(asset.source)) {
    return asset;
  }

  return {
    ...asset,
    source: path.resolve(specDir, asset.source)
  };
}
