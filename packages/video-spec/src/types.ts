export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export type EngineName = "remotion" | "hyperframes" | "editframe";

export type EnginePreference = "auto" | EngineName;

export type LicenseMode =
  | "personal"
  | "oss"
  | "commercial"
  | "client-work";

export type OutputType = "mp4" | "webm" | "project" | "code" | "preview";

export type AssetType =
  | "image"
  | "video"
  | "audio"
  | "subtitle"
  | "json"
  | "url";

export type AssetUsage =
  | "background"
  | "broll"
  | "avatar"
  | "music"
  | "voice"
  | "data";

export type SceneSpec = {
  id: string;
  order: number;
  durationSec: number;
  description: string;
  text?: string;
  assets?: string[];
  camera?: string;
  transition?: string;
  motion?: string;
};

export type AssetSpec = {
  id: string;
  type: AssetType;
  source: string;
  usage?: AssetUsage;
};

export type VideoSpec = {
  id: string;
  title: string;
  goal: string;
  format: {
    aspectRatio: AspectRatio;
    width: number;
    height: number;
    fps: number;
    durationSec: number;
  };
  style: {
    mood: string;
    visualTone: string;
    motionStyle: string;
    reference?: string[];
  };
  content: {
    script?: string;
    captions?: string[];
    scenes?: SceneSpec[];
    cta?: string;
  };
  assets: AssetSpec[];
  output: {
    type: OutputType;
    needsDownload: boolean;
  };
  constraints: {
    enginePreference?: EnginePreference;
    licenseMode?: LicenseMode;
    allowCloudRender: boolean;
  };
};

export type EngineDecision = {
  engine: EngineName;
  confidence: number;
  reason: string;
  recommendation: EngineRecommendation;
  engineFits: EngineFit[];
  selectionGuide: string;
  licenseRisk: "low" | "medium" | "high";
  fallback?: EngineName;
};

export type EngineFit = {
  engine: EngineName;
  fitPercent: number;
  reason: string;
  bestUse: string;
  recommendation: EngineRecommendation;
};

export type EngineRecommendation = {
  summary: string;
  strengths: string[];
  tradeoffs: string[];
  creativeDirection: string;
};

export type LicenseContext = {
  usage: LicenseMode;
  allowCloudRender?: boolean;
  isTeamUse?: boolean;
};

export type LicenseResult = {
  ok: boolean;
  level: "low" | "medium" | "high";
  message: string;
};

export type GeneratedProject = {
  id: string;
  engine: EngineName;
  name: string;
  rootPath: string;
  files: string[];
  metadata: Record<string, unknown>;
};

export type PreviewResult = {
  ok: boolean;
  projectId: string;
  url?: string;
  command?: string;
  message: string;
};

export type RenderResult = {
  ok: boolean;
  projectId: string;
  outputPath?: string;
  command?: string;
  logs?: string;
  message: string;
};

export type GenerateProjectContext = {
  jobId?: string;
  outputDir?: string;
  logDir?: string;
  dryRun?: boolean;
};

export type RenderContext = {
  outputDir?: string;
  logDir?: string;
  skipBuildPackages?: boolean;
};

export interface VideoEngine {
  name: EngineName;
  canHandle(spec: VideoSpec): boolean;
  generateProject(
    spec: VideoSpec,
    context?: GenerateProjectContext
  ): Promise<GeneratedProject>;
  preview(project: GeneratedProject): Promise<PreviewResult>;
  render(
    project: GeneratedProject,
    context?: RenderContext
  ): Promise<RenderResult>;
  validateLicense(context: LicenseContext): Promise<LicenseResult>;
}
