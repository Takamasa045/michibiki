import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createVideoSpecFromPrompt } from "@michibiki/video-spec";
import {
  canRemotionHandle,
  createRemotionEngine,
  selectRemotionTemplate
} from "./remotion-engine.js";

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

  it("generates a standalone Remotion project when standalone mode is selected", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-standalone-"));
    const jobDir = path.join(tempDir, "job");
    const spec = createVideoSpecFromPrompt({
      prompt: "縦型イベント告知動画を作りたい",
      durationSec: 3
    });
    const engine = createRemotionEngine({
      cwd: tempDir,
      remotionMode: "standalone"
    });

    const project = await engine.generateProject(spec, {
      outputDir: jobDir,
      logDir: path.join(jobDir, "logs")
    });

    expect(project.metadata).toMatchObject({
      remotionMode: "standalone",
      template: "official-minimal"
    });
    expect(project.rootPath).toBe(path.join(jobDir, "project", "remotion"));
    await expect(
      fs.readFile(path.join(project.rootPath, "package.json"), "utf8")
    ).resolves.toContain("@remotion/cli");
    await expect(
      fs.readFile(path.join(project.rootPath, "src", "Root.tsx"), "utf8")
    ).resolves.toContain("Composition");

    const preview = await engine.preview(project);
    expect(preview.command).toContain("remotion studio");
  });

  it("keeps using the external monorepo when it exists", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-monorepo-"));
    const repoDir = path.join(tempDir, "engines", "remotion-studio-monorepo");
    const jobDir = path.join(tempDir, "job");
    await fs.mkdir(repoDir, { recursive: true });
    await fs.writeFile(path.join(repoDir, "package.json"), "{}\n", "utf8");
    const spec = createVideoSpecFromPrompt({
      prompt: "縦型イベント告知動画を作りたい"
    });
    const engine = createRemotionEngine({ cwd: tempDir });

    const project = await engine.generateProject(spec, {
      outputDir: jobDir,
      logDir: path.join(jobDir, "logs"),
      dryRun: true
    });

    expect(project.metadata).toMatchObject({
      remotionMode: "monorepo",
      remotionRepoPath: repoDir
    });
    expect(project.rootPath).toContain(path.join(repoDir, "apps"));
  });

  it("fails clearly when monorepo mode is forced without a monorepo", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-forced-"));
    const spec = createVideoSpecFromPrompt({
      prompt: "Remotionでイベント告知動画を作りたい"
    });
    const engine = createRemotionEngine({
      cwd: tempDir,
      remotionRepoPath: path.join(tempDir, "missing-remotion-monorepo"),
      remotionMode: "monorepo"
    });

    await expect(
      engine.generateProject(spec, {
        outputDir: path.join(tempDir, "job")
      })
    ).rejects.toThrow("Remotion monorepo not found");
  });
});
