#!/usr/bin/env node
import path from "node:path";
import { validateLicense } from "@michibiki/compliance";
import { createEditframeEngine } from "@michibiki/engine-editframe";
import {
  createHyperFramesEngine,
  type HyperFramesRenderBackend,
  type HyperFramesRenderFormat,
  type HyperFramesRenderQuality
} from "@michibiki/engine-hyperframes";
import {
  createRemotionEngine,
  resolveRemotionRepoPath,
  type RemotionProjectMode
} from "@michibiki/engine-remotion";
import {
  createJobPaths,
  readJobManifest,
  resolveJobDir,
  validateGeneratedProjectPath,
  writeJobFiles,
  writePreviewResult
} from "@michibiki/render-jobs";
import { selectEngine } from "@michibiki/router";
import {
  createVideoSpecFromPrompt,
  type AspectRatio,
  type EngineFit,
  type EngineName,
  type EnginePreference,
  type EngineRecommendation,
  type GeneratedProject,
  type LicenseMode,
  type OutputType,
  type PreviewResult,
  type SwitchHint,
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

  if (args.command === "decide" || args.command === "route") {
    decide(args);
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
  const { spec, decision, license } = buildDecisionFromArgs(args);

  if (
    decision.clarifyingQuestions.length > 0 &&
    !getValue(args, "engine") &&
    !hasFlag(args, "resolve-ambiguity")
  ) {
    printAmbiguityBlock({
      engine: decision.engine,
      engineFits: decision.engineFits,
      switchHints: decision.switchHints,
      clarifyingQuestions: decision.clarifyingQuestions
    });
    process.exitCode = 2;
    return;
  }

  const outputsRoot = path.resolve(getValue(args, "outputs") ?? "outputs");
  const paths = await createJobPaths(outputsRoot);

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
      remotionRepoPath: getValue(args, "remotion-repo"),
      remotionMode: parseRemotionMode(getValue(args, "remotion-mode")),
      hyperframesRenderBackend: parseHyperFramesRenderBackend(
        getValue(args, "hyperframes-renderer")
      ),
      hyperframesRenderQuality: parseHyperFramesRenderQuality(
        getValue(args, "hyperframes-quality")
      ),
      hyperframesRenderFormat: parseHyperFramesRenderFormat(
        getValue(args, "hyperframes-format")
      ),
      hyperframesRenderWorkers: parseNumber(getValue(args, "hyperframes-workers")),
      hyperframesUseDocker: hasFlag(args, "hyperframes-docker"),
      hyperframesUseGpu: hasFlag(args, "hyperframes-gpu")
    });
    project = await engine.generateProject(spec, {
      jobId: paths.jobId,
      outputDir: paths.jobDir,
      logDir: paths.logDir,
      dryRun: hasFlag(args, "dry-run")
    });

    if (hasFlag(args, "preview")) {
      previewResult = await engine.preview(project);
      previewResultPath = await writePreviewResult(paths.jobDir, previewResult);
    }

    if (hasFlag(args, "render")) {
      if (!hasFlag(args, "confirm-render")) {
        console.log("");
        console.log(
          "Render gate: --render was set, but MP4 rendering needs explicit user approval."
        );
        console.log(
          "Re-run the same command with --confirm-render once the user has approved the final render."
        );
        process.exitCode = 2;
      } else {
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
  }

  printGenerateSummary({
    jobDir: paths.jobDir,
    engine: decision.engine,
    reason: decision.reason,
    recommendation: decision.recommendation,
    engineFits: decision.engineFits,
    selectionGuide: decision.selectionGuide,
    switchHints: decision.switchHints,
    clarifyingQuestions: decision.clarifyingQuestions,
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

function decide(args: ReturnType<typeof parseArgs>): void {
  const { spec, decision, license } = buildDecisionFromArgs(args);

  printDecisionSummary({
    title: spec.title,
    durationSec: spec.format.durationSec,
    aspectRatio: spec.format.aspectRatio,
    engine: decision.engine,
    reason: decision.reason,
    recommendation: decision.recommendation,
    engineFits: decision.engineFits,
    selectionGuide: decision.selectionGuide,
    switchHints: decision.switchHints,
    clarifyingQuestions: decision.clarifyingQuestions,
    fallback: decision.fallback,
    licenseMessage: license.message
  });
}

function buildDecisionFromArgs(args: ReturnType<typeof parseArgs>): {
  spec: ReturnType<typeof createVideoSpecFromPrompt>;
  decision: ReturnType<typeof selectEngine>;
  license: ReturnType<typeof validateLicense>;
} {
  const prompt = getValue(args, "prompt") ?? args.positionals.join(" ");
  if (!prompt) {
    throw new Error("Missing prompt. Use --prompt \"...\".");
  }

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

  return { spec, decision, license };
}

async function render(args: ReturnType<typeof parseArgs>): Promise<void> {
  const job = getValue(args, "job") ?? args.positionals[0];
  if (!job) {
    throw new Error("Missing job. Use michibiki render --job outputs/jobs/<job-id>.");
  }

  if (!hasFlag(args, "confirm-render")) {
    console.log(
      "Render gate: MP4 rendering needs explicit user approval before it runs."
    );
    console.log(
      "Re-run the same command with --confirm-render once the user has approved the final render."
    );
    process.exitCode = 2;
    return;
  }

  const { jobDir, manifest, project } = await loadGeneratedProject(job, {
    remotionRepoPath: getValue(args, "remotion-repo")
  });
  const engine = createEngine(manifest.decision.engine, {
    remotionRepoPath: getValue(args, "remotion-repo"),
    remotionMode: parseRemotionMode(getValue(args, "remotion-mode")),
    hyperframesRenderBackend: parseHyperFramesRenderBackend(
      getValue(args, "hyperframes-renderer")
    ),
    hyperframesRenderQuality: parseHyperFramesRenderQuality(
      getValue(args, "hyperframes-quality")
    ),
    hyperframesRenderFormat: parseHyperFramesRenderFormat(
      getValue(args, "hyperframes-format")
    ),
    hyperframesRenderWorkers: parseNumber(getValue(args, "hyperframes-workers")),
    hyperframesUseDocker: hasFlag(args, "hyperframes-docker"),
    hyperframesUseGpu: hasFlag(args, "hyperframes-gpu")
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

  const { jobDir, manifest, project } = await loadGeneratedProject(job, {
    remotionRepoPath: getValue(args, "remotion-repo")
  });
  const engine = createEngine(manifest.decision.engine, {
    remotionRepoPath: getValue(args, "remotion-repo"),
    remotionMode: parseRemotionMode(getValue(args, "remotion-mode")),
    hyperframesRenderBackend: parseHyperFramesRenderBackend(
      getValue(args, "hyperframes-renderer")
    ),
    hyperframesRenderQuality: parseHyperFramesRenderQuality(
      getValue(args, "hyperframes-quality")
    ),
    hyperframesRenderFormat: parseHyperFramesRenderFormat(
      getValue(args, "hyperframes-format")
    ),
    hyperframesRenderWorkers: parseNumber(getValue(args, "hyperframes-workers")),
    hyperframesUseDocker: hasFlag(args, "hyperframes-docker"),
    hyperframesUseGpu: hasFlag(args, "hyperframes-gpu")
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
  michibiki decide --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型..."
  michibiki create --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型..."
  michibiki generate --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型..."
  michibiki generate --prompt "..." --render
  michibiki preview --job outputs/jobs/<job-id>
  michibiki render --job outputs/jobs/<job-id>
  michibiki inspect --job outputs/jobs/<job-id>
  michibiki engines
  michibiki doctor

Decide/generate options:
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
  --remotion-mode <mode>      auto, monorepo, standalone
  --hyperframes-renderer <mode>
                              official-cli, official-producer, official-engine, or local
  --hyperframes-quality <mode>
                              draft, standard, or high
  --hyperframes-format <type> mp4, webm, or mov
  --hyperframes-workers <n>   Official HyperFrames worker count
  --hyperframes-docker        Use official HyperFrames Docker rendering where supported
  --hyperframes-gpu           Use official HyperFrames GPU acceleration where supported
  --preview                   Run preview after project generation (opt-in; HyperFrames/Editframe preview launches headless Chrome + ffmpeg)
  --render                    Render the final MP4 after project generation (still requires --confirm-render to actually run)
  --confirm-render            Required acknowledgement that MP4 rendering is intended; protects against accidental render runs by agents
  --dry-run                   Remotion monorepo only: write job files without running engine commands
  --resolve-ambiguity         Proceed with the auto recommendation even when the router cannot decide between two engines (top vs runner-up margin ≤ 8%)
  --allow-license-risk        Proceed even when license guard flags risk

Recommended sequence (the steps the agent rules expect):
  1. michibiki decide --prompt "..."                          (no side effects)
  2. michibiki generate --prompt "..." [--engine X]           (creates project files only)
  3. michibiki preview --job outputs/jobs/<id>                (run preview to validate)
  4. michibiki render --job outputs/jobs/<id> --confirm-render (final MP4)
`);
}

function printEngines(): void {
  console.log(`Available engines:
  remotion     Best for coded templates, React/TypeScript motion graphics, HTML-in-canvas effects, data-driven variants, and repeatable renders.
               Uses an external monorepo when found; otherwise creates a standalone official Remotion project.
               Watch for experimental HTML-in-canvas browser requirements and commercial/team license requirements.
  hyperframes  Best for Web, DOM, CSS, JavaScript, URL, and LP-style browser-native motion.
               Renders through the official HyperFrames CLI by default; producer, engine, and legacy local renderers are selectable.
  editframe    Best for source footage, audio, captions, B-roll, and timeline handoff workflows.
               Watch for current timeline-preview limits and Editframe plan/terms requirements.
`);
}

function printGenerateSummary(params: {
  jobDir: string;
  engine: EngineName;
  reason: string;
  recommendation: EngineRecommendation;
  engineFits: EngineFit[];
  selectionGuide: string;
  switchHints: SwitchHint[];
  clarifyingQuestions: string[];
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
  console.log(`Selection guide: ${params.selectionGuide}`);
  console.log("Engine fit:");
  for (const fit of params.engineFits) {
    console.log(`- ${fit.engine}: ${fit.fitPercent}%`);
    console.log(`  Why: ${fit.reason}`);
    console.log(`  Best use: ${fit.bestUse}`);
    console.log(`  Features: ${fit.featureHighlights.join("; ")}`);
  }
  console.log(`Selected proposal: ${params.recommendation.summary}`);
  console.log(`Selected direction: ${params.recommendation.creativeDirection}`);
  console.log(`Strengths: ${params.recommendation.strengths.join("; ")}`);
  console.log(`Tradeoffs: ${params.recommendation.tradeoffs.join("; ")}`);
  printSwitchHints(params.switchHints);
  printClarifyingQuestions(params.clarifyingQuestions);
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

function printDecisionSummary(params: {
  title: string;
  durationSec: number;
  aspectRatio: AspectRatio;
  engine: EngineName;
  reason: string;
  recommendation: EngineRecommendation;
  engineFits: EngineFit[];
  selectionGuide: string;
  switchHints: SwitchHint[];
  clarifyingQuestions: string[];
  fallback?: EngineName;
  licenseMessage: string;
}): void {
  console.log("");
  console.log("Decision complete");
  console.log("No job, project, preview, or render files were created.");
  console.log(`Title: ${params.title}`);
  console.log(`Format: ${params.durationSec}s ${params.aspectRatio}`);
  console.log(`Engine: ${params.engine}`);
  console.log(`Reason: ${params.reason}`);
  console.log(`Selection guide: ${params.selectionGuide}`);
  console.log("Engine fit:");
  for (const fit of params.engineFits) {
    console.log(`- ${fit.engine}: ${fit.fitPercent}%`);
    console.log(`  Why: ${fit.reason}`);
    console.log(`  Best use: ${fit.bestUse}`);
    console.log(`  Features: ${fit.featureHighlights.join("; ")}`);
  }
  console.log(`Selected proposal: ${params.recommendation.summary}`);
  console.log(`Selected direction: ${params.recommendation.creativeDirection}`);
  console.log(`Strengths: ${params.recommendation.strengths.join("; ")}`);
  console.log(`Tradeoffs: ${params.recommendation.tradeoffs.join("; ")}`);
  printSwitchHints(params.switchHints);
  printClarifyingQuestions(params.clarifyingQuestions);
  if (params.fallback) {
    console.log(`Fallback: ${params.fallback}`);
  }
  console.log(`License: ${params.licenseMessage}`);
}

function printSwitchHints(hints: SwitchHint[]): void {
  if (!hints.length) return;
  console.log("Switch hints:");
  for (const hint of hints) {
    console.log(`- → ${hint.targetEngine}`);
    console.log(`  When: ${hint.condition}`);
    console.log(`  Why:  ${hint.why}`);
  }
}

function printClarifyingQuestions(questions: string[]): void {
  if (!questions.length) return;
  console.log("Clarifying question:");
  for (const question of questions) {
    console.log(`- ${question}`);
  }
}

function printAmbiguityBlock(params: {
  engine: EngineName;
  engineFits: EngineFit[];
  switchHints: SwitchHint[];
  clarifyingQuestions: string[];
}): void {
  console.log("");
  console.log("Engine selection is ambiguous — refusing to generate.");
  console.log(
    "The auto router cannot decide between two engines with high confidence."
  );
  console.log("");
  console.log("Engine fit:");
  for (const fit of [...params.engineFits].sort(
    (left, right) => right.fitPercent - left.fitPercent
  )) {
    console.log(`- ${fit.engine}: ${fit.fitPercent}%`);
  }
  console.log("");
  printClarifyingQuestions(params.clarifyingQuestions);
  console.log("");
  printSwitchHints(params.switchHints);
  console.log("");
  console.log("To proceed, choose one of:");
  console.log(
    `  1) Re-run with an explicit engine: --engine remotion | hyperframes | editframe`
  );
  console.log(
    `  2) Accept the auto recommendation (${params.engine}) anyway: add --resolve-ambiguity`
  );
  console.log(
    "  3) Use \"michibiki decide\" first to inspect engineFits without generating"
  );
}

async function loadGeneratedProject(
  job: string,
  options: { remotionRepoPath?: string } = {}
): Promise<{
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
  const validatedRootPath = await validateGeneratedProjectPath({
    jobDir,
    engine: manifest.decision.engine,
    projectPath: rootPath,
    remotionMode: readString(projectRecord.remotionMode),
    remotionRepoPath: readString(projectRecord.remotionRepoPath),
    expectedRemotionRepoPath:
      manifest.decision.engine === "remotion"
        ? resolveRemotionRepoPath(options.remotionRepoPath)
        : undefined
  });

  return {
    jobDir,
    manifest,
    project: {
      id: readString(projectRecord.id) ?? "project_unknown",
      engine: manifest.decision.engine,
      name: readProjectName(projectRecord),
      rootPath: validatedRootPath,
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
  options: {
    remotionRepoPath?: string;
    remotionMode?: RemotionProjectMode;
    hyperframesRenderBackend?: HyperFramesRenderBackend;
    hyperframesRenderQuality?: HyperFramesRenderQuality;
    hyperframesRenderFormat?: HyperFramesRenderFormat;
    hyperframesRenderWorkers?: number;
    hyperframesUseDocker?: boolean;
    hyperframesUseGpu?: boolean;
  } = {}
): VideoEngine {
  if (engine === "remotion") {
    return createRemotionEngine({
      remotionRepoPath: options.remotionRepoPath,
      remotionMode: options.remotionMode
    });
  }
  if (engine === "hyperframes") {
    return createHyperFramesEngine({
      renderBackend: options.hyperframesRenderBackend,
      renderQuality: options.hyperframesRenderQuality,
      renderFormat: options.hyperframesRenderFormat,
      renderWorkers: options.hyperframesRenderWorkers,
      useDocker: options.hyperframesUseDocker,
      useGpu: options.hyperframesUseGpu
    });
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

function parseRemotionMode(
  value: string | undefined
): RemotionProjectMode | undefined {
  if (value === "auto" || value === "monorepo" || value === "standalone") {
    return value;
  }
  return undefined;
}

function parseHyperFramesRenderBackend(
  value: string | undefined
): HyperFramesRenderBackend | undefined {
  if (
    value === "official-cli" ||
    value === "official-producer" ||
    value === "official-engine" ||
    value === "local"
  ) {
    return value;
  }
  return undefined;
}

function parseHyperFramesRenderQuality(
  value: string | undefined
): HyperFramesRenderQuality | undefined {
  if (value === "draft" || value === "standard" || value === "high") {
    return value;
  }
  return undefined;
}

function parseHyperFramesRenderFormat(
  value: string | undefined
): HyperFramesRenderFormat | undefined {
  if (value === "mp4" || value === "webm" || value === "mov") {
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
