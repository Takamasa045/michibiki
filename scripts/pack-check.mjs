import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const workspaceDirs = ["packages", "apps"];
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

for (const workspaceDir of workspaceDirs) {
  const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    await run(pnpmCommand, ["pack", "--dry-run"], {
      cwd: path.join(workspaceDir, entry.name)
    });
  }
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed in ${options.cwd}`));
    });
  });
}
