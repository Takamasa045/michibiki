# Contributing

Keep changes small, typed, and testable.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm pack:check
```

Before an MVP release, also run the release gate in `docs/MVP_CHECKLIST.md`.

## Design Rules

- Treat `VideoSpec` as the stable contract.
- Keep engine adapters behind the `VideoEngine` interface.
- Do not make `packages/router` depend on concrete engine packages.
- Keep generated artifacts under `outputs/`: both CLI render jobs and skill/manual deliverables live in `outputs/projects/<slug>/` (one folder per deliverable; legacy `outputs/jobs/<job-id>/` still resolves — see `outputs/README.md` and the Output Layout Rule in `AGENTS.md`). All of `outputs/` except `outputs/README.md` is git-ignored; run `node scripts/organize-outputs.mjs` to re-consolidate scatter.
- Keep third-party engine checkouts under `engines/` and out of git.
- Do not represent Remotion, HyperFrames, or Editframe as MIT unless their official terms say so.
- Keep example prompts short enough for local smoke tests.
