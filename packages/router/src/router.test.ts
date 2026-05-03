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
      confidence: 1,
      engineFits: expect.arrayContaining([
        expect.objectContaining({ engine: "remotion" }),
        expect.objectContaining({ engine: "hyperframes" }),
        expect.objectContaining({ engine: "editframe" })
      ]),
      selectionGuide: expect.stringContaining("Recommended engine: hyperframes")
    });
  });

  it("routes video/audio workflows to Editframe", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "素材フォルダから字幕付きショート動画を作りたい",
      assetSources: ["./assets/talk.mp4", "./assets/bgm.mp3"]
    });

    const decision = selectEngine(spec);
    expect(decision).toMatchObject({
      engine: "editframe",
      fallback: "remotion",
      recommendation: {
        summary: expect.stringContaining("Editframe"),
        strengths: expect.arrayContaining([expect.stringContaining("timeline")]),
        tradeoffs: expect.arrayContaining([expect.stringContaining("handoff")]),
        creativeDirection: expect.stringContaining("caption-led")
      }
    });
    expect(sumFitPercents(decision.engineFits)).toBe(100);
    expect(findFitPercent(decision.engineFits, "editframe")).toBeGreaterThan(
      findFitPercent(decision.engineFits, "remotion")
    );
    expect(decision.selectionGuide).toContain("Recommended engine: editframe");
  });

  it("routes URL/DOM workflows to HyperFrames", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "LPをGSAPっぽく動画化したい https://example.com"
    });

    const decision = selectEngine(spec);
    expect(decision).toMatchObject({
      engine: "hyperframes",
      licenseRisk: "low",
      recommendation: {
        summary: expect.stringContaining("HyperFrames"),
        strengths: expect.arrayContaining([expect.stringContaining("DOM")]),
        tradeoffs: expect.arrayContaining([expect.stringContaining("footage")]),
        creativeDirection: expect.stringContaining("browser-native")
      }
    });
    expect(sumFitPercents(decision.engineFits)).toBe(100);
    expect(findFitPercent(decision.engineFits, "hyperframes")).toBeGreaterThan(
      findFitPercent(decision.engineFits, "remotion")
    );
    expect(decision.engineFits[0]).toMatchObject({
      engine: "hyperframes",
      bestUse: expect.stringContaining("plain HTML/CSS/JS"),
      featureHighlights: expect.arrayContaining([
        expect.stringContaining("Seek-driven deterministic capture")
      ])
    });
  });

  it("uses score-based selection so asset attachment alone does not lock Editframe in", () => {
    const spec = createVideoSpecFromPrompt({
      prompt:
        "LP風セクションでクリップを動画埋め込み風に見せたい、HTMLとCSSで組みたい",
      assetSources: ["./clip.mp4"]
    });

    const decision = selectEngine(spec);

    expect(decision.engine).toBe("hyperframes");
    expect(findFitPercent(decision.engineFits, "hyperframes")).toBeGreaterThan(
      findFitPercent(decision.engineFits, "editframe")
    );
  });

  describe("signal extraction edge cases (regression)", () => {
    const cases = [
      {
        name: "no-asset prompt does not get false-positive editframe boost from word 素材",
        prompt: "素材なしで完全に0から動画を作りたい",
        expected: "remotion"
      },
      {
        name: "URL used only as a reference does not lock in HyperFrames",
        prompt:
          "詳細はこちらのURLを参照 https://example.com イベント告知動画を作って",
        expected: "remotion"
      },
      {
        name: "explicit kinetic typography in a captioned vertical short still routes to Remotion",
        prompt: "字幕付きの縦型ショート、kinetic typoが中心、素材は無し",
        expected: "remotion"
      },
      {
        name: "narration + BGM + edit intent routes to Editframe",
        prompt: "ナレーションをBGMに合わせて編集したい",
        expected: "editframe"
      },
      {
        name: "product page request routes to HyperFrames via web/page synonym",
        prompt: "プロダクトページを動画にして",
        expected: "hyperframes"
      },
      {
        name: "GSAP scroll motion routes to HyperFrames",
        prompt: "GSAPの既存スクロール演出を動画化したい",
        expected: "hyperframes"
      },
      {
        name: "JSON brief alone is not enough to score Remotion higher than the default",
        prompt: "JSONブリーフを読み込んで動画を作る",
        expected: "remotion"
      }
    ] as const;

    for (const testCase of cases) {
      it(testCase.name, () => {
        const decision = selectEngine(
          createVideoSpecFromPrompt({ prompt: testCase.prompt })
        );
        expect(decision.engine).toBe(testCase.expected);
      });
    }
  });

  it("returns switchHints for the two non-selected engines", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "イベント告知動画を30秒で作りたい。縦型でタイトルを出したい。"
    });

    const decision = selectEngine(spec);

    expect(decision.engine).toBe("remotion");
    expect(decision.switchHints).toHaveLength(2);
    const targets = decision.switchHints.map((hint) => hint.targetEngine).sort();
    expect(targets).toEqual(["editframe", "hyperframes"]);
    for (const hint of decision.switchHints) {
      expect(hint.targetEngine).not.toBe(decision.engine);
      expect(hint.condition.length).toBeGreaterThan(20);
      expect(hint.why.length).toBeGreaterThan(20);
    }
  });

  it("defaults to Remotion for template motion graphics", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "イベント告知動画を30秒で作りたい。縦型でタイトルを出したい。"
    });

    const decision = selectEngine(spec);
    expect(decision).toMatchObject({
      engine: "remotion",
      fallback: "hyperframes",
      recommendation: {
        summary: expect.stringContaining("Remotion"),
        strengths: expect.arrayContaining([
          expect.stringContaining("kinetic typography")
        ]),
        tradeoffs: expect.arrayContaining([expect.stringContaining("external")]),
        creativeDirection: expect.stringContaining("hook")
      }
    });
    expect(sumFitPercents(decision.engineFits)).toBe(100);
    expect(findFitPercent(decision.engineFits, "remotion")).toBeGreaterThan(
      findFitPercent(decision.engineFits, "editframe")
    );
    expect(decision.engineFits[0]).toMatchObject({
      engine: "remotion",
      bestUse: expect.stringContaining("one-off"),
      featureHighlights: expect.arrayContaining([
        expect.stringContaining("Sequence")
      ])
    });
    expect(getFitBestUse(decision.engineFits, "remotion")).toContain(
      "kinetic typography"
    );
    expect(getFitBestUse(decision.engineFits, "editframe")).toContain(
      "timeline-shaped"
    );
  });
});

function sumFitPercents(
  engineFits: Array<{ fitPercent: number }>
): number {
  return engineFits.reduce((sum, fit) => sum + fit.fitPercent, 0);
}

function findFitPercent(
  engineFits: Array<{ engine: string; fitPercent: number }>,
  engine: string
): number {
  const fit = engineFits.find((candidate) => candidate.engine === engine);
  if (!fit) throw new Error(`Missing fit for ${engine}`);
  return fit.fitPercent;
}

function getFitBestUse(
  engineFits: Array<{ engine: string; bestUse: string }>,
  engine: string
): string {
  const fit = engineFits.find((candidate) => candidate.engine === engine);
  if (!fit) throw new Error(`Missing fit for ${engine}`);
  return fit.bestUse;
}
