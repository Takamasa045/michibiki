# Data Video

Expected engine: `remotion`

Input type: structured brief / code-like JSON

Use this to validate that JSON, scene specs, props, or code-like instructions can route to Remotion while still producing relative fit guidance for all three engines.

```bash
pnpm michibiki create \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/data-video/brief.json)"
```
