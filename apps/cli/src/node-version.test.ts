import { describe, expect, it } from "vitest";
import {
  MIN_NODE_VERSION,
  checkNodeVersion,
  formatUnsupportedNodeVersion,
  isNodeVersionSupported
} from "./node-version.js";

describe("node version support", () => {
  it("accepts Node versions at or above the Michibiki minimum", () => {
    expect(isNodeVersionSupported("v24.16.0")).toBe(true);
    expect(isNodeVersionSupported("24.16.1")).toBe(true);
    expect(isNodeVersionSupported("24.17.0")).toBe(true);
    expect(isNodeVersionSupported("25.0.0")).toBe(true);
  });

  it("rejects Node versions below the Michibiki minimum", () => {
    expect(isNodeVersionSupported("v22.22.3")).toBe(false);
    expect(isNodeVersionSupported("v22.17.0")).toBe(false);
    expect(isNodeVersionSupported("24.15.9")).toBe(false);
    expect(isNodeVersionSupported("24.0.0")).toBe(false);
  });

  it("returns a user-facing unsupported-version message", () => {
    const check = checkNodeVersion("v22.22.3");

    expect(check).toEqual({
      ok: false,
      current: "v22.22.3",
      required: `>=${MIN_NODE_VERSION}`
    });
    expect(formatUnsupportedNodeVersion(check)).toContain(
      "Michibiki requires Node.js >=24.16.0"
    );
    expect(formatUnsupportedNodeVersion(check)).toContain("current: v22.22.3");
  });
});
