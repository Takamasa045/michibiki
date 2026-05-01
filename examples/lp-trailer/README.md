# LP Trailer

Expected engine: `hyperframes`

Use this to validate Web/DOM/URL based project generation and local MP4 rendering.

```bash
pnpm video-router generate \
  --engine hyperframes \
  --duration 1 \
  --render \
  --prompt "$(cat examples/lp-trailer/prompt.txt)"
```
