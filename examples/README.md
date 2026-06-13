# Examples

These examples are small, local-first inputs for validating that Michibiki can route from multiple entry points and still produce `engineFits`, `selectionGuide`, `bestUse`, and `featureHighlights`.

Run from the repository root after `pnpm build`.

## Natural Language: Event Promo

Best for a plain user request with no URL, source media, or structured file.

```bash
pnpm michibiki create \
  --aspect-ratio 9:16 \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/event-promo/prompt.txt)"
```

This should recommend Remotion by default while still showing HyperFrames and Editframe as relative alternatives.

## URL / LP: Website Trailer

Best for a website, landing page, or URL that should become browser-native motion.

```bash
pnpm michibiki generate \
  --duration 1 \
  --render \
  --confirm-render \
  --prompt "$(cat examples/lp-trailer/prompt.txt)"
```

This should recommend HyperFrames by default while still explaining how Remotion or Editframe could be used creatively.

## Assets: Timeline Short

Best for source video, audio, captions, B-roll, and timeline-led editing.

```bash
pnpm michibiki generate \
  --duration 1 \
  --asset examples/asset-short/input/clip.mp4 \
  --asset examples/asset-short/input/voice.mp3 \
  --render \
  --confirm-render \
  --prompt "$(cat examples/asset-short/prompt.txt)"
```

The local timeline preview does not require these placeholder asset files to exist. The paths are preserved in `timeline.json` for a future full Editframe SDK/CLI integration.

## Structured Brief / Code-Like Input: Data Video

Best for JSON, Markdown, scene specs, props, code-like instructions, or repeatable data-driven variants.

```bash
pnpm michibiki create \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/data-video/brief.json)"
```

This should recommend Remotion by default because the input describes JSON props, data, scenes, and deterministic motion.
