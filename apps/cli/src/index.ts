#!/usr/bin/env node
import path from "node:path";
import { validateLicense } from "@michibiki/compliance";
import { createEditframeEngine } from "@michibiki/engine-editframe";
import { createHyperFramesEngine } from "@michibiki/engine-hyperframes";
import { createRemotionEngine } from "@michibiki/engine-remotion";
import {
  createJobPaths,
  readJobManifest,
  resolveJobDir,
  writeJobFiles,
  writePreviewResult
} from "@michibiki/render-jobs";
import { selectEngine } from "@michibiki/router";
import {
  createVideoSpecFromPrompt,
  type AspectRatio,
  type EngineName,
  type EnginePreference,
  type EngineRecommendation,
  type GeneratedProject,
  type LicenseMode,
  type OutputType,
  type PreviewResult,
  type VideoEngine
} from "@michibiki/video-spec";
import { parseArgs, getValue, getValues, hasFlag } from "./args.js";
import { printDoctor, runDoctor } from "./doctor.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command || args.command === "help" || hasFlag(args, "help")) {
    printHelp();
    return;
  }

  if (args.command === "generate" || args.command === "create") {
    await generate(args);
    return;
  }

  if (args.command === "preview") {
    await preview(args);
    return;
  }

  if (args.command === "render") {
    await render(args);
    return;
  }

  if (args.command === "inspect") {
    await inspect(args);
    return;
  }

  if (args.command === "engines") {
    printEngines();
    return;
  }

  if (args.command === "doctor") {
    printDoctor(runDoctor());
    return;
  }

  console.error(`Unknown command: ${args.command}`);
  printHelp();
  process.exit(1);
}

async function generate(args: ReturnType<typeof parseArgs>): Promise<void> {
  const prompt = getValue(args, "prompt") ?? args.positionals.join(" ");
  if (!prompt) {
    throw new Error("Missing prompt. Use --prompt \"...\".");
  }

  const outputsRoot = path.resolve(getValue(args, "outputs") ?? "outputs");
  const paths = await createJobPaths(outputsRoot);
  const enginePreference = parseEnginePreference(getValue(args, "engine"));
  const licenseMode = parseLicenseMode(getValue(args, "license-mode"));
  const spec = createVideoSpecFromPrompt({
    prompt,
    title: getValue(args, "title"),
    durationSec: parseNumber(getValue(args, "duration")),
    aspectRatio: parseAspectRatio(getValue(args, "aspect-ratio")),
    outputType: parseOutputType(getValue(args, "output-type")),
    assetSources: getValues(args, "asset"),
    referenceUrls: getValues(args, "url"),
    enginePreference,
    licenseMode,
    allowCloudRender: hasFlag(args, "allow-cloud-render")
  });
  const decision = selectEngine(spec);
  const license = validateLicense(decision.engine, {
    usage: spec.constraints.licenseMode ?? "personal",
    allowCloudRender: spec.constraints.allowCloudRender
  });

  await writeJobFiles({ paths, spec, decision, license });

  let project: GeneratedProject | undefined;
  let previewResult: PreviewResult | undefined;
  let previewResultPath: string | undefined;
  let renderMessage: string | undefined;
  let renderOutputPath: string | undefined;
  if (!license.ok && !hasFlag(args, "allow-license-risk")) {
    console.log(`License guard blocked execution: ${license.message}`);
  } else {
    const engine = createEngine(decision.engine, {
      remotionRepoPath: getValue(args, "remotion-repo")
    });
    project = await engine.generateProject(spec, {
      jobId: paths.jobId,
      outputDir: paths.jobDir,
      logDir: paths.logDir,
      dryRun: hasFlag(args, "dry-run")
    });

    previewResult = await engine.preview(project);
    previewResultPath = await writePreviewResult(paths.jobDir, previewResult);

    if (hasFlag(args, "render")) {
      const renderResult = await engine.render(project, {
        outputDir: paths.jobDir,
        logDir: paths.logDir,
        skipBuildPackages: hasFlag(args, "skip-build-packages")
      });
      renderMessage = renderResult.message;
      renderOutputPath = renderResult.outputPath;
      if (!renderResult.ok) {
        process.exitCode = 1;
      }
    }
  }

  printGenerateSummary({
    jobDir: paths.jobDir,
    engine: decision.engine,
    reason: decision.reason,
    recommendation: decision.recommendation,
    fallback: decision.fallback,
    licenseMessage: license.message,
    projectPath: project?.rootPath,
    previewTarget: previewResult
      ? formatPreviewTarget(previewResult, previewResultPath)
      : undefined,
    renderMessage,
    renderOutputPath
  });
}

async function render(args: ReturnType<typeof parseArgs>): Promise<void> {
  const job = getValue(args, "job") ?? args.positionals[0];
  if (!job) {
    throw new Error("Missing job. Use michibiki render --job outputs/jobs/<job-id>.");
  }

  const { jobDir, manifest, project } = await loadGeneratedProject(job);
  const engine = createEngine(manifest.decision.engine, {
    remotionRepoPath: getValue(args, "remotion-repo")
  });
  const result = await engine.render(project, {
    outputDir: jobDir,
    logDir: path.join(jobDir, "logs"),
    skipBuildPackages: hasFlag(args, "skip-build-packages")
  });

  console.log(result.message);
  if (result.outputPath) {
    console.log(`Output: ${result.outputPath}`);
  }
  if (!result.ok) {
    process.exit(1);
  }
}

async function preview(args: ReturnType<typeof parseArgs>): Promise<void> {
  const job = getValue(args, "job") ?? args.positionals[0];
  if (!job) {
    throw new Error("Missing job. Use michibiki preview --job outputs/jobs/<job-id>.");
  }

  const { jobDir, manifest, project } = await loadGeneratedProject(job);
  const engine = createEngine(manifest.decision.engine, {
    remotionRepoPath: getValue(args, "remotion-repo")
  });
  const result = await engine.preview(project);
  const previewPath = await writePreviewResult(jobDir, result);

  console.log(result.message);
  if (result.url) {
    console.log(`URL: ${result.url}`);
  }
  if (result.command) {
    console.log(`Command: ${result.command}`);
  }
  console.log(`Preview result: ${previewPath}`);
  if (!result.ok) {
    process.exit(1);
  }
}

async function inspect(args: ReturnType<typeof parseArgs>): Promise<void> {
  const job = getValue(args, "job") ?? args.positionals[0];
  if (!job) {
    throw new Error("Missing job. Use michibiki inspect --job outputs/jobs/<job-id>.");
  }

  const jobDir = resolveJobDir(job);
  const manifest = await readJobManifest(jobDir);
  console.log(JSON.stringify(manifest, null, 2));
}

function printHelp(): void {
  console.log(`Michibiki

Usage:
  michibiki create --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型..."
  michibiki generate --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型..."
  michibiki generate --prompt "..." --render
  michibiki preview --job outputs/jobs/<job-id>
  michibiki render --job outputs/jobs/<job-id>
  michibiki inspect --job outputs/jobs/<job-id>
  michibiki engines
  michibiki doctor

Generate options:
  --prompt <text>             Natural language video request
  --title <text>              Optional title
  --duration <seconds>        Override duration
  --aspect-ratio <value>      9:16, 16:9, 1:1, or 4:5
  --asset <path>              Repeatable asset path
  --url <url>                 Repeatable reference URL
  --engine <name>             auto, remotion, hyperframes, editframe
  --license-mode <mode>       personal, oss, commercial, client-work
  --output-type <type>        mp4, webm, project, code, preview
  --remotion-repo <path>      Override Remotion monorepo path
  --render                    Render after project generation
  --dry-run                   Remotion only: write job files without running engine commands
`);
}

function printEngines(): void {
  console.log(`Available engines:
  remotion     Best for coded templates, React/TypeScript motion graphics, data-driven variants, and repeatable renders.
               Watch for external Remotion repo setup and commercial/team license requirements.
  hyperframes  Best for Web, DOM, CSS, JavaScript, URL, and LP-style browser-native motion.
               Watch for footage-heavy edits and official SDK gaps in the current draft adapter.
  editframe    Best for source footage, audio, captions, B-roll, and timeline handoff workflows.
               Watch for current timeline-preview limits and Editframe plan/terms requirements.
`);
}

function printGenerateSummary(params: {
  jobDir: string;
  engine: EngineName;
  reason: string;
  recommendation: EngineRecommendation;
  fallback?: EngineName;
  licenseMessage: string;
  projectPath?: string;
  previewTarget?: string;
  renderMessage?: string;
  renderOutputPath?: string;
}): void {
  console.log("");
  console.log("Generate complete");
  console.log(`Job: ${params.jobDir}`);
  console.log(`Engine: ${params.engine}`);
  console.log(`Reason: ${params.reason}`);
  console.log(`Proposal: ${params.recommendation.summary}`);
  console.log(`Direction: ${params.recommendation.creativeDirection}`);
  console.log(`Strengths: ${params.recommendation.strengths.join("; ")}`);
  console.log(`Tradeoffs: ${params.recommendation.tradeoffs.join("; ")}`);
  if (params.fallback) {
    console.log(`Fallback: ${params.fallback}`);
  }
  console.log(`License: ${params.licenseMessage}`);
  if (params.projectPath) {
    console.log(`Project: ${params.projectPath}`);
  }
  if (params.previewTarget) {
    console.log(`Preview: ${params.previewTarget}`);
  }
  if (params.renderMessage) {
    console.log(`Render: ${params.renderMessage}`);
  }
  if (params.renderOutputPath) {
    console.log(`Output: ${params.renderOutputPath}`);
  }
}

async function loadGeneratedProject(job: string): Promise<{
  jobDir: string;
  manifest: Awaited<ReturnType<typeof readJobManifest>>;
  project: GeneratedProject;
}> {
  const jobDir = resolveJobDir(job);
  const manifest = await readJobManifest(jobDir);
  if (!manifest.project || typeof manifest.project !== "object") {
    throw new Error("Missing project/project.json. Run generate first.");
  }

  const projectRecord = manifest.project as Record<string, unknown>;
  const rootPath = readString(projectRecord.projectPath);
  if (!rootPath) {
    throw new Error("project/project.json is missing projectPath.");
  }

  return {
    jobDir,
    manifest,
    project: {
      id: readString(projectRecord.id) ?? "project_unknown",
      engine: manifest.decision.engine,
      name: readProjectName(projectRecord),
      rootPath,
      files: [],
      metadata: projectRecord
    }
  };
}

function formatPreviewTarget(
  preview: PreviewResult,
  previewResultPath: string | undefined
): string {
  return preview.url ?? preview.command ?? previewResultPath ?? preview.message;
}

function createEngine(
  engine: EngineName,
  options: { remotionRepoPath?: string } = {}
): VideoEngine {
  if (engine === "remotion") {
    return createRemotionEngine({
      remotionRepoPath: options.remotionRepoPath
    });
  }
  if (engine === "hyperframes") {
    return createHyperFramesEngine();
  }
  return createEditframeEngine();
}

function readProjectName(projectRecord: Record<string, unknown>): string {
  if (typeof projectRecord.appName === "string") return projectRecord.appName;
  if (typeof projectRecord.projectName === "string") return projectRecord.projectName;
  return "unknown";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAspectRatio(value: string | undefined): AspectRatio | undefined {
  if (value === "9:16" || value === "16:9" || value === "1:1" || value === "4:5") {
    return value;
  }
  return undefined;
}

function parseEnginePreference(
  value: string | undefined
): EnginePreference | undefined {
  if (
    value === "auto" ||
    value === "remotion" ||
    value === "hyperframes" ||
    value === "editframe"
  ) {
    return value;
  }
  return undefined;
}

function parseLicenseMode(value: string | undefined): LicenseMode | undefined {
  if (
    value === "personal" ||
    value === "oss" ||
    value === "commercial" ||
    value === "client-work"
  ) {
    return value;
  }
  return undefined;
}

function parseOutputType(value: string | undefined): OutputType | undefined {
  if (
    value === "mp4" ||
    value === "webm" ||
    value === "project" ||
    value === "code" ||
    value === "preview"
  ) {
    return value;
  }
  return undefined;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
