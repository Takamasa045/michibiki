import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "@video-router/video-spec";
import {
  canHyperFramesHandle,
  createHyperFramesEngine
} from "./hyperframes-engine.js";

describe("HyperFrames engine", () => {
  it("handles URL and web-style specs", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "LPをDOMアニメーションで動画化したい https://example.com"
    });

    expect(canHyperFramesHandle(spec)).toBe(true);
  });

  it("generates a browser-previewable project", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperframes-"));
    const spec = createVideoSpecFromPrompt({
      prompt: "SaaSのLPを15秒のWeb動画にしたい https://example.com"
    });
    const engine = createHyperFramesEngine();

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    expect(project.engine).toBe("hyperframes");
    await expect(
      fs.readFile(path.join(project.rootPath, "index.html"), "utf8")
    ).resolves.toContain('<script src="./motion.js"></script>');
    await expect(
      fs.readFile(path.join(project.rootPath, "motion.js"), "utf8")
    ).resolves.toContain("frameParam");
    expect(existsSync(path.join(tempDir, "project", "project.json"))).toBe(true);
  });
});
