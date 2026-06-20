export const MIN_NODE_VERSION = "24.17.0";

export type NodeVersionCheck = {
  ok: boolean;
  current: string;
  required: string;
};

const LIGHTWEIGHT_COMMANDS = new Set([
  "decide",
  "doctor",
  "engines",
  "help",
  "route"
]);

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
};

export function isNodeVersionSupported(version = process.version): boolean {
  const current = parseNodeVersion(version);
  const minimum = parseNodeVersion(MIN_NODE_VERSION);
  if (!current || !minimum) return false;

  return compareNodeVersions(current, minimum) >= 0;
}

export function checkNodeVersion(version = process.version): NodeVersionCheck {
  return {
    ok: isNodeVersionSupported(version),
    current: version,
    required: `>=${MIN_NODE_VERSION}`
  };
}

export function formatUnsupportedNodeVersion(
  check = checkNodeVersion(),
  command?: string
): string {
  const subject = command ? `Michibiki command "${command}"` : "Michibiki";
  return `${subject} requires Node.js ${check.required} (current: ${check.current}). Install Node.js ${MIN_NODE_VERSION} or newer, then rerun the command.`;
}

export function formatNodeVersionDetail(check = checkNodeVersion()): string {
  if (check.ok) {
    return `${check.current} (requires ${check.required})`;
  }
  return `${check.current} unsupported; requires ${check.required}`;
}

export function commandRequiresSupportedNode(command?: string): boolean {
  if (!command) return false;
  return !LIGHTWEIGHT_COMMANDS.has(command);
}

function parseNodeVersion(version: string): ParsedVersion | undefined {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareNodeVersions(
  left: ParsedVersion,
  right: ParsedVersion
): number {
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}
