import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createVideoSpecFromPrompt,
  type EngineName
} from "@michibiki/video-spec";
import { selectEngine } from "@michibiki/router";

const examples = [
  { slug: "event-promo" },
  { slug: "lp-trailer" },
  { slug: "asset-short" },
  { slug: "data-video" }
] satisfies Array<{ slug: string }>;

type ExampleInputType = "natural-language" | "url" | "structured" | "assets";

type ExampleMetadata = {
  engine?: EngineName;
  inputType?: ExampleInputType;
  promptFile?: string;
  assetSources?: string[];
  requiredDecisionFields?: string[];
};

describe("examples", () => {
  it("keeps each entry point routable with engine-fit guidance", async () => {
    const inputTypes = new Set<ExampleInputType>();

    for (const example of examples) {
      const root = path.resolve("examples", example.slug);
      const metadata = JSON.parse(
        await fs.readFile(path.join(root, "expected-engine.json"), "utf8")
      ) as ExampleMetadata;
      const promptFile = metadata.promptFile ?? "prompt.txt";
      const prompt = await fs.readFile(path.join(root, promptFile), "utf8");

      expect(prompt.trim().length).toBeGreaterThan(20);
      expect(metadata.engine).toBeDefined();
      expect(metadata.inputType).toBeDefined();
      inputTypes.add(metadata.inputType as ExampleInputType);

      const decision = selectEngine(
        createVideoSpecFromPrompt({
          prompt,
          assetSources: metadata.assetSources
        })
      );

      expect(decision.engine).toBe(metadata.engine);
      expect(decision.engineFits).toHaveLength(3);
      expect(
        decision.engineFits.reduce((sum, fit) => sum + fit.fitPercent, 0)
      ).toBe(100);
      expect(decision.selectionGuide).toContain("Recommended engine:");
      for (const fit of decision.engineFits) {
        expect(fit.bestUse.length).toBeGreaterThan(40);
        expect(fit.featureHighlights.length).toBeGreaterThan(0);
      }

      expect(metadata.requiredDecisionFields).toEqual(
        expect.arrayContaining([
          "engineFits",
          "selectionGuide",
          "bestUse",
          "featureHighlights"
        ])
      );
    }

    expect([...inputTypes].sort()).toEqual([
      "assets",
      "natural-language",
      "structured",
      "url"
    ]);
  });
});
