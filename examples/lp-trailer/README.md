# LP Trailer

Expected engine: `hyperframes`

Input type: URL / LP

Use this to validate Web/DOM/URL based project generation, local MP4 rendering, and relative fit guidance for all three engines.

```bash
pnpm michibiki generate \
  --duration 1 \
  --render \
  --prompt "$(cat examples/lp-trailer/prompt.txt)"
```
