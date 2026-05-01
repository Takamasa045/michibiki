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
outputs/jobs/<job-id>
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

### `packages/compliance`

Returns license guard results before execution.

The guard is intentionally conservative for Remotion commercial, team, SaaS, and client-work usage.

### `packages/render-jobs`

Owns the `outputs/jobs/<job-id>` filesystem contract.

It creates job directories, writes `video-spec.json`, `engine-decision.json`, `license-result.json`, reads `project/project.json`, and stores `preview/preview-result.json`. CLI, future API routes, and Studio views should share this package instead of duplicating job manifest logic.

### `packages/browser-renderer`

Provides the shared local browser render path used by browser-preview engines.

It resolves a Chrome-compatible executable, captures deterministic PNG frames from `file://` HTML previews with `?frame=<n>&fps=<fps>`, and combines the frames into `render/output.mp4` with ffmpeg.

### `packages/engine-remotion`

Calls the existing Remotion Studio Monorepo as an external engine.

It creates Remotion apps via:

```bash
pnpm create:project <app-name> --yes --no-install --template <default|3d>
```

It renders via:

```bash
pnpm forge render --app <app-name> --composition Main --output <path>
```

### `packages/engine-hyperframes`

Generates a browser-previewable project:

- `index.html`
- `styles.css`
- `motion.js`
- `video-spec.json`

Rendering delegates to `packages/browser-renderer`.

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
