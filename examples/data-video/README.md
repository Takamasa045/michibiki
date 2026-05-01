# Data Video

Expected engine: `remotion`

Use this to validate data-driven Remotion-style project generation.

```bash
pnpm michibiki create \
  --engine remotion \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/data-video/prompt.txt)"
```
