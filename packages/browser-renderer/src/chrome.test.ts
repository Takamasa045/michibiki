import { describe, expect, it } from "vitest";
import { resolveChromePath } from "./chrome.js";

describe("resolveChromePath", () => {
  it("returns undefined or an executable candidate", () => {
    const result = resolveChromePath();

    expect(result === undefined || result.length > 0).toBe(true);
  });
});

