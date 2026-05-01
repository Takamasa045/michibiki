import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EngineName } from "@video-router/video-spec";

const examples = [
  { slug: "event-promo", engine: "remotion" },
  { slug: "lp-trailer", engine: "hyperframes" },
  { slug: "asset-short", engine: "editframe" },
  { slug: "data-video", engine: "remotion" }
] satisfies Array<{ slug: string; engine: EngineName }>;

describe("MVP examples", () => {
  it("keeps each example prompt and expected engine metadata available", async () => {
    for (const example of examples) {
      const root = path.resolve("examples", example.slug);
      const prompt = await fs.readFile(path.join(root, "prompt.txt"), "utf8");
      const metadata = JSON.parse(
        await fs.readFile(path.join(root, "expected-engine.json"), "utf8")
      ) as { engine?: string };

      expect(prompt.trim().length).toBeGreaterThan(20);
      expect(metadata.engine).toBe(example.engine);
    }
  });
});
