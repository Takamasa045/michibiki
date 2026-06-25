import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "@michibiki/video-spec";
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

  it("stages multiple visual assets as primary cuts and short inserts", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "縦横のスケボー素材を白い手書きラインと星でミックスしたい",
      durationSec: 15,
      aspectRatio: "9:16",
      assetSources: ["./landscape.mp4", "./vertical.mp4"]
    });
    const timeline = buildEditframeTimeline(spec);
    const primaryVideoClips = timeline.clips.filter(
      (clip) => clip.type === "video" && clip.role === "primary"
    );
    const insertVideoClips = timeline.clips.filter(
      (clip) => clip.type === "video" && clip.role === "insert"
    );

    expect(primaryVideoClips).toHaveLength(2);
    expect(primaryVideoClips.map((clip) => clip.startSec)).toEqual([0, 7.5]);
    expect(primaryVideoClips.every((clip) => clip.durationSec < 15)).toBe(true);
    expect(insertVideoClips).toHaveLength(2);
    expect(insertVideoClips.every((clip) => clip.durationSec <= 2)).toBe(true);
    expect(
      timeline.clips.some((clip) => clip.id.startsWith("clip_motion_overlay_"))
    ).toBe(true);
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
      fs.readFile(path.join(project.rootPath, "package.json"), "utf8")
    ).resolves.toContain("@editframe/api");
    await expect(
      fs.readFile(path.join(project.rootPath, "preview.html"), "utf8")
    ).resolves.toContain("videoRouterFrame");
    await expect(
      fs.readFile(path.join(project.rootPath, "preview.html"), "utf8")
    ).resolves.toContain("timeline status");
    await expect(
      fs.readFile(path.join(project.rootPath, "preview.html"), "utf8")
    ).resolves.not.toContain("Vlog素材を編集して字幕付きショート動画を作りたい");
    expect(existsSync(path.join(tempDir, "project", "project.json"))).toBe(true);
  });
});
