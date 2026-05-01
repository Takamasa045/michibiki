import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function resolveChromePath(): string | undefined {
  const candidates = [
    process.env.VIDEO_ROUTER_CHROME,
    path.join(
      os.homedir(),
      "apps/remotion-studio-monorepo/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell"
    ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => existsSync(candidate));
}

