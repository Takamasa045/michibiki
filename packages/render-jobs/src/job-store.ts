import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  EngineDecision,
  PreviewResult,
  VideoSpec
} from "@michibiki/video-spec";

export type JobPaths = {
  jobId: string;
  jobDir: string;
  logDir: string;
};

export type JobManifest = {
  spec: VideoSpec;
  decision: EngineDecision;
  project?: unknown;
  preview?: PreviewResult;
};

export async function createJobPaths(outputsRoot: string): Promise<JobPaths> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "_");
  const jobId = `job_${timestamp}_${randomUUID().slice(0, 6)}`;
  const jobDir = path.resolve(outputsRoot, "jobs", jobId);
  const logDir = path.join(jobDir, "logs");

  await fs.mkdir(logDir, { recursive: true });
  await fs.mkdir(path.join(jobDir, "preview"), { recursive: true });
  await fs.mkdir(path.join(jobDir, "render"), { recursive: true });
  await fs.mkdir(path.join(jobDir, "project"), { recursive: true });

  return { jobId, jobDir, logDir };
}

export async function writeJobFiles(params: {
  paths: JobPaths;
  spec: VideoSpec;
  decision: EngineDecision;
  license: unknown;
}): Promise<void> {
  await writeJson(path.join(params.paths.jobDir, "video-spec.json"), params.spec);
  await writeJson(
    path.join(params.paths.jobDir, "engine-decision.json"),
    params.decision
  );
  await writeJson(path.join(params.paths.jobDir, "license-result.json"), params.license);
}

export async function readJobManifest(jobDir: string): Promise<JobManifest> {
  const spec = JSON.parse(
    await fs.readFile(path.join(jobDir, "video-spec.json"), "utf8")
  ) as VideoSpec;
  const decision = JSON.parse(
    await fs.readFile(path.join(jobDir, "engine-decision.json"), "utf8")
  ) as EngineDecision;
  const projectPath = path.join(jobDir, "project", "project.json");
  const project = existsSync(projectPath)
    ? JSON.parse(await fs.readFile(projectPath, "utf8"))
    : undefined;
  const previewPath = path.join(jobDir, "preview", "preview-result.json");
  const preview = existsSync(previewPath)
    ? (JSON.parse(await fs.readFile(previewPath, "utf8")) as PreviewResult)
    : undefined;

  return { spec, decision, project, preview };
}

export async function writePreviewResult(
  jobDir: string,
  preview: PreviewResult
): Promise<string> {
  const previewPath = path.join(jobDir, "preview", "preview-result.json");
  await fs.mkdir(path.dirname(previewPath), { recursive: true });
  await writeJson(previewPath, preview);
  return previewPath;
}

export function resolveJobDir(job: string, cwd = process.cwd()): string {
  if (path.isAbsolute(job)) {
    return job;
  }
  if (job.startsWith("outputs/")) {
    return path.resolve(cwd, job);
  }
  return path.resolve(cwd, "outputs", "jobs", job);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
