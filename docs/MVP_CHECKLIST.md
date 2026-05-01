# MVP Checklist

This checklist defines the current CLI-first MVP completion target.

## Included

- Natural-language prompt to `VideoSpec`
- Engine routing for `remotion`, `hyperframes`, and `editframe`
- License guard output before engine execution
- Remotion project generation through the external Remotion Studio Monorepo
- Remotion local render path when the external monorepo is installed
- HyperFrames HTML/CSS/JS project generation
- HyperFrames local MP4 rendering through headless Chrome and ffmpeg
- Editframe timeline handoff generation
- Editframe local MP4 timeline preview rendering through headless Chrome and ffmpeg
- Shared render job manifest package
- Shared browser renderer package
- CLI commands: `create`, `generate`, `preview`, `render`, `inspect`, `engines`, `doctor`
- Multilingual README
- License and third-party notices
- MVP example prompts for Remotion, HyperFrames, Editframe, and data-video workflows

## Not Included

- Multi-user authentication
- Billing
- SaaS deployment
- Cloud render queue
- Real HyperFrames engine package integration beyond the local HTML/CSS/JS draft renderer
- Real Editframe SDK/CLI media composition beyond timeline handoff and preview
- Full Studio dashboard integration
- Legal review of third-party license usage

## Release Gate

Run these before tagging an MVP release:

```bash
pnpm install
pnpm build
pnpm test
pnpm audit --audit-level moderate
pnpm pack:check
pnpm michibiki doctor
pnpm michibiki generate --engine hyperframes --duration 1 --render --prompt "$(cat examples/lp-trailer/prompt.txt)"
pnpm michibiki generate --engine editframe --duration 1 --asset examples/asset-short/input/clip.mp4 --asset examples/asset-short/input/voice.mp3 --render --prompt "$(cat examples/asset-short/prompt.txt)"
```

For Remotion, use dry-run when the external monorepo is not installed:

```bash
pnpm michibiki create --engine remotion --duration 3 --dry-run --prompt "$(cat examples/event-promo/prompt.txt)"
```
