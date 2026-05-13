import { spawn } from "node:child_process";
import process from "node:process";

const PNPM_VERSION = "11.1.1";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const steps = [
  {
    label: "Enable Corepack",
    command: "corepack",
    args: ["enable"]
  },
  {
    label: `Prepare pnpm ${PNPM_VERSION}`,
    command: "corepack",
    args: ["prepare", `pnpm@${PNPM_VERSION}`, "--activate"]
  },
  {
    label: "Install dependencies",
    command: pnpmCommand,
    args: ["install", "--frozen-lockfile"],
    env: { CI: "true" }
  },
  {
    label: "Build Michibiki",
    command: pnpmCommand,
    args: ["build"]
  },
  {
    label: "Run doctor",
    command: pnpmCommand,
    args: ["michibiki", "doctor"]
  }
];

for (const step of steps) {
  console.log(`\n==> ${step.label}`);
  await run(step.command, step.args, step.env);
}

console.log("\nSetup complete. Try: pnpm michibiki decide --prompt \"30秒のイベント告知動画を作りたい\"");

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...extraEnv },
      shell: false,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `${command} ${args.join(" ")} failed to start: ${error.message}`
        )
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}
