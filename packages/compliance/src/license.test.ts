import { describe, expect, it } from "vitest";
import { validateLicense } from "./license.js";

describe("validateLicense", () => {
  it("marks HyperFrames as low risk with notice requirement", () => {
    expect(validateLicense("hyperframes", { usage: "commercial" })).toEqual({
      ok: true,
      level: "low",
      message:
        "HyperFrames uses Apache-2.0. Please retain required notices."
    });
  });

  it("blocks Remotion commercial use without explicit acknowledgement", () => {
    expect(validateLicense("remotion", { usage: "commercial" })).toMatchObject({
      ok: false,
      level: "high"
    });
  });

  it("allows Remotion personal usage with a warning level", () => {
    expect(validateLicense("remotion", { usage: "personal" })).toMatchObject({
      ok: true,
      level: "medium"
    });
  });
});

