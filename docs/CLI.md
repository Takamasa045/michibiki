# CLI Reference

Full command reference for the `michibiki` CLI. For a high-level overview and setup, see the [README](../README.md).

> `pnpm michibiki <command>` is how every CLI invocation works in this repo. The legacy `pnpm video-router` script and the `video-router` binary remain available as aliases.

## Commands

```bash
pnpm michibiki decide   --prompt "..."                          # engine selection only, no side effects
pnpm michibiki generate --prompt "..." [--engine X]             # project files only
pnpm michibiki create   --prompt "..."                          # alias-style generate entry point
pnpm michibiki preview  --job outputs/jobs/<job-id>             # validate (headless browser for HyperFrames/Editframe)
pnpm michibiki render   --job outputs/jobs/<job-id> --confirm-render   # final MP4 (gated)
pnpm michibiki inspect  --job outputs/jobs/<job-id>             # show job manifest and decision
pnpm michibiki doctor                                           # environment / engine detection
pnpm michibiki engines                                          # list engines and capabilities
```

## decide vs generate

Use `decide` for **side-effect-free engine selection** before a user has approved generation. It prints the selected engine, a natural-language `selectionGuide`, and `engineFits` scores for Remotion, HyperFrames, and Editframe without creating a job, project, preview, or render. Use `generate` or `create` only after the generation scope is approved.

Every generated job writes `engine-decision.json` with the same selected engine, `selectionGuide`, and `engineFits` data. The percentages are relative across the three engines so users can choose a different path with `--engine` when the creative direction fits better. Each engine fit includes `bestUse` and `featureHighlights`.

## Recommended pipeline (4 stages, each opt-in)

```bash
pnpm michibiki decide   --prompt "..."                                 # 1. inspect engineFits, no side effects
pnpm michibiki generate --prompt "..." [--engine X]                    # 2. project files only
pnpm michibiki preview  --job outputs/jobs/<id>                        # 3. validate (headless browser for HyperFrames/Editframe)
pnpm michibiki render   --job outputs/jobs/<id> --confirm-render       # 4. final MP4 (gated)
```

`generate` no longer auto-runs preview. Pass `--preview` to opt in. `--render` requires `--confirm-render` to actually run an MP4 — this prevents agents from rendering without explicit user approval.

## Remotion mode resolution

The Remotion adapter runs in `auto` mode by default. If the external Remotion Studio Monorepo is found, Michibiki generates into that monorepo. If it is not found, Michibiki creates a standalone official Remotion project under the job directory instead.

Standalone Remotion output includes a minimal `package.json`, `src/index.ts`, `src/Root.tsx`, and `public/assets/data/video-spec.json`.

In monorepo mode the adapter looks for the external Remotion Studio Monorepo in this order:

1. `VIDEO_ROUTER_REMOTION_REPO`
2. `engines/remotion-studio-monorepo`
3. `../remotion-studio-monorepo`
4. `~/apps/remotion-studio-monorepo`

Recommended local setup:

```bash
git clone https://github.com/Takamasa045/remotion-studio-monorepo engines/remotion-studio-monorepo
pnpm --dir engines/remotion-studio-monorepo install
```

Force a mode with `--remotion-mode monorepo` or `--remotion-mode standalone`:

```bash
pnpm michibiki generate --engine remotion --remotion-mode standalone --prompt "Create a 15-second promo."
```

## HyperFrames rendering

HyperFrames rendering uses the official CLI by default. Select another backend when needed:

```bash
pnpm michibiki render --job outputs/jobs/<id> --confirm-render --hyperframes-renderer official-producer
pnpm michibiki render --job outputs/jobs/<id> --confirm-render --hyperframes-renderer official-engine
```

Useful HyperFrames render options:

```bash
--hyperframes-quality draft|standard|high
--hyperframes-format mp4|webm|mov
--hyperframes-workers 2
--hyperframes-docker
--hyperframes-gpu
```

`official-engine` attempts the low-level `@hyperframes/engine` capture API first. If the installed package cannot be loaded directly by Node, Michibiki falls back to `@hyperframes/producer`, which is the official complete MP4 pipeline built on top of the engine.

When a HyperFrames prompt asks for HTML-in-Canvas / `drawElementImage` / DOM-to-canvas VFX, Michibiki installs the official registry bundle into the generated project with the workspace-pinned HyperFrames CLI, equivalent to `pnpm --filter @michibiki/engine-hyperframes exec hyperframes add html-in-canvas --dir <generated-project> --no-clipboard --json`. Live Studio preview needs `chrome://flags/#canvas-draw-element`; official HyperFrames rendering enables that flag automatically.

## Force a specific engine

```bash
pnpm michibiki generate --engine hyperframes --prompt "Turn this LP into a 15-second DOM motion video https://example.com"
pnpm michibiki generate --engine editframe --asset ./clip.mp4 --asset ./voice.mp3 --prompt "Create a captioned short from these assets."
```

## Generated job layout

```text
outputs/jobs/<job-id>/
  video-spec.json
  engine-decision.json
  license-result.json
  project/project.json
  preview/preview-result.json
  render/
  logs/
```

## Examples

Runnable examples are in [`../examples/`](../examples/). They cover multiple entry points, not only URLs:

```bash
pnpm michibiki create   --duration 3 --prompt "$(cat examples/event-promo/prompt.txt)"
pnpm michibiki generate --duration 1 --render --confirm-render --prompt "$(cat examples/lp-trailer/prompt.txt)"
pnpm michibiki create   --duration 3 --prompt "$(cat examples/data-video/brief.json)"
pnpm michibiki generate --duration 1 --asset examples/asset-short/input/clip.mp4 --asset examples/asset-short/input/voice.mp3 --render --confirm-render --prompt "$(cat examples/asset-short/prompt.txt)"
pnpm michibiki create   --engine remotion --remotion-mode standalone --duration 3 --prompt "$(cat examples/event-promo/prompt.txt)"
```

The example set includes natural-language prompts, URL/LP inputs, structured JSON briefs, and asset-based timeline inputs. Each path is expected to produce the same decision shape: selected engine, `engineFits`, `selectionGuide`, `bestUse`, and `featureHighlights`.

## Related docs

- [`ENGINE_PROFILES.md`](ENGINE_PROFILES.md) — Remotion / HyperFrames / Editframe strengths, tradeoffs, and best-use patterns
- [`../AGENTS.md`](../AGENTS.md) — canonical agent rules for natural-language and URL promo requests
- [`AGENT_RESPONSE_EXAMPLES.md`](AGENT_RESPONSE_EXAMPLES.md) — agent response samples
- [`PUBLISHING.md`](PUBLISHING.md) — release publishing steps
- [`ROADMAP.md`](ROADMAP.md) — planned work
