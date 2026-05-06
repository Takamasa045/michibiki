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

  it("routes HTML-in-canvas DOM post-processing to Remotion", () => {
    const spec = createVideoSpecFromPrompt({
      prompt:
        "LPのDOMをHTML-in-canvasでcanvas化してグリッチとblur shaderをかける動画"
    });

    const decision = selectEngine(spec);
    const remotionFit = decision.engineFits.find(
      (fit) => fit.engine === "remotion"
    );

    expect(decision.engine).toBe("remotion");
    expect(findFitPercent(decision.engineFits, "remotion")).toBeGreaterThan(
      findFitPercent(decision.engineFits, "hyperframes")
    );
    expect(remotionFit).toMatchObject({
      reason: expect.stringContaining("HTML-in-canvas"),
      bestUse: expect.stringContaining("HTML-in-canvas"),
      featureHighlights: expect.arrayContaining([
        expect.stringContaining("HTML-in-canvas")
      ])
    });
    expect(decision.recommendation.strengths).toEqual(
      expect.arrayContaining([expect.stringContaining("HTML-in-canvas")])
    );
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
        name: "URL page content-only request does not route to HyperFrames",
        prompt:
          "このPeatixページの内容を使って、ページ自体は映さずに30秒の縦型告知動画を作りたい https://example.com",
        expected: "remotion"
      },
      {
        name: "explicit kinetic typography in a captioned vertical short still routes to Remotion",
        prompt: "字幕付きの縦型ショート、kinetic typoが中心、素材は無し",
        expected: "remotion"
      },
      {
        name: "BGM and SFX support alone stays visual-first",
        prompt: "イベント告知動画を作りたい。BGMと効果音も生成する",
        expected: "remotion"
      },
      {
        name: "narration + BGM + edit intent routes to Editframe",
        prompt: "ナレーションをBGMに合わせて編集したい",
        expected: "editframe"
      },
      {
        name: "BGM beat cuts route to Editframe",
        prompt: "BGMのビートや盛り上がりでカットを切る動画",
        expected: "editframe"
      },
      {
        name: "waveform and beat markers route to Editframe",
        prompt: "音声波形や beat marker を基準にシーン尺を決める",
        expected: "editframe"
      },
      {
        name: "narration phrase timed visual elements stay Remotion-friendly",
        prompt: "ナレーションの文節に合わせて字幕や画面要素を出す",
        expected: "remotion"
      },
      {
        name: "SFX timed zooms and titles stay Remotion-friendly",
        prompt: "効果音のタイミングでズーム、切り替え、テロップを当てる",
        expected: "remotion"
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
      },
      {
        name: "explainer/tutorial videos route to Remotion",
        prompt: "3分の解説動画を作りたい、図解中心",
        expected: "remotion"
      },
      {
        name: "data visualization (dashboard/KPI) routes to Remotion",
        prompt: "ダッシュボードのKPIを動画で見せたい",
        expected: "remotion"
      },
      {
        name: "lyric/MV requests route to Remotion",
        prompt: "プロダクトのリリックビデオMVを作る",
        expected: "remotion"
      },
      {
        name: "webinar recap routes to Editframe",
        prompt: "ウェビナーのリキャップ動画",
        expected: "editframe"
      },
      {
        name: "avatar / talking-head requests route to HyperFrames",
        prompt: "アバターが解説するWeb動画",
        expected: "hyperframes"
      },
      {
        name: "CSV-driven batch render routes to Remotion",
        prompt: "商品データCSVから100本の動画をバッチレンダ",
        expected: "remotion"
      },
      {
        name: "slideshow keyword routes to Editframe",
        prompt: "スライドショー形式で見せたい",
        expected: "editframe"
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

    it("multi-image asset attachment routes to Editframe (slideshow)", () => {
      const decision = selectEngine(
        createVideoSpecFromPrompt({
          prompt: "商品画像10枚をスライドショーに",
          assetSources: ["./img1.png", "./img2.png", "./img3.png"]
        })
      );
      expect(decision.engine).toBe("editframe");
    });

    describe("negation and meta-reference handling", () => {
      const negationCases = [
        {
          name: "verb-negation suppresses LP signal: LPは作らないが",
          prompt: "LPは作らないが、シンプルな企業ロゴアニメだけ",
          expected: "remotion"
        },
        {
          name: "verb-negation suppresses GSAP signal: GSAPは使わない",
          prompt: "GSAPは使わない、ピュアなReactモーション",
          expected: "remotion"
        },
        {
          name: "post-keyword negation suppresses ナレーション: ナレーションは無い",
          prompt: "キネティックタイポを中心にしたい、ナレーションは無い",
          expected: "remotion"
        },
        {
          name: "meta reference suppresses 動画編集 when used as topic, not intent",
          prompt: "動画編集の話を取り上げる解説動画",
          expected: "remotion"
        },
        {
          name: "router only reads spec.goal so auto-inferred title (Website Trailer) cannot revive negated LP signal",
          prompt: "LPは作らないが、ロゴアニメだけ",
          expected: "remotion"
        }
      ] as const;

      for (const testCase of negationCases) {
        it(testCase.name, () => {
          const decision = selectEngine(
            createVideoSpecFromPrompt({ prompt: testCase.prompt })
          );
          expect(decision.engine).toBe(testCase.expected);
        });
      }
    });

    it("emits a clarifying question when top vs runner-up margin ≤ 8%", () => {
      const decision = selectEngine(
        createVideoSpecFromPrompt({
          prompt:
            "LP風セクションでクリップを動画埋め込み風に見せたい、HTMLとCSSで組みたい",
          assetSources: ["./clip.mp4"]
        })
      );
      const sorted = [...decision.engineFits].sort(
        (left, right) => right.fitPercent - left.fitPercent
      );
      const margin = (sorted[0]?.fitPercent ?? 0) - (sorted[1]?.fitPercent ?? 0);
      if (margin <= 8) {
        expect(decision.clarifyingQuestions.length).toBeGreaterThan(0);
        expect(decision.clarifyingQuestions[0]).toMatch(/Two engines/);
      }
    });

    it("returns no clarifying question when the lead is decisive", () => {
      const decision = selectEngine(
        createVideoSpecFromPrompt({
          prompt: "GSAPの既存スクロール演出を動画化したい"
        })
      );
      expect(decision.clarifyingQuestions).toEqual([]);
    });

    it("close-call selectionGuide warns when top vs runner-up margin is small", () => {
      const decision = selectEngine(
        createVideoSpecFromPrompt({
          prompt:
            "詳細はこちらのURLを参照 https://example.com イベント告知動画を作って"
        })
      );
      const sorted = [...decision.engineFits].sort(
        (left, right) => right.fitPercent - left.fitPercent
      );
      const margin = (sorted[0]?.fitPercent ?? 0) - (sorted[1]?.fitPercent ?? 0);
      if (margin <= 8) {
        expect(decision.selectionGuide).toContain("Close call");
      }
    });
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

  it("keeps Editframe as a switch hint when generated audio should drive editing", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "イベント告知動画を作りたい。BGMと効果音も生成する"
    });

    const decision = selectEngine(spec);
    const editframeHint = decision.switchHints.find(
      (hint) => hint.targetEngine === "editframe"
    );

    expect(decision.engine).toBe("remotion");
    expect(findFitPercent(decision.engineFits, "remotion")).toBeGreaterThan(
      findFitPercent(decision.engineFits, "editframe")
    );
    expect(editframeHint).toMatchObject({
      condition: expect.stringContaining("generated BGM/SFX"),
      why: expect.stringContaining("timeline rhythm")
    });
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
