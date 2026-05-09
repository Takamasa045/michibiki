import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createVideoSpecFromPrompt } from "@michibiki/video-spec";
import {
  canHyperFramesHandle,
  createHyperFramesEngine,
  type HyperFramesEngineOptions
} from "./hyperframes-engine.js";

describe("HyperFrames engine", () => {
  it("handles URL and web-style specs", () => {
    const spec = createVideoSpecFromPrompt({
      prompt: "LPをDOMアニメーションで動画化したい https://example.com"
    });

    expect(canHyperFramesHandle(spec)).toBe(true);
  });

  it("generates a browser-previewable project", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperframes-"));
    const spec = createVideoSpecFromPrompt({
      prompt: "SaaSのLPを15秒のWeb動画にしたい https://example.com"
    });
    const engine = createHyperFramesEngine();

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    expect(project.engine).toBe("hyperframes");
    await expect(
      fs.readFile(path.join(project.rootPath, "index.html"), "utf8")
    ).resolves.toContain('data-composition-id="root"');
    await expect(
      fs.readFile(path.join(project.rootPath, "motion.js"), "utf8")
    ).resolves.toContain("window.__hf");
    await expect(
      fs.readFile(path.join(project.rootPath, "motion.js"), "utf8")
    ).resolves.toContain("window.__timelines");
    expect(existsSync(path.join(tempDir, "project", "project.json"))).toBe(true);
  });

  it("installs official HTML-in-Canvas registry blocks as references", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "hyperframes-html-canvas-")
    );
    const spec = createVideoSpecFromPrompt({
      prompt:
        "HyperFramesでHTML-in-CanvasのLiquid Glass風VFXを使ったWeb動画にしたい"
    });
    const commandRunner: NonNullable<HyperFramesEngineOptions["commandRunner"]> =
      vi.fn(async (_command, args) => ({
        code: 0,
        command: `node ${args.join(" ")}`,
        stdout: JSON.stringify({
          ok: true,
          tag: "html-in-canvas",
          installed: ["vfx-liquid-glass"]
        }),
        stderr: ""
      }));
    const engine = createHyperFramesEngine({
      cliPath: "/tmp/hyperframes-cli.js",
      commandRunner
    });

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    const html = await fs.readFile(
      path.join(project.rootPath, "index.html"),
      "utf8"
    );
    expect(html).toContain('data-has-html-in-canvas="false"');
    expect(html).not.toContain("data-composition-src=");
    await expect(
      fs.readFile(path.join(project.rootPath, "README.md"), "utf8")
    ).resolves.toContain(
      "installed the official HyperFrames registry bundle as a reference"
    );
    expect(commandRunner).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        "/tmp/hyperframes-cli.js",
        "add",
        "html-in-canvas",
        "--dir",
        project.rootPath,
        "--no-clipboard",
        "--json"
      ]),
      expect.objectContaining({ cwd: project.rootPath })
    );
    expect(project.metadata).toMatchObject({
      htmlInCanvasBlock: "vfx-liquid-glass",
      registryInstalls: [
        expect.objectContaining({
          name: "html-in-canvas",
          installed: ["vfx-liquid-glass"]
        })
      ]
    });
  });

  it("renders through the official HyperFrames CLI backend", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hyperframes-cli-"));
    const spec = createVideoSpecFromPrompt({
      prompt: "LPを1秒のWeb動画にしたい https://example.com",
      durationSec: 1
    });
    const commandRunner: NonNullable<HyperFramesEngineOptions["commandRunner"]> =
      vi.fn(async (_command, args) => {
        const outputPath = args[args.indexOf("--output") + 1];
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, "mp4");
        return {
          code: 0,
          command: `node ${args.join(" ")}`,
          stdout: "rendered",
          stderr: ""
        };
      });
    const engine = createHyperFramesEngine({
      renderBackend: "official-cli",
      cliPath: "/tmp/hyperframes-cli.js",
      commandRunner
    });

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });
    const result = await engine.render(project, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("official CLI");
    expect(commandRunner).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([
        "/tmp/hyperframes-cli.js",
        "render",
        "--quality",
        "standard",
        "--format",
        "mp4"
      ]),
      expect.objectContaining({ cwd: project.rootPath })
    );
  });

  it("renders through the official producer package backend", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "hyperframes-producer-")
    );
    const spec = createVideoSpecFromPrompt({
      prompt: "LPを1秒のWeb動画にしたい https://example.com",
      durationSec: 1
    });
    const executeRenderJob = vi.fn(
      async (_job: unknown, _projectDir: string, outputPath: string) => {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, "mp4");
      }
    );
    const engine = createHyperFramesEngine({
      renderBackend: "official-producer",
      moduleLoader: async () => ({
        createRenderJob: vi.fn((config) => ({ config })),
        executeRenderJob,
        resolveConfig: vi.fn((config) => config)
      })
    });

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });
    const result = await engine.render(project, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("official producer");
    expect(executeRenderJob).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          entryFile: "index.html",
          quality: "standard",
          format: "mp4"
        })
      }),
      project.rootPath,
      path.join(tempDir, "render", "output.mp4"),
      expect.any(Function)
    );
  });

  it("renders through the official engine package backend", async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "hyperframes-engine-")
    );
    const spec = createVideoSpecFromPrompt({
      prompt: "LPを1秒のWeb動画にしたい https://example.com",
      durationSec: 1
    });
    const captureFrame = vi.fn(async () => undefined);
    const encodeFramesFromDir = vi.fn(
      async (
        _framesDir: string,
        _framePattern: string,
        outputPath: string
      ) => {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, "mp4");
        return { success: true };
      }
    );
    const close = vi.fn();
    const closeCaptureSession = vi.fn(async () => undefined);
    const engine = createHyperFramesEngine({
      renderBackend: "official-engine",
      moduleLoader: async () => ({
        createFileServer: vi.fn(async () => ({
          url: "http://localhost:3000",
          close
        })),
        createCaptureSession: vi.fn(async () => ({ session: true })),
        initializeSession: vi.fn(async () => undefined),
        captureFrame,
        closeCaptureSession,
        encodeFramesFromDir,
        getEncoderPreset: vi.fn(() => ({
          codec: "h264",
          preset: "medium",
          quality: 18,
          pixelFormat: "yuv420p"
        })),
        resolveConfig: vi.fn((config) => config)
      })
    });

    const project = await engine.generateProject(spec, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });
    const result = await engine.render(project, {
      outputDir: tempDir,
      logDir: path.join(tempDir, "logs")
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("official engine");
    expect(captureFrame).toHaveBeenCalled();
    expect(encodeFramesFromDir).toHaveBeenCalledWith(
      path.join(tempDir, "render", "frames"),
      "frame_%06d.jpg",
      path.join(tempDir, "render", "output.mp4"),
      expect.objectContaining({ codec: "h264", fps: 30 }),
      undefined,
      expect.anything()
    );
    expect(closeCaptureSession).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
