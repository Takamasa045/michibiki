# Architecture

Michibiki uses `VideoSpec` as the central contract between natural-language input, routing, engine adapters, and output management.

```text
User Prompt / CLI / Studio UI
  ↓
VideoSpec
  ↓
Engine Router
  ↓
VideoEngine adapter
  ↓
Generated Project
  ↓
Preview Result / Render
  ↓
outputs/projects/<slug>
```

## Core Boundaries

### `packages/video-spec`

Defines:

- `VideoSpec`
- `SceneSpec`
- `AssetSpec`
- `EngineName`
- `EngineDecision`
- `VideoEngine`
- prompt-to-spec MVP heuristics

### `packages/router`

Selects the best engine from a `VideoSpec`.

The router intentionally does not call engine internals. It returns only an `EngineDecision`.

`EngineDecision` includes the selected engine plus `engineFits`, a three-engine relative fit comparison whose percentages sum to 100. Each fit includes the reason, best use for this specific video, and the engine-specific recommendation. `selectionGuide` is a natural-language summary intended for CLI output and agent responses in Claude Code, Codex, or Antigravity.

Engine-specific proposal language should use `docs/ENGINE_PROFILES.md` so the response reflects each engine's real strengths instead of reducing them to "template", "LP", or "asset editing" labels.

For natural-language agent workflows, see the root `AGENTS.md` (canonical agent rules; `CLAUDE.md` and `GEMINI.md` are thin compatibility pointers to it). Agents should not stop after summarizing a URL or page; they must surface `engineFits`, `selectionGuide`, and the evidence for any existing video assets before asking the user to choose or proceeding with generation.

### `packages/compliance`

Returns license guard results before execution.

The guard is intentionally conservative for Remotion commercial, team, SaaS, and client-work usage.

### `packages/render-jobs`

Owns the `outputs/projects/<slug>` filesystem contract (legacy `outputs/jobs/<job-id>` paths still resolve for backward compatibility).

It creates per-deliverable job directories (the folder name is a title-derived, collision-safe slug), writes `video-spec.json`, `engine-decision.json`, `license-result.json`, reads `project/project.json`, and stores `preview/preview-result.json`. CLI, future API routes, and Studio views should share this package instead of duplicating job manifest logic.

### `packages/browser-renderer`

Provides the shared local browser render path used by browser-preview engines.

It resolves a Chrome-compatible executable, captures deterministic PNG frames from `file://` HTML previews with `?frame=<n>&fps=<fps>`, and combines the frames into `render/output.mp4` with ffmpeg.

### `packages/engine-remotion`

Runs Remotion in one of two modes:

- `monorepo`: calls the existing Remotion Studio Monorepo as an external engine.
- `standalone`: generates a minimal official Remotion project inside the job directory when the monorepo is not available.

In monorepo mode, it creates Remotion apps via:

```bash
pnpm create:project <app-name> --yes --no-install --template <default|3d>
```

In monorepo mode, it renders via:

```bash
pnpm forge render --app <app-name> --composition Main --output <path>
```

In standalone mode, it writes:

- `package.json`
- `tsconfig.json`
- `remotion.config.ts`
- `src/index.ts`
- `src/Root.tsx`
- `src/video-spec.ts`
- `public/assets/data/video-spec.json`

Standalone preview uses `pnpm exec remotion studio src/index.ts`; standalone rendering installs dependencies when needed and runs `pnpm exec remotion render src/index.ts Main <output>`.

### `packages/engine-hyperframes`

Generates a HyperFrames-compatible browser project:

- `index.html`
- `styles.css`
- `motion.js`
- `video-spec.json`

The generated page exposes the `window.__hf` seek protocol and root composition
metadata so official HyperFrames tooling can capture it deterministically.
Rendering uses the official `hyperframes` CLI by default and can be switched to
`@hyperframes/producer` or low-level `@hyperframes/engine`.
The `official-engine` backend attempts the low-level package directly and falls
back to `@hyperframes/producer` when the installed engine package cannot be
loaded by the current Node runtime.

### `packages/engine-editframe`

Generates a media-editing handoff project:

- `timeline.json`
- `preview.html`
- `video-spec.json`

Rendering uses the generated `preview.html` as a deterministic timeline preview and delegates frame capture/encoding to `packages/browser-renderer`. Wiring the actual Editframe SDK/CLI remains the next integration step for real media composition.

### `apps/cli`

Provides:

- `create`
- `generate`
- `preview`
- `render`
- `inspect`
- `engines`
- `doctor`

`generate` writes `preview/preview-result.json` after project creation. `preview` can refresh that file for an existing job without rendering a new MP4.

## Adapter Contract

All engines implement the same `VideoEngine` interface. New engines should be added without making `packages/router` depend on concrete adapter packages.
