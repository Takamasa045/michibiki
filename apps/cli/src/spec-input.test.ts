import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadVideoSpecFromFile } from "./spec-input.js";
import type { VideoSpec } from "@michibiki/video-spec";

describe("spec input", () => {
  it("loads a VideoSpec and resolves relative asset sources from the spec file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "michibiki-spec-"));
    const specDir = path.join(tempDir, "handoff");
    const specPath = path.join(specDir, "video-spec.json");
    await fs.mkdir(specDir, { recursive: true });

    const spec: VideoSpec = {
      id: "pixverse-handoff",
      title: "PixVerse Handoff",
      goal: "Continue PixVerse output in Michibiki.",
      format: {
        aspectRatio: "16:9",
        width: 1920,
        height: 1080,
        fps: 30,
        durationSec: 10
      },
      style: {
        mood: "polished",
        visualTone: "photoreal",
        motionStyle: "edited footage"
      },
      content: {
        scenes: [
          {
            id: "intro",
            order: 1,
            durationSec: 10,
            description: "A finished PixVerse clip."
          }
        ]
      },
      assets: [
        {
          id: "pixverse-final-video",
          type: "video",
          source: "../final/character.mp4",
          usage: "broll"
        },
        {
          id: "remote-reference",
          type: "url",
          source: "https://example.com/reference"
        }
      ],
      output: {
        type: "mp4",
        needsDownload: false
      },
      constraints: {
        enginePreference: "editframe",
        licenseMode: "personal",
        allowCloudRender: false
      }
    };

    await fs.writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

    const loaded = await loadVideoSpecFromFile(specPath);

    expect(loaded.assets[0].source).toBe(path.resolve(specDir, "../final/character.mp4"));
    expect(loaded.assets[1].source).toBe("https://example.com/reference");
    expect(loaded.constraints.enginePreference).toBe("editframe");
  });
});
