# Changelog

All notable changes to Michibiki will be documented in this file.

This project follows semantic versioning for public releases.

## [0.1.0] - 2026-05-02

### Added

- Initial CLI-first MVP release.
- Natural-language prompt to `VideoSpec` generation.
- Engine routing for Remotion, HyperFrames-style browser projects, and Editframe timeline handoff projects.
- Shared render job manifest storage under `outputs/jobs/`.
- Shared headless Chrome + ffmpeg renderer for browser-preview engines.
- CLI commands: `create`, `generate`, `preview`, `render`, `inspect`, `engines`, and `doctor`.
- License guard output for third-party engine usage.
- MVP examples and release gate documentation.
- CI workflow for build, test, audit, and package-content checks.

### Notes

- HyperFrames and Editframe adapters generate local draft projects and MP4 previews; they do not bundle the official SDKs.
- Remotion support calls an external Remotion Studio Monorepo checkout.
- The root workspace package is private; publishable workspace packages remain under the `@video-router/*` npm scope for now.
