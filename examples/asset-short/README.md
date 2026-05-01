# Asset Short

Expected engine: `editframe`

Use this to validate asset/timeline project generation and local MP4 timeline preview rendering.

```bash
pnpm michibiki generate \
  --engine editframe \
  --duration 1 \
  --asset examples/asset-short/input/clip.mp4 \
  --asset examples/asset-short/input/voice.mp3 \
  --render \
  --prompt "$(cat examples/asset-short/prompt.txt)"
```

The MVP timeline preview stores the asset paths in `timeline.json`; it does not decode the placeholder assets yet.
