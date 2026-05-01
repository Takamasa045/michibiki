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

  it("rejects an empty prompt", () => {
    expect(() =>
      createVideoSpecFromPrompt({
        prompt: "   "
      })
    ).toThrow("Prompt is required.");
  });
});

