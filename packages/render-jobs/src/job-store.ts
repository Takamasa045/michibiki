import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  EngineDecision,
  EngineName,
  PreviewResult,
  VideoSpec
} from "@michibiki/video-spec";
import { slugify } from "./slug.js";

export type JobPaths = {
  jobId: string;
  jobDir: string;
  logDir: string;
};

export type CreateJobPathsOptions = {
  /** Human-readable name for the deliverable folder under outputs/projects/. */
  slug?: string;
};

export type JobManifest = {
  spec: VideoSpec;
  decision: EngineDecision;
  project?: unknown;
  preview?: PreviewResult;
};

export async function createJobPaths(
  outputsRoot: string,
  options: CreateJobPathsOptions = {}
): Promise<JobPaths> {
  const projectsRoot = path.resolve(outputsRoot, "projects");
  const baseSlug = slugify(options.slug ?? "");
  const jobId = await reserveUniqueSlug(projectsRoot, baseSlug);
  const jobDir = path.join(projectsRoot, jobId);
  const logDir = path.join(jobDir, "logs");

  await fs.mkdir(logDir, { recursive: true });
  await fs.mkdir(path.join(jobDir, "preview"), { recursive: true });
  await fs.mkdir(path.join(jobDir, "render"), { recursive: true });
  await fs.mkdir(path.join(jobDir, "project"), { recursive: true });

  return { jobId, jobDir, logDir };
}

/**
 * Pick a unique folder name under projectsRoot. Uses the clean slug when it is
 * free, otherwise appends -2, -3, ... so a second deliverable with the same
 * title never overwrites the first.
 */
async function reserveUniqueSlug(
  projectsRoot: string,
  baseSlug: string
): Promise<string> {
  if (!existsSync(path.join(projectsRoot, baseSlug))) {
    return baseSlug;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${baseSlug}-${suffix}`;
    if (!existsSync(path.join(projectsRoot, candidate))) {
      return candidate;
    }
  }
  throw new Error(
    `Unable to reserve a unique output folder for "${baseSlug}" under ${projectsRoot}.`
  );
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
  // An explicit outputs/... path (e.g. legacy outputs/jobs/<id> or the current
  // outputs/projects/<slug>) is honored as-is.
  if (job.startsWith("outputs/")) {
    return path.resolve(cwd, job);
  }
  // A bare name resolves to the current deliverable location.
  return path.resolve(cwd, "outputs", "projects", job);
}

export async function validateGeneratedProjectPath(params: {
  jobDir: string;
  engine: EngineName;
  projectPath: string;
  remotionMode?: string;
  remotionRepoPath?: string;
  expectedRemotionRepoPath?: string;
}): Promise<string> {
  const projectPath = await realpathOrResolve(params.projectPath);
  if (params.engine === "remotion" && params.remotionMode === "monorepo") {
    const remotionRepoPath = params.remotionRepoPath
      ? await realpathOrResolve(params.remotionRepoPath)
      : undefined;
    const expectedRemotionRepoPath = params.expectedRemotionRepoPath
      ? await realpathOrResolve(params.expectedRemotionRepoPath)
      : undefined;

    if (!remotionRepoPath) {
      throw new Error("Remotion monorepo project manifest is missing remotionRepoPath.");
    }
    if (expectedRemotionRepoPath && remotionRepoPath !== expectedRemotionRepoPath) {
      throw new Error(
        `Remotion monorepo path ${remotionRepoPath} does not match the resolved Remotion repo ${expectedRemotionRepoPath}.`
      );
    }

    const appsDir = await realpathOrResolve(path.join(remotionRepoPath, "apps"));
    if (!isPathInside(projectPath, appsDir)) {
      throw new Error(
        `Generated Remotion project path ${projectPath} is outside the Remotion apps directory ${appsDir}.`
      );
    }

    return projectPath;
  }

  const jobProjectDir = await realpathOrResolve(
    path.join(await realpathOrResolve(params.jobDir), "project")
  );
  if (!isPathInside(projectPath, jobProjectDir)) {
    throw new Error(
      `Generated project path ${projectPath} is outside the generated job project directory ${jobProjectDir}.`
    );
  }

  return projectPath;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function realpathOrResolve(filePath: string): Promise<string> {
  try {
    return await fs.realpath(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
