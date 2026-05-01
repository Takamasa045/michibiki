import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function getRemotionRepoCandidates(cwd = process.cwd()): string[] {
  const candidates = [
    process.env.VIDEO_ROUTER_REMOTION_REPO,
    path.resolve(cwd, "engines/remotion-studio-monorepo"),
    path.resolve(cwd, "../remotion-studio-monorepo"),
    path.resolve(homedir(), "apps/remotion-studio-monorepo")
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function resolveRemotionRepoPath(
  explicitPath?: string,
  cwd = process.cwd()
): string {
  if (explicitPath) {
    return path.resolve(cwd, explicitPath);
  }

  const found = getRemotionRepoCandidates(cwd).find((candidate) =>
    existsSync(path.join(candidate, "package.json"))
  );

  return found ?? path.resolve(cwd, "engines/remotion-studio-monorepo");
}

