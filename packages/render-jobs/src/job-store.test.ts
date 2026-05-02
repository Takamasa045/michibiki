import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { EngineDecision, VideoSpec } from "@michibiki/video-spec";
import {
  createJobPaths,
  readJobManifest,
  resolveJobDir,
  writeJobFiles,
  writePreviewResult
} from "./job-store.js";

describe("render job store", () => {
  it("writes and reads preview results with the job manifest", async () => {
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "michibiki-job-"));
    const paths = await createJobPaths(outputRoot);
    const spec: VideoSpec = {
      id: "spec_1",
      title: "Preview test",
      goal: "Create a preview",
      format: {
        aspectRatio: "16:9",
        width: 1920,
        height: 1080,
        fps: 30,
        durationSec: 1
      },
      style: {
        mood: "clean",
        visualTone: "product",
        motionStyle: "simple"
      },
      content: {},
      assets: [],
      output: {
        type: "preview",
        needsDownload: false
      },
      constraints: {
        enginePreference: "hyperframes",
        licenseMode: "personal",
        allowCloudRender: false
      }
    };
    const decision: EngineDecision = {
      engine: "hyperframes",
      confidence: 1,
      reason: "test",
      recommendation: {
        summary: "Use HyperFrames for browser-native motion.",
        strengths: ["DOM motion"],
        tradeoffs: ["not a footage timeline"],
        creativeDirection: "Animate the page as a short browser-native preview."
      },
      engineFits: [
        {
          engine: "hyperframes",
          fitPercent: 60,
          reason: "Browser-native motion fits the request.",
          bestUse: "Animate DOM sections as panels.",
          featureHighlights: ["HTML/CSS/JS composition", "seek-driven rendering"],
          recommendation: {
            summary: "Use HyperFrames for browser-native motion.",
            strengths: ["DOM motion"],
            tradeoffs: ["not a footage timeline"],
            creativeDirection: "Animate the page as a short browser-native preview."
          }
        },
        {
          engine: "remotion",
          fitPercent: 30,
          reason: "Could work as a coded template.",
          bestUse: "Build a reusable template.",
          featureHighlights: ["React composition", "frame-accurate animation"],
          recommendation: {
            summary: "Use Remotion for templates.",
            strengths: ["template motion"],
            tradeoffs: ["requires setup"],
            creativeDirection: "Build a prop-driven template."
          }
        },
        {
          engine: "editframe",
          fitPercent: 10,
          reason: "Less useful without source media.",
          bestUse: "Use for footage timelines.",
          featureHighlights: ["timegroup sequencing", "captions and audio"],
          recommendation: {
            summary: "Use Editframe for timeline edits.",
            strengths: ["timeline editing"],
            tradeoffs: ["less useful for DOM motion"],
            creativeDirection: "Cut clips and captions."
          }
        }
      ],
      selectionGuide:
        "Recommended engine: hyperframes (60%). Use HyperFrames for browser-native motion.",
      licenseRisk: "low"
    };

    await writeJobFiles({
      paths,
      spec,
      decision,
      license: { ok: true, level: "low", message: "ok" }
    });
    const previewPath = await writePreviewResult(paths.jobDir, {
      ok: true,
      projectId: "project_1",
      url: "/tmp/index.html",
      message: "Open preview"
    });

    const manifest = await readJobManifest(paths.jobDir);

    expect(previewPath).toBe(path.join(paths.jobDir, "preview", "preview-result.json"));
    expect(manifest.preview?.url).toBe("/tmp/index.html");
    expect(manifest.decision.engine).toBe("hyperframes");
  });

  it("resolves absolute paths, outputs paths, and bare job ids", () => {
    expect(resolveJobDir("/tmp/job")).toBe("/tmp/job");
    expect(resolveJobDir("outputs/jobs/job_1", "/repo")).toBe(
      path.resolve("/repo", "outputs/jobs/job_1")
    );
    expect(resolveJobDir("job_1", "/repo")).toBe(
      path.resolve("/repo", "outputs", "jobs", "job_1")
    );
  });
});
