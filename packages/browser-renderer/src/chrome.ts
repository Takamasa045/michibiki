import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type ChromePathCandidateOptions = {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  platform?: NodeJS.Platform;
};

export function resolveChromePath(): string | undefined {
  return getChromePathCandidates().find((candidate) => existsSync(candidate));
}

export function getChromePathCandidates(
  options: ChromePathCandidateOptions = {}
): string[] {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();
  const platform = options.platform ?? process.platform;
  const candidates =
    platform === "win32"
      ? windowsChromeCandidates(env, homeDir)
      : posixChromeCandidates(env, homeDir);

  return [...new Set(candidates.filter((value): value is string => Boolean(value)))];
}

function posixChromeCandidates(
  env: NodeJS.ProcessEnv,
  homeDir: string
): Array<string | undefined> {
  return [
    env.VIDEO_ROUTER_CHROME,
    path.join(
      homeDir,
      "apps/remotion-studio-monorepo/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell"
    ),
    path.join(
      homeDir,
      "apps/remotion-studio-monorepo/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell"
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ];
}

function windowsChromeCandidates(
  env: NodeJS.ProcessEnv,
  homeDir: string
): Array<string | undefined> {
  const programFiles = env.ProgramFiles;
  const programFilesX86 = env["ProgramFiles(x86)"];
  const localAppData = env.LOCALAPPDATA;
  const win = path.win32;

  return [
    env.VIDEO_ROUTER_CHROME,
    win.join(
      homeDir,
      "apps",
      "remotion-studio-monorepo",
      "node_modules",
      ".remotion",
      "chrome-headless-shell",
      "win64",
      "chrome-headless-shell-win64",
      "chrome-headless-shell.exe"
    ),
    programFiles && win.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 &&
      win.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    localAppData && win.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles &&
      win.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFilesX86 &&
      win.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    localAppData &&
      win.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFiles && win.join(programFiles, "Chromium", "Application", "chrome.exe"),
    localAppData && win.join(localAppData, "Chromium", "Application", "chrome.exe")
  ];
}
