import { describe, expect, it } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates words", () => {
    expect(slugify("  Winter Outdoor Promo  ")).toBe("winter-outdoor-promo");
  });

  it("strips punctuation and collapses repeated separators", () => {
    expect(slugify("AI Lab: Takabon -- Demo!!")).toBe("ai-lab-takabon-demo");
  });

  it("caps the slug length at 40 characters", () => {
    const long = "a".repeat(80);
    expect(slugify(long)).toHaveLength(40);
  });

  it("falls back to 'video' when nothing sluggable remains", () => {
    expect(slugify("！！！")).toBe("video");
    expect(slugify("")).toBe("video");
  });
});
