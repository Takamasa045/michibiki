# Changelog

All notable changes to Michibiki will be documented in this file.

This project follows semantic versioning for public releases.

## [0.1.6](https://github.com/Takamasa045/michibiki/compare/v0.1.5...v0.1.6) (2026-05-12)


### Bug Fixes

* harden pnpm supply-chain defaults ([1f4a5bc](https://github.com/Takamasa045/michibiki/commit/1f4a5bcef5168eeffcf6fe75c8858c06c1050213))

## [0.1.5](https://github.com/Takamasa045/michibiki/compare/v0.1.4...v0.1.5) (2026-05-09)


### Bug Fixes

* stabilize HyperFrames generated renders ([34eb85a](https://github.com/Takamasa045/michibiki/commit/34eb85a6599a9176922f39bf8385edc1285af4af))

## [0.1.4](https://github.com/Takamasa045/michibiki/compare/v0.1.3...v0.1.4) (2026-05-09)


### Features

* add hyperframes html-in-canvas registry support ([20b2ed1](https://github.com/Takamasa045/michibiki/commit/20b2ed166c6576e77a1b55d03b3500988c21180f))
* **cli:** block generate when engine choice is ambiguous ([73d8961](https://github.com/Takamasa045/michibiki/commit/73d8961a20c438f68023a3b1b7accd5ed22293eb))
* **cli:** explicit render gate + opt-in preview to stop agents from skipping confirmation ([cadb562](https://github.com/Takamasa045/michibiki/commit/cadb562ca22506214db68aa92678ced1d510135a))
* **hyperframes:** use official render backends ([65544ae](https://github.com/Takamasa045/michibiki/commit/65544ae72b507ebb8769b511d170fa0e1846e00c))
* **hyperframes:** use official render backends ([0b53fa9](https://github.com/Takamasa045/michibiki/commit/0b53fa97659aecf35ec7a3189e793beae4b55767))
* **router:** add 8 new engine-essence signals + close-call notice ([e6cce6b](https://github.com/Takamasa045/michibiki/commit/e6cce6bf4cd0b5224c3e5050e539d1a3c762c92b))
* **router:** add engine capability catalog ([632764e](https://github.com/Takamasa045/michibiki/commit/632764e7e72302c67108726320fc16ff54fec3c3))
* **router:** context-aware keyword matching + clarifying questions ([5479bf7](https://github.com/Takamasa045/michibiki/commit/5479bf7dfad37bd5ae0e9375907c9badebf56c71))
* **router:** score-based engine selection + switch hints ([8660a13](https://github.com/Takamasa045/michibiki/commit/8660a1381044086d5d204a3322107344fb3bc788))


### Bug Fixes

* **release:** include component in release PR title ([d6f7943](https://github.com/Takamasa045/michibiki/commit/d6f79436da7b9fabaa1ceff05840f991f6bf0b26))
* **release:** use component release branches ([ab9c7a3](https://github.com/Takamasa045/michibiki/commit/ab9c7a3834bb62364aa9446611bbf03f385e5595))
* **router:** tighten signal regexes so engine choice matches engine reality ([048c738](https://github.com/Takamasa045/michibiki/commit/048c738675427be2407cb65cd54ca54d86710f17))


### Documentation

* add Antigravity agent compatibility ([b4f6959](https://github.com/Takamasa045/michibiki/commit/b4f69591081181dd89dc4c558b77583910838e04))
* clarify Codex and Antigravity native AGENTS.md support ([29b8c5f](https://github.com/Takamasa045/michibiki/commit/29b8c5f9f2e2b6b5d94275b090cb0cc02c2620ab))
* consolidate AGENTS.md as canonical, simplify CLAUDE.md, split i18n READMEs ([7706557](https://github.com/Takamasa045/michibiki/commit/7706557277b1a8db4466d6f12849c9d9dc925785))
* **readme:** add explicit git clone setup instructions ([13dc3fd](https://github.com/Takamasa045/michibiki/commit/13dc3fd9eeedc30ffd049d20105a2d6d4f0f08c1))

## [0.1.3](https://github.com/Takamasa045/michibiki/compare/v0.1.2...v0.1.3) (2026-05-02)


### Bug Fixes

* configure Release Please to create component-matched release PR titles
* switch release flow to GitHub releases ([a20a295](https://github.com/Takamasa045/michibiki/commit/a20a295ad353880f899a3846cc3d662c962b4014))

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
