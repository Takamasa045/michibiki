import { existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";

export type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};

export type CommandOptions = {
  detached?: boolean;
  timeoutMs?: number;
  successFile?: string;
  successFileSettleMs?: number;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandOptions
) => Promise<CommandResult>;

export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      env: process.env,
      detached: options.detached
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const commandLine = `${command} ${args.join(" ")}`;
    let timeoutTimer: NodeJS.Timeout | undefined;
    let successTimer: NodeJS.Timeout | undefined;
    let lastSuccessFileSize = -1;
    let stableSince = 0;
    const killChild = () => {
      if (options.detached && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
          return;
        } catch {
          // Fall through to killing the direct child.
        }
      }
      child.kill("SIGKILL");
    };
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (successTimer) clearInterval(successTimer);
      resolve(result);
    };
    if (options.successFile) {
      const settleMs = options.successFileSettleMs ?? 250;
      successTimer = setInterval(() => {
        if (settled || !options.successFile || !existsSync(options.successFile)) return;
        const size = statSync(options.successFile).size;
        const now = Date.now();
        if (size > 0 && size === lastSuccessFileSize) {
          if (!stableSince) stableSince = now;
          if (now - stableSince >= settleMs) {
            killChild();
            finish({
              code: 0,
              stdout,
              stderr,
              command: commandLine
            });
          }
        } else {
          stableSince = 0;
          lastSuccessFileSize = size;
        }
      }, 100);
    }
    timeoutTimer = options.timeoutMs
      ? setTimeout(() => {
          stderr += `Command timed out after ${options.timeoutMs}ms.\n`;
          killChild();
          finish({
            code: 124,
            stdout,
            stderr,
            command: commandLine
          });
        }, options.timeoutMs)
      : undefined;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      finish({
        code: 1,
        stdout,
        stderr,
        command: commandLine
      });
    });
    child.on("close", (code) => {
      finish({
        code: code ?? 1,
        stdout,
        stderr,
        command: commandLine
      });
    });
  });
}
