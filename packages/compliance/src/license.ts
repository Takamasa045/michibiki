import type {
  EngineName,
  LicenseContext,
  LicenseResult
} from "@video-router/video-spec";

export function validateLicense(
  engine: EngineName,
  context: LicenseContext
): LicenseResult {
  if (engine === "hyperframes") {
    return {
      ok: true,
      level: "low",
      message: "HyperFrames uses Apache-2.0. Please retain required notices."
    };
  }

  if (engine === "remotion") {
    if (context.usage === "personal" || context.usage === "oss") {
      return {
        ok: true,
        level: "medium",
        message:
          "Personal/OSS use is expected. Please confirm the Remotion license for commercial, team, SaaS, or client work."
      };
    }

    return {
      ok: false,
      level: "high",
      message:
        "Remotion commercial automation, team usage, SaaS usage, or client work may require a Company License."
    };
  }

  return {
    ok: true,
    level: "medium",
    message:
      "Please confirm Editframe plan requirements and official terms for team, cloud, or commercial use."
  };
}

