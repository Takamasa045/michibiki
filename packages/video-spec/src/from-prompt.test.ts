import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "./from-prompt.js";

describe("createVideoSpecFromPrompt", () => {
  it("infers vertical event promo settings from Japanese prompt", () => {
    const spec = createVideoSpecFromPrompt({
      id: "spec_test",
      prompt:
        "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型で、焚き火、星空、AIエージェント感を入れて、最後に「5月30日 松本開催」と出したい。"
    });

    expect(spec.id).toBe("spec_test");
    expect(spec.title).toBe("Event Promo");
    expect(spec.format.aspectRatio).toBe("9:16");
    expect(spec.format.durationSec).toBe(30);
    expect(spec.content.cta).toBe("5月30日 松本開催");
    expect(spec.style.visualTone).toBe("nature cinematic");
  });

  it("adds URL assets for web references", () => {
    const spec = createVideoSpecFromPrompt({
      id: "spec_url",
      prompt: "このLPを動画にしたい https://example.com",
      referenceUrls: ["https://example.org"]
    });

    expect(spec.assets.map((asset) => asset.type)).toEqual(["url", "url"]);
    expect(spec.style.reference).toEqual([
      "https://example.com",
      "https://example.org"
    ]);
  });

  it("reconstructs long requests into concise video copy", () => {
    const prompt = [
      "20秒ハイテンポ 横長 BGM、効果音はあり https://ai-lab0530.peatix.com",
      "AIエージェント勉強会のプロモ動画を作りたい。",
      "松本の中央公民館 Mウイングで、限定5名、未経験歓迎、無料ツール中心。",
      "当日は思いつきをその場で原型にして、最後にPeatix申込CTAを出したい。"
    ].join("\n");

    const spec = createVideoSpecFromPrompt({
      id: "spec_copy",
      prompt
    });
    const sceneText = spec.content.scenes?.map((scene) => scene.text ?? "");

    expect(spec.content.script).not.toBe(prompt);
    expect(spec.content.script).toContain("AIエージェント勉強会");
    expect(spec.content.cta).toBe("ai-lab0530.peatix.com");
    expect(sceneText).toEqual(
      expect.arrayContaining([
        "AIエージェント勉強会",
        "松本の中央公民館 Mウイング",
        "限定5名・未経験歓迎・無料ツール中心"
      ])
    );
    expect(sceneText?.every((text) => text.length <= 34)).toBe(true);
    expect(sceneText?.join(" ")).not.toContain("https://");
  });

  it("rejects an empty prompt", () => {
    expect(() =>
      createVideoSpecFromPrompt({
        prompt: "   "
      })
    ).toThrow("Prompt is required.");
  });
});
