export type ParsedArgs = {
  command?: string;
  values: Record<string, string[]>;
  flags: Set<string>;
  positionals: string[];
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const values: Record<string, string[]> = {};
  const flags = new Set<string>();
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg) continue;

    if (!arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }

    const normalized = arg.replace(/^--?/, "");
    const next = rest[index + 1];
    if (next && !next.startsWith("-")) {
      values[normalized] = [...(values[normalized] ?? []), next];
      index += 1;
    } else {
      flags.add(normalized);
    }
  }

  return { command, values, flags, positionals };
}

export function getValue(
  args: ParsedArgs,
  name: string
): string | undefined {
  return args.values[name]?.at(-1);
}

export function getValues(args: ParsedArgs, name: string): string[] {
  return args.values[name] ?? [];
}

export function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name);
}

