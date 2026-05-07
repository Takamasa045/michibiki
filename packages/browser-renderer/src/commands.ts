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
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };
    const timer = options.timeoutMs
      ? setTimeout(() => {
          stderr += `Command timed out after ${options.timeoutMs}ms.\n`;
          if (options.detached && child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          } else {
            child.kill("SIGKILL");
          }
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
