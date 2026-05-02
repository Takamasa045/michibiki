import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "@michibiki/video-spec";
import { selectEngine } from "./router.js";

describe("selectEngine", () => {
  it("honors explicit engine preference", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "テンプレート動画を作りたい",
      enginePreference: "hyperframes"
    });

    expect(selectEngine(spec)).toMatchObject({
      engine: "hyperframes",
      confidence: 1
    });
  });

  it("routes video/audio workflows to Editframe", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "素材フォルダから字幕付きショート動画を作りたい",
      assetSources: ["./assets/talk.mp4", "./assets/bgm.mp3"]
    });

    expect(selectEngine(spec)).toMatchObject({
      engine: "editframe",
      fallback: "remotion",
      recommendation: {
        summary: expect.stringContaining("Editframe"),
        strengths: expect.arrayContaining([expect.stringContaining("timeline")]),
        tradeoffs: expect.arrayContaining([expect.stringContaining("handoff")]),
        creativeDirection: expect.stringContaining("captions")
      }
    });
  });

  it("routes URL/DOM workflows to HyperFrames", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "LPをGSAPっぽく動画化したい https://example.com"
    });

    expect(selectEngine(spec)).toMatchObject({
      engine: "hyperframes",
      licenseRisk: "low",
      recommendation: {
        summary: expect.stringContaining("HyperFrames"),
        strengths: expect.arrayContaining([expect.stringContaining("DOM")]),
        tradeoffs: expect.arrayContaining([expect.stringContaining("footage")]),
        creativeDirection: expect.stringContaining("browser-native")
      }
    });
  });

  it("defaults to Remotion for template motion graphics", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "イベント告知動画を30秒で作りたい。縦型でタイトルを出したい。"
    });

    expect(selectEngine(spec)).toMatchObject({
      engine: "remotion",
      fallback: "hyperframes",
      recommendation: {
        summary: expect.stringContaining("Remotion"),
        strengths: expect.arrayContaining([expect.stringContaining("template")]),
        tradeoffs: expect.arrayContaining([expect.stringContaining("external")]),
        creativeDirection: expect.stringContaining("hook")
      }
    });
  });
});
