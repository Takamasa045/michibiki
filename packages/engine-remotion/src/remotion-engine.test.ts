import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "@video-router/video-spec";
import { canRemotionHandle, selectRemotionTemplate } from "./remotion-engine.js";

describe("Remotion engine helpers", () => {
  it("handles template-style specs without video/audio assets", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "縦型イベント告知動画を作りたい"
    });

    expect(canRemotionHandle(spec)).toBe(true);
  });

  it("does not claim audio/video timeline-heavy specs in auto mode", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "素材を編集して字幕付き動画を作りたい",
      assetSources: ["./clip.mp4"]
    });

    expect(canRemotionHandle(spec)).toBe(false);
  });

  it("selects 3D template for spatial requests", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "3Dタイトルシーケンスを作りたい"
    });

    expect(selectRemotionTemplate(spec)).toBe("3d");
  });
});

