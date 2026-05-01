import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { resolveChromePath } from "@michibiki/browser-renderer";
import { getRemotionRepoCandidates, resolveRemotionRepoPath } from "@michibiki/engine-remotion";

export type DoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export function runDoctor(cwd = process.cwd()): DoctorCheck[] {
  const remotionRepoPath = resolveRemotionRepoPath(undefined, cwd);
  const pnpm = commandVersion("pnpm", ["-v"]);
  const ffmpeg = commandVersion("ffmpeg", ["-version"]);
  const chromePath = resolveChromePath();

  return [
    {
      name: "Node.js",
      ok: true,
      detail: process.version
    },
    {
      name: "pnpm",
      ok: pnpm.ok,
      detail: pnpm.detail
    },
    {
      name: "ffmpeg",
      ok: ffmpeg.ok,
      detail: ffmpeg.detail.split(/\r?\n/)[0] ?? ffmpeg.detail
    },
    {
      name: "Chrome renderer",
      ok: Boolean(chromePath),
      detail: chromePath ?? "not found; set VIDEO_ROUTER_CHROME"
    },
    {
      name: "outputs directory",
      ok: existsSync(path.resolve(cwd, "outputs")),
      detail: path.resolve(cwd, "outputs")
    },
    {
      name: "ENGINE_LICENSES.md",
      ok: existsSync(path.resolve(cwd, "docs", "ENGINE_LICENSES.md")),
      detail: path.resolve(cwd, "docs", "ENGINE_LICENSES.md")
    },
    {
      name: "THIRD_PARTY_NOTICES.md",
      ok: existsSync(path.resolve(cwd, "docs", "THIRD_PARTY_NOTICES.md")),
      detail: path.resolve(cwd, "docs", "THIRD_PARTY_NOTICES.md")
    },
    {
      name: "Remotion monorepo",
      ok: existsSync(path.join(remotionRepoPath, "package.json")),
      detail: existsSync(path.join(remotionRepoPath, "package.json"))
        ? remotionRepoPath
        : `not found; checked ${getRemotionRepoCandidates(cwd).join(", ")}`
    },
    {
      name: "Remotion default template",
      ok: existsSync(path.join(remotionRepoPath, "apps", "_template")),
      detail: path.join(remotionRepoPath, "apps", "_template")
    },
    {
      name: "Remotion 3D template",
      ok: existsSync(path.join(remotionRepoPath, "apps", "3D-template")),
      detail: path.join(remotionRepoPath, "apps", "3D-template")
    }
  ];
}

export function printDoctor(checks: DoctorCheck[]): void {
  for (const check of checks) {
    const status = check.ok ? "OK" : "WARN";
    console.log(`${status.padEnd(5)} ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.log("");
    console.log("Some optional or required checks need attention.");
  }
}

function commandVersion(
  command: string,
  args: string[]
): { ok: boolean; detail: string } {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false
  });

  if (result.error) {
    return { ok: false, detail: result.error.message };
  }

  return {
    ok: result.status === 0,
    detail: (result.stdout || result.stderr || `exit ${result.status}`).trim()
  };
}
