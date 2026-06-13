#!/usr/bin/env node
// Organize scattered build artifacts under outputs/ into the canonical
// "1 deliverable = 1 folder" layout: outputs/projects/<slug>/{clips,audio,previews,final,assets}.
//
// Safe by design:
//   - DRY RUN by default. Pass --apply to actually move/delete.
//   - Never overwrites an existing target (collisions abort with a clear error).
//   - Never touches anything outside outputs/.
//   - Idempotent: re-running after --apply produces an empty plan.
//   - Writes a reversible ledger to outputs/.organize-ledger.json on --apply.
//
// Protected top-level dirs (engine/CLI conventions) are left untouched:
//   jobs/ (CLI), hyperframes/ remotion/ editframe/ (engine defaults), projects/ (target).
//
// Usage:
//   node scripts/organize-outputs.mjs             # dry run (default)
//   node scripts/organize-outputs.mjs --apply     # execute moves + cleanup
//   node scripts/organize-outputs.mjs --no-clean  # skip .DS_Store / node_modules deletion
//   node scripts/organize-outputs.mjs --clean-jobs# also delete regenerable node_modules under
//                                                 # jobs/ and projects/ (generated deliverables)

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Top-level dirs that are NOT scatter and must never be reorganized.
const PROTECTED = ["jobs", "projects", "hyperframes", "remotion", "editframe"];

// Declarative migration plan. Each rule maps an existing scattered source to a
// destination under outputs/projects/<slug>/. This table is the auditable
// source of truth — no heuristic guessing happens outside of it.
const MIGRATIONS = [
  // pixverse-tokyo: promo + urgency variants of one campaign (today's work).
  { kind: "files", src: "pixverse-clips", to: "projects/pixverse-tokyo/clips" },
  { kind: "files", src: "pixverse-clips-urgency", to: "projects/pixverse-tokyo/clips" },
  { kind: "files", src: "audio", to: "projects/pixverse-tokyo/audio" },
  { kind: "files", src: "previews", to: "projects/pixverse-tokyo/previews" },
  {
    kind: "glob",
    src: "final",
    // strip the redundant "pixverse-tokyo-" prefix (folder already says it).
    match: /^pixverse-tokyo-(.+)$/,
    rename: (m) => m[1],
    to: "projects/pixverse-tokyo/final"
  },
  // Already-colocated project folders: move wholesale under projects/.
  { kind: "dir", src: "ai-lab-takabon-suno-demo", to: "projects/ai-lab-takabon-suno-demo" },
  {
    kind: "dir",
    src: "ai-lab-takabon-remotion-cinematic",
    to: "projects/ai-lab-takabon-remotion-cinematic"
  },
  { kind: "dir", src: "assets/ai-agent-lab-matsumoto", to: "projects/ai-agent-lab-matsumoto" }
];

// Source dirs that should be removed if left empty after migration.
const PRUNE_IF_EMPTY = [
  "pixverse-clips",
  "pixverse-clips-urgency",
  "audio",
  "previews",
  "final",
  "assets"
];

// --- Pure planner ----------------------------------------------------------
// inventory = {
//   topEntries: [{ name, isDir }],
//   filesByDir: { [src]: string[] },   // recursive rel files (POSIX), excl .DS_Store
//   dsStores: string[],                // rel paths under outputs
//   nodeModules: string[]              // rel dir paths under outputs
// }
// Returns an immutable plan describing every action, with collisions/unmatched
// surfaced explicitly rather than silently resolved.
export function buildPlan(inventory, options = {}) {
  const clean = options.clean !== false;
  const cleanJobs = options.cleanJobs === true;
  const moves = [];
  const dirMoves = [];
  const collisions = [];
  const unmatched = [];

  const knownSources = new Set(MIGRATIONS.map((rule) => rule.src.split("/")[0]));
  const targets = new Set();

  const claim = (to) => {
    if (targets.has(to)) {
      collisions.push({ to, reason: "two sources map to the same target" });
      return false;
    }
    targets.add(to);
    return true;
  };

  for (const rule of MIGRATIONS) {
    if (rule.kind === "dir") {
      if (!hasTop(inventory, rule.src)) continue;
      if (!claim(rule.to)) continue;
      dirMoves.push({ from: rule.src, to: rule.to });
      continue;
    }

    const files = inventory.filesByDir[rule.src] ?? [];
    for (const rel of files) {
      const base = posixBasename(rel);
      if (rule.kind === "glob") {
        const m = rule.match.exec(base);
        if (!m) {
          unmatched.push({ from: `${rule.src}/${rel}`, reason: "no rule matched" });
          continue;
        }
        const renamed = rule.rename ? rule.rename(m) : base;
        const to = `${rule.to}/${posixDirname(rel, renamed)}`;
        if (!claim(to)) continue;
        moves.push({ from: `${rule.src}/${rel}`, to });
      } else {
        const to = `${rule.to}/${rel}`;
        if (!claim(to)) continue;
        moves.push({ from: `${rule.src}/${rel}`, to });
      }
    }
  }

  // Anything at the top level that is neither protected nor a known source is
  // flagged for a human — never auto-moved.
  for (const entry of inventory.topEntries) {
    if (PROTECTED.includes(entry.name)) continue;
    if (knownSources.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue; // .DS_Store, .organize-ledger.json, etc.
    if (entry.name === "README.md") continue; // the one tracked doc we keep
    unmatched.push({ from: entry.name, reason: "unknown top-level entry, left in place" });
  }

  // jobs/ (legacy CLI render-job tree) and projects/ (current per-deliverable
  // CLI output) hold regenerable node_modules tied to a deliverable. By default
  // cleanup never reaches into them; --clean-jobs opts in.
  const inGenerated = (rel) =>
    rel === "jobs" ||
    rel.startsWith("jobs/") ||
    rel === "projects" ||
    rel.startsWith("projects/");
  const allDs = inventory.dsStores ?? [];
  const allNm = inventory.nodeModules ?? [];
  const cleanups = clean
    ? {
        dsStores: allDs.filter((p) => cleanJobs || !inGenerated(p)),
        nodeModules: allNm.filter((p) => cleanJobs || !inGenerated(p))
      }
    : { dsStores: [], nodeModules: [] };
  const skippedJobsCleanup =
    clean && !cleanJobs
      ? {
          dsStores: allDs.filter(inGenerated),
          nodeModules: allNm.filter(inGenerated)
        }
      : { dsStores: [], nodeModules: [] };

  return deepFreeze({
    moves,
    dirMoves,
    cleanups,
    skippedJobsCleanup,
    prune: [...PRUNE_IF_EMPTY],
    collisions,
    unmatched
  });
}

// Recursively freeze so nested arrays/objects of the plan cannot be mutated
// between buildPlan() and apply() (defense-in-depth for a destructive op).
function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

function hasTop(inventory, src) {
  const top = src.split("/")[0];
  // For nested dir sources (e.g. assets/ai-agent-lab-matsumoto), trust the
  // recursive scan: main() only lists existing paths into filesByDir/topEntries.
  if (src.includes("/")) return inventory.nestedDirs?.includes(src) ?? false;
  return inventory.topEntries.some((e) => e.name === top && e.isDir);
}

function posixBasename(rel) {
  const parts = rel.split("/");
  return parts[parts.length - 1];
}

function posixDirname(rel, renamedBase) {
  const parts = rel.split("/");
  parts[parts.length - 1] = renamedBase;
  return parts.join("/");
}

// --- IO layer --------------------------------------------------------------
async function listFilesRec(absDir, relPrefix = "") {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue; // handled by cleanup
      out.push(...(await listFilesRec(path.join(absDir, entry.name), rel)));
    } else if (entry.name !== ".DS_Store") {
      out.push(rel);
    }
  }
  return out;
}

async function findDirsNamed(absRoot, name, relPrefix = "", acc = []) {
  let entries;
  try {
    entries = await fs.readdir(absRoot, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.name === name) {
      acc.push(rel);
      continue; // do not descend into matched dir
    }
    await findDirsNamed(path.join(absRoot, entry.name), name, rel, acc);
  }
  return acc;
}

async function findFilesNamed(absRoot, name, relPrefix = "", acc = []) {
  let entries;
  try {
    entries = await fs.readdir(absRoot, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      await findFilesNamed(path.join(absRoot, entry.name), name, rel, acc);
    } else if (entry.name === name) {
      acc.push(rel);
    }
  }
  return acc;
}

async function buildInventory(outputsRoot) {
  const topEntries = (
    await fs.readdir(outputsRoot, { withFileTypes: true })
  ).map((e) => ({ name: e.name, isDir: e.isDirectory() }));

  const filesByDir = {};
  const nestedDirs = [];
  for (const rule of MIGRATIONS) {
    if (rule.kind === "dir") {
      if (rule.src.includes("/") && existsSync(path.join(outputsRoot, rule.src))) {
        nestedDirs.push(rule.src);
      }
      continue;
    }
    filesByDir[rule.src] = await listFilesRec(path.join(outputsRoot, rule.src));
  }

  const dsStores = await findFilesNamed(outputsRoot, ".DS_Store");
  const nodeModules = await findDirsNamed(outputsRoot, "node_modules");

  return { topEntries, filesByDir, nestedDirs, dsStores, nodeModules };
}

function assertInside(root, rel) {
  const abs = path.resolve(root, rel);
  const relCheck = path.relative(root, abs);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    throw new Error(`Refusing to touch path outside outputs/: ${rel}`);
  }
  return abs;
}

async function moveFile(root, from, to, ledger) {
  const absFrom = assertInside(root, from);
  const absTo = assertInside(root, to);
  if (!existsSync(absFrom)) {
    throw new Error(`SOURCE NOT FOUND, aborting: ${from}`);
  }
  if (existsSync(absTo)) {
    throw new Error(`COLLISION: target already exists, aborting: ${to}`);
  }
  await fs.mkdir(path.dirname(absTo), { recursive: true });
  try {
    await fs.rename(absFrom, absTo);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    // Cross-device move: rename's pre-check does NOT protect fs.cp, which would
    // silently overwrite. Re-guard, copy, verify size, then remove the source.
    if (existsSync(absTo)) {
      throw new Error(`COLLISION: target appeared before copy, aborting: ${to}`);
    }
    await fs.cp(absFrom, absTo, { recursive: true, errorOnExist: true, force: false });
    const [srcStat, dstStat] = await Promise.all([fs.stat(absFrom), fs.stat(absTo)]);
    if (srcStat.isFile() && srcStat.size !== dstStat.size) {
      throw new Error(`COPY VERIFY FAILED (size mismatch), source kept: ${from}`);
    }
    await fs.rm(absFrom, { recursive: true, force: true });
  }
  ledger.moves.push({ from, to });
}

async function dirSizeHuman(absDir) {
  try {
    const res = spawnSync("du", ["-sh", absDir], { encoding: "utf8" });
    if (res.status === 0) return res.stdout.split("\t")[0].trim();
  } catch {
    /* best effort */
  }
  return "?";
}

function fmt(plan) {
  const lines = [];
  const push = (s) => lines.push(s);
  push(`MOVES (${plan.moves.length}):`);
  for (const m of plan.moves) push(`  outputs/${m.from}  ->  outputs/${m.to}`);
  push("");
  push(`DIR MOVES (${plan.dirMoves.length}):`);
  for (const m of plan.dirMoves) push(`  outputs/${m.from}/  ->  outputs/${m.to}/`);
  push("");
  push("CLEANUP:");
  push(`  .DS_Store to delete: ${plan.cleanups.dsStores.length}`);
  for (const nm of plan.cleanups.nodeModules) push(`  delete node_modules: outputs/${nm}`);
  push("");
  push(`PRUNE EMPTY SOURCE DIRS (if empty): ${plan.prune.join(", ")}`);
  const skipped = plan.skippedJobsCleanup;
  if (skipped && (skipped.nodeModules.length || skipped.dsStores.length)) {
    push("");
    push(
      `SKIPPED under outputs/jobs/ or outputs/projects/ (pass --clean-jobs to also delete; generated deliverables are kept untouched by default):`
    );
    push(`  .DS_Store: ${skipped.dsStores.length}`);
    for (const nm of skipped.nodeModules) push(`  node_modules: outputs/${nm}`);
  }
  if (plan.unmatched.length) {
    push("");
    push(`UNMATCHED (left in place, review manually):`);
    for (const u of plan.unmatched) push(`  outputs/${u.from}  (${u.reason})`);
  }
  if (plan.collisions.length) {
    push("");
    push(`COLLISIONS (must resolve before apply):`);
    for (const c of plan.collisions) push(`  outputs/${c.to}  (${c.reason})`);
  }
  return lines.join("\n");
}

// Recursively remove empty directories bottom-up. Only ever rmdir()s a dir that
// holds no files — never deletes file content. Returns true if `abs` was removed.
async function pruneEmptyTree(abs) {
  let entries;
  try {
    entries = await fs.readdir(abs, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await pruneEmptyTree(path.join(abs, entry.name));
    }
  }
  const remaining = await fs.readdir(abs);
  if (remaining.length === 0) {
    try {
      await fs.rmdir(abs);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function appendLedger(outputsRoot, ledger) {
  const ledgerPath = path.join(outputsRoot, ".organize-ledger.json");
  const history = existsSync(ledgerPath)
    ? JSON.parse(await fs.readFile(ledgerPath, "utf8"))
    : [];
  history.push(ledger);
  await fs.writeFile(ledgerPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

async function apply(outputsRoot, plan) {
  if (plan.collisions.length) {
    throw new Error(
      `Refusing to apply: ${plan.collisions.length} collision(s). Resolve them first.`
    );
  }

  // Pre-flight: every source must still exist before we delete or move anything.
  // Catches a tree that changed since the dry run, before any destructive step.
  const missing = [...plan.moves, ...plan.dirMoves]
    .map((m) => m.from)
    .filter((from) => !existsSync(assertInside(outputsRoot, from)));
  if (missing.length) {
    throw new Error(
      `Refusing to apply: ${missing.length} source(s) missing (tree changed since dry run): ` +
        `${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " …" : ""}`
    );
  }

  const ledger = {
    startedAt: new Date().toISOString(),
    moves: [],
    deleted: [],
    pruned: [],
    complete: false
  };

  // Whatever happens, persist the ledger so a partial run is auditable/undoable.
  try {
    // 1) Cleanup first so .DS_Store are not moved and node_modules don't travel.
    for (const ds of plan.cleanups.dsStores) {
      await fs.rm(assertInside(outputsRoot, ds), { force: true });
      ledger.deleted.push(ds);
    }
    for (const nm of plan.cleanups.nodeModules) {
      await fs.rm(assertInside(outputsRoot, nm), { recursive: true, force: true });
      ledger.deleted.push(nm);
    }

    // 2) File-level moves.
    for (const m of plan.moves) {
      await moveFile(outputsRoot, m.from, m.to, ledger);
    }

    // 3) Whole-dir moves.
    for (const m of plan.dirMoves) {
      const absFrom = assertInside(outputsRoot, m.from);
      const absTo = assertInside(outputsRoot, m.to);
      if (existsSync(absTo)) {
        throw new Error(`COLLISION: dir target already exists, aborting: ${m.to}`);
      }
      await fs.mkdir(path.dirname(absTo), { recursive: true });
      await fs.rename(absFrom, absTo);
      ledger.moves.push({ from: `${m.from}/`, to: `${m.to}/` });
    }

    // 4) Prune now-empty source dirs (incl. empty nested subdir skeletons left
    //    behind by file moves, e.g. previews/qc/).
    for (const dir of plan.prune) {
      const abs = assertInside(outputsRoot, dir);
      if (!existsSync(abs)) continue;
      if (await pruneEmptyTree(abs)) {
        ledger.pruned.push(dir);
      }
    }

    ledger.complete = true;
  } finally {
    ledger.finishedAt = new Date().toISOString();
    await appendLedger(outputsRoot, ledger);
  }
  return ledger;
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const clean = !args.includes("--no-clean");
  const cleanJobs = args.includes("--clean-jobs");
  const outputsRoot = path.resolve(process.cwd(), "outputs");

  if (!existsSync(outputsRoot)) {
    console.error("No outputs/ directory found. Nothing to organize.");
    process.exit(0);
  }

  const inventory = await buildInventory(outputsRoot);
  const plan = buildPlan(inventory, { clean, cleanJobs });

  console.log(fmt(plan));
  console.log("");

  // Best-effort size for node_modules deletions (display only).
  for (const nm of plan.cleanups.nodeModules) {
    const size = await dirSizeHuman(path.join(outputsRoot, nm));
    console.log(`  (node_modules outputs/${nm} ≈ ${size})`);
  }

  if (!isApply) {
    console.log("\nDRY RUN — no files changed. Re-run with --apply to execute.");
    return;
  }

  const ledger = await apply(outputsRoot, plan);
  console.log(
    `\nAPPLIED: ${ledger.moves.length} moves, ${ledger.deleted.length} deletions, ${ledger.pruned.length} pruned.`
  );
  console.log("Ledger: outputs/.organize-ledger.json");
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`organize-outputs failed: ${err.message}`);
    process.exit(1);
  });
}
