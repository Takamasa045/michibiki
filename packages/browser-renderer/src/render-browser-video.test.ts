import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderBrowserVideo, type CommandRunner } from "./render-browser-video.js";

describe("renderBrowserVideo", () => {
  it("serves local entry files over localhost without broad file access", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "michibiki-browser-"));
    const entryFile = path.join(tempDir, "index.html");
    const renderDir = path.join(tempDir, "render");
    const commands: Array<{ command: string; args: string[] }> = [];
    const commandRunner: CommandRunner = async (command, args) => {
      commands.push({ command, args });

      if (command === "ffmpeg") {
        await fs.writeFile(path.join(renderDir, "output.mp4"), "mp4");
      } else {
        const screenshot = args.find((arg) => arg.startsWith("--screenshot="));
        if (screenshot) {
          await fs.writeFile(screenshot.slice("--screenshot=".length), "png");
        }
      }

      return {
        code: 0,
        stdout: "",
        stderr: "",
        command: [command, ...args].join(" ")
      };
    };
    await fs.writeFile(entryFile, "<!doctype html><title>ok</title>", "utf8");

    const result = await renderBrowserVideo({
      entryFile,
      renderDir,
      width: 100,
      height: 100,
      fps: 1,
      durationSec: 1,
      logLabel: "test",
      chromePath: "/fake/chrome",
      commandRunner
    });

    const chromeArgs = commands[0]?.args ?? [];
    const capturedUrl = chromeArgs.at(-1) ?? "";
    expect(result.ok).toBe(true);
    expect(chromeArgs).not.toContain("--allow-file-access-from-files");
    expect(capturedUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/index\.html\?/);
  });
});
