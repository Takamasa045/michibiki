import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "@video-router/video-spec";
import {
  buildEditframeTimeline,
  canEditframeHandle,
  createEditframeEngine
} from "./editframe-engine.js";

describe("Editframe engine", () => {
  it("handles audio/video asset workflows", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "素材を使って字幕付きショート動画を作りたい",
      assetSources: ["./clip.mp4", "./voice.mp3"]
    });

    expect(canEditframeHandle(spec)).toBe(true);
  });

  it("builds a timeline with asset and text clips", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "素材を使って字幕付きショート動画を作りたい",
      assetSources: ["./clip.mp4", "./voice.mp3"]
    });
    const timeline = buildEditframeTimeline(spec);

    expect(timeline.clips.some((clip) => clip.type === "video")).toBe(true);
    expect(timeline.clips.some((clip) => clip.type === "audio")).toBe(true);
    expect(timeline.clips.some((clip) => clip.type === "text")).toBe(true);
  });

  it("generates an Editframe handoff project", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "editframe-"));
    const spec = createVideoSpecFromPrompt({
      prompt: "Vlog素材を編集して字幕付きショート動画を作りたい",
      assetSources: ["./clip.mp4", "./bgm.mp3"]
    });
    const engine = createEditframeEngine();

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    expect(project.engine).toBe("editframe");
    expect(existsSync(path.join(project.rootPath, "timeline.json"))).toBe(true);
    await expect(
      fs.readFile(path.join(project.rootPath, "preview.html"), "utf8")
    ).resolves.toContain("videoRouterFrame");
    expect(existsSync(path.join(tempDir, "project", "project.json"))).toBe(true);
  });
});
