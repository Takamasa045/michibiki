# Changelog

All notable changes to Michibiki will be documented in this file.

This project follows semantic versioning for public releases.

## [0.1.2] - 2026-05-02

### Added

- Added a README quickstart with local and npm install commands.
- Added GitHub issue templates for bug reports and feature requests.
- Added a GitHub Actions workflow for npm publishing from published releases.

### Changed

- Aligned generated metadata, temporary paths, and Remotion output prefixes with the Michibiki name.

## [0.1.1] - 2026-05-02

### Changed

- Renamed publishable workspace packages from the `@video-router/*` npm scope to the `@michibiki/*` npm scope.
- Added `michibiki` as the primary CLI binary and root script.
- Kept `video-router` as a compatibility alias.

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
- The root workspace package is private.
