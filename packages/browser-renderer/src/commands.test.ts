import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { runCommand } from "./commands.js";

describe("runCommand", () => {
  it("treats a stable success file as completion for hanging screenshot commands", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "michibiki-command-"));
    const successFile = path.join(tempDir, "frame.png");
    const start = performance.now();

    const result = await runCommand(
      process.execPath,
      [
        "-e",
        "require('node:fs').writeFileSync(process.argv[1], 'png'); setTimeout(() => {}, 10000);",
        successFile
      ],
      { detached: true, timeoutMs: 5000, successFile, successFileSettleMs: 120 }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("timed out");
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
