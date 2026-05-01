# Event Promo

Expected engine: `remotion`

Use this to validate template-driven event promo project generation.

```bash
pnpm video-router create \
  --engine remotion \
  --aspect-ratio 9:16 \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/event-promo/prompt.txt)"
```
