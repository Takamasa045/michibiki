import { describe, expect, it } from "vitest";
import {
  MIN_NODE_VERSION,
  checkNodeVersion,
  commandRequiresSupportedNode,
  formatUnsupportedNodeVersion,
  isNodeVersionSupported
} from "./node-version.js";

describe("node version support", () => {
  it("accepts Node versions at or above the Michibiki minimum", () => {
    expect(isNodeVersionSupported("24.18.0")).toBe(true);
    expect(isNodeVersionSupported("24.18.1")).toBe(true);
    expect(isNodeVersionSupported("25.0.0")).toBe(true);
  });

  it("rejects Node versions below the Michibiki minimum", () => {
    expect(isNodeVersionSupported("v22.22.3")).toBe(false);
    expect(isNodeVersionSupported("v22.17.0")).toBe(false);
    expect(isNodeVersionSupported("24.17.9")).toBe(false);
    expect(isNodeVersionSupported("24.0.0")).toBe(false);
  });

  it("returns a user-facing unsupported-version message", () => {
    const check = checkNodeVersion("v22.22.3");

    expect(check).toEqual({
      ok: false,
      current: "v22.22.3",
      required: `>=${MIN_NODE_VERSION}`
    });
    expect(formatUnsupportedNodeVersion(check, "generate")).toContain(
      'Michibiki command "generate" requires Node.js >=24.18.0'
    );
    expect(formatUnsupportedNodeVersion(check)).toContain("current: v22.22.3");
  });

  it("allows side-effect-free commands before enforcing the full runtime minimum", () => {
    expect(commandRequiresSupportedNode()).toBe(false);
    expect(commandRequiresSupportedNode("help")).toBe(false);
    expect(commandRequiresSupportedNode("doctor")).toBe(false);
    expect(commandRequiresSupportedNode("decide")).toBe(false);
    expect(commandRequiresSupportedNode("route")).toBe(false);
    expect(commandRequiresSupportedNode("engines")).toBe(false);
  });

  it("keeps project and render commands behind the full runtime minimum", () => {
    expect(commandRequiresSupportedNode("generate")).toBe(true);
    expect(commandRequiresSupportedNode("create")).toBe(true);
    expect(commandRequiresSupportedNode("preview")).toBe(true);
    expect(commandRequiresSupportedNode("render")).toBe(true);
    expect(commandRequiresSupportedNode("inspect")).toBe(true);
  });
});
