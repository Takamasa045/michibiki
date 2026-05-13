import { describe, expect, it } from "vitest";
import { getChromePathCandidates, resolveChromePath } from "./chrome.js";

describe("resolveChromePath", () => {
  it("returns undefined or an executable candidate", () => {
    const result = resolveChromePath();

    expect(result === undefined || result.length > 0).toBe(true);
  });

  it("includes standard Windows Chrome and Edge locations", () => {
    const candidates = getChromePathCandidates({
      platform: "win32",
      homeDir: "C:\\Users\\itopan",
      env: {
        ProgramFiles: "C:\\Program Files",
        "ProgramFiles(x86)": "C:\\Program Files (x86)",
        LOCALAPPDATA: "C:\\Users\\itopan\\AppData\\Local"
      }
    });

    expect(candidates).toContain(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    );
    expect(candidates).toContain(
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
    );
    expect(candidates).toContain(
      "C:\\Users\\itopan\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
    );
  });

  it("prefers VIDEO_ROUTER_CHROME when provided", () => {
    const candidates = getChromePathCandidates({
      platform: "win32",
      homeDir: "C:\\Users\\itopan",
      env: {
        VIDEO_ROUTER_CHROME: "D:\\Portable\\chrome.exe",
        ProgramFiles: "C:\\Program Files"
      }
    });

    expect(candidates[0]).toBe("D:\\Portable\\chrome.exe");
  });
});
