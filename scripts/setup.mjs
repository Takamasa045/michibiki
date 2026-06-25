import { spawn } from "node:child_process";
import process from "node:process";

const MIN_NODE_VERSION = "24.18.0";
const PNPM_VERSION = "11.9.0";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const nodeCheck = checkNodeVersion(process.version);
if (!nodeCheck.ok) {
  console.error(
    `Michibiki requires Node.js >=${MIN_NODE_VERSION} (current: ${process.version}).`
  );
  console.error(
    `Install Node.js ${MIN_NODE_VERSION} or newer, then rerun node scripts/setup.mjs.`
  );
  process.exit(1);
}

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

function checkNodeVersion(version) {
  return {
    ok: isNodeVersionSupported(version)
  };
}

function isNodeVersionSupported(version) {
  const current = parseNodeVersion(version);
  const minimum = parseNodeVersion(MIN_NODE_VERSION);
  if (!current || !minimum) return false;

  return compareNodeVersions(current, minimum) >= 0;
}

function parseNodeVersion(version) {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareNodeVersions(left, right) {
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}
