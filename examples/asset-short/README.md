# Asset Short

Expected engine: `editframe`

Input type: assets

Use this to validate asset/timeline project generation, local MP4 timeline preview rendering, and relative fit guidance for all three engines.

```bash
pnpm michibiki generate \
  --duration 1 \
  --asset examples/asset-short/input/clip.mp4 \
  --asset examples/asset-short/input/voice.mp3 \
  --render \
  --prompt "$(cat examples/asset-short/prompt.txt)"
```

The local timeline preview stores the asset paths in `timeline.json`; it does not decode the placeholder assets yet.
