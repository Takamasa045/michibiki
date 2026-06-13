import { describe, expect, it } from "vitest";
import { buildPlan } from "./organize-outputs.mjs";

// Mirrors the real outputs/ scatter closely enough to lock in behavior.
function sampleInventory(overrides = {}) {
  return {
    topEntries: [
      { name: "pixverse-clips", isDir: true },
      { name: "pixverse-clips-urgency", isDir: true },
      { name: "audio", isDir: true },
      { name: "previews", isDir: true },
      { name: "final", isDir: true },
      { name: "assets", isDir: true },
      { name: "ai-lab-takabon-suno-demo", isDir: true },
      { name: "ai-lab-takabon-remotion-cinematic", isDir: true },
      { name: "hyperframes", isDir: true }, // protected (engine)
      { name: "jobs", isDir: true }, // protected (CLI)
      { name: "projects", isDir: true }, // protected (target)
      { name: "mystery-thing", isDir: true }, // unknown -> unmatched
      { name: ".DS_Store", isDir: false }
    ],
    filesByDir: {
      "pixverse-clips": ["bg-a-16x9.mp4", "bg-a-9x16.mp4"],
      "pixverse-clips-urgency": ["bgU-a-16x9.mp4"],
      audio: ["master.wav", "music__x.mp3"],
      previews: ["16x9-1-hero.jpeg", "qc/qc-16x9-t2.5.jpg"],
      final: ["pixverse-tokyo-promo-16x9.mp4", "pixverse-tokyo-urgency-9x16.mp4", "stray.mp4"]
    },
    nestedDirs: ["assets/ai-agent-lab-matsumoto"],
    dsStores: [".DS_Store", "ai-lab-takabon-suno-demo/.DS_Store", "jobs/job_x/.DS_Store"],
    nodeModules: [
      "ai-lab-takabon-remotion-cinematic/node_modules",
      "jobs/job_x/project/remotion/node_modules"
    ],
    ...overrides
  };
}

function targetsOf(plan) {
  return plan.moves.map((m) => m.to);
}

describe("buildPlan", () => {
  it("colocates type-bucket files under projects/<slug>/<bucket>/", () => {
    const plan = buildPlan(sampleInventory());
    const t = targetsOf(plan);
    expect(t).toContain("projects/pixverse-tokyo/clips/bg-a-16x9.mp4");
    expect(t).toContain("projects/pixverse-tokyo/clips/bgU-a-16x9.mp4");
    expect(t).toContain("projects/pixverse-tokyo/audio/master.wav");
    expect(t).toContain("projects/pixverse-tokyo/previews/16x9-1-hero.jpeg");
  });

  it("preserves nested substructure (previews/qc/)", () => {
    const plan = buildPlan(sampleInventory());
    expect(targetsOf(plan)).toContain("projects/pixverse-tokyo/previews/qc/qc-16x9-t2.5.jpg");
  });

  it("strips the redundant slug prefix on final/ renders", () => {
    const plan = buildPlan(sampleInventory());
    const t = targetsOf(plan);
    expect(t).toContain("projects/pixverse-tokyo/final/promo-16x9.mp4");
    expect(t).toContain("projects/pixverse-tokyo/final/urgency-9x16.mp4");
  });

  it("moves already-colocated project dirs wholesale", () => {
    const plan = buildPlan(sampleInventory());
    const froms = plan.dirMoves.map((m) => m.from);
    expect(froms).toContain("ai-lab-takabon-suno-demo");
    expect(froms).toContain("ai-lab-takabon-remotion-cinematic");
    expect(froms).toContain("assets/ai-agent-lab-matsumoto");
    const matsumoto = plan.dirMoves.find((m) => m.from === "assets/ai-agent-lab-matsumoto");
    expect(matsumoto.to).toBe("projects/ai-agent-lab-matsumoto");
  });

  it("never reorganizes protected engine/CLI dirs", () => {
    const plan = buildPlan(sampleInventory());
    const allTargets = [...plan.moves, ...plan.dirMoves].map((m) => m.from);
    for (const p of ["jobs", "hyperframes", "projects"]) {
      expect(allTargets.some((f) => f.startsWith(p))).toBe(false);
    }
    expect(plan.unmatched.some((u) => u.from === "jobs")).toBe(false);
  });

  it("flags unknown entries instead of guessing", () => {
    const plan = buildPlan(sampleInventory());
    const unmatchedFroms = plan.unmatched.map((u) => u.from);
    expect(unmatchedFroms).toContain("mystery-thing");
    expect(unmatchedFroms).toContain("final/stray.mp4");
  });

  it("detects collisions when two sources map to the same target", () => {
    const inv = sampleInventory({
      filesByDir: {
        "pixverse-clips": ["bg-a-16x9.mp4"],
        "pixverse-clips-urgency": ["bg-a-16x9.mp4"], // same basename -> same target
        audio: [],
        previews: [],
        final: []
      }
    });
    const plan = buildPlan(inv);
    expect(plan.collisions.length).toBeGreaterThan(0);
    // only one of the colliding moves is kept; the conflict is reported.
    const dest = "projects/pixverse-tokyo/clips/bg-a-16x9.mp4";
    expect(plan.moves.filter((m) => m.to === dest)).toHaveLength(1);
  });

  it("honors clean:false by skipping deletions", () => {
    const plan = buildPlan(sampleInventory(), { clean: false });
    expect(plan.cleanups.dsStores).toHaveLength(0);
    expect(plan.cleanups.nodeModules).toHaveLength(0);
  });

  it("collects non-jobs .DS_Store and node_modules for cleanup by default", () => {
    const plan = buildPlan(sampleInventory());
    expect(plan.cleanups.dsStores).toHaveLength(2); // jobs/ one excluded
    expect(plan.cleanups.nodeModules).toEqual([
      "ai-lab-takabon-remotion-cinematic/node_modules"
    ]);
  });

  it("leaves outputs/jobs/ untouched by default, surfacing it as opt-in", () => {
    const plan = buildPlan(sampleInventory());
    expect(plan.cleanups.nodeModules.some((p) => p.startsWith("jobs/"))).toBe(false);
    expect(plan.cleanups.dsStores.some((p) => p.startsWith("jobs/"))).toBe(false);
    expect(plan.skippedJobsCleanup.nodeModules).toEqual([
      "jobs/job_x/project/remotion/node_modules"
    ]);
    expect(plan.skippedJobsCleanup.dsStores).toEqual(["jobs/job_x/.DS_Store"]);
  });

  it("extends cleanup into jobs/ only with cleanJobs:true", () => {
    const plan = buildPlan(sampleInventory(), { cleanJobs: true });
    expect(plan.cleanups.nodeModules).toContain("jobs/job_x/project/remotion/node_modules");
    expect(plan.cleanups.dsStores).toContain("jobs/job_x/.DS_Store");
    expect(plan.skippedJobsCleanup.nodeModules).toHaveLength(0);
  });

  it("does not flag the tracked outputs/README.md as unmatched", () => {
    const inv = sampleInventory();
    inv.topEntries.push({ name: "README.md", isDir: false });
    const plan = buildPlan(inv);
    expect(plan.unmatched.some((u) => u.from === "README.md")).toBe(false);
  });

  it("returns a deeply frozen plan (immutability, incl. nested arrays)", () => {
    const plan = buildPlan(sampleInventory());
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.moves)).toBe(true);
    expect(Object.isFrozen(plan.prune)).toBe(true);
    expect(Object.isFrozen(plan.cleanups)).toBe(true);
    expect(Object.isFrozen(plan.cleanups.nodeModules)).toBe(true);
    expect(() => plan.prune.push("../escape")).toThrow();
  });
});
