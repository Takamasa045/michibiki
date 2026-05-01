# Examples

These examples are small, local-first prompts for validating the MVP routing and rendering flow.

Run from the repository root after `pnpm build`.

## Remotion: Event Promo

Best for template-driven motion graphics and the existing Remotion Studio Monorepo.

```bash
pnpm video-router create \
  --engine remotion \
  --aspect-ratio 9:16 \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/event-promo/prompt.txt)"
```

Use `--render` instead of `--dry-run` when the Remotion Studio Monorepo is installed and you want an MP4.

## HyperFrames: LP Trailer

Best for Web, DOM, CSS, JavaScript, URL, and LP-style motion.

```bash
pnpm video-router generate \
  --engine hyperframes \
  --duration 1 \
  --render \
  --prompt "$(cat examples/lp-trailer/prompt.txt)"
```

## Editframe: Asset Short

Best for media assets, timeline previews, captions, audio, and B-roll workflows.

```bash
pnpm video-router generate \
  --engine editframe \
  --duration 1 \
  --asset examples/asset-short/input/clip.mp4 \
  --asset examples/asset-short/input/voice.mp3 \
  --render \
  --prompt "$(cat examples/asset-short/prompt.txt)"
```

The MVP timeline preview does not require these placeholder asset files to exist. The paths are preserved in `timeline.json` for the future real Editframe SDK/CLI integration.

## Data Video

Best for data-driven Remotion templates and future CSV/JSON-driven variants.

```bash
pnpm video-router create \
  --engine remotion \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/data-video/prompt.txt)"
```
