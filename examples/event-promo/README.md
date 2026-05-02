# Event Promo

Expected engine: `remotion`

Input type: natural language

Use this to validate that a plain user request can route to Remotion while still producing relative fit guidance for all three engines.

```bash
pnpm michibiki create \
  --aspect-ratio 9:16 \
  --duration 3 \
  --dry-run \
  --prompt "$(cat examples/event-promo/prompt.txt)"
```
