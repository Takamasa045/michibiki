# Changelog

All notable changes to Michibiki will be documented in this file.

This project follows semantic versioning for public releases.

## [0.1.10](https://github.com/Takamasa045/michibiki/compare/v0.1.9...v0.1.10) (2026-06-25)


### Features

* polish CLI decision output and generated preview UX


### Bug Fixes

* align setup and doctor Node.js requirements with package engines


### Documentation

* add in-README language summaries and refresh release gate commands

## [0.1.9](https://github.com/Takamasa045/michibiki/compare/v0.1.8...v0.1.9) (2026-06-21)


### Features

* **render-jobs:** write CLI jobs to outputs/projects/&lt;slug&gt; ([#77](https://github.com/Takamasa045/michibiki/issues/77)) ([94544ba](https://github.com/Takamasa045/michibiki/commit/94544baab5f238ce9fa9b970ece75d5e89dfd6fb))


### Bug Fixes

* **browser-renderer:** treat stable screenshot file as completion ([#74](https://github.com/Takamasa045/michibiki/issues/74)) ([df04c0e](https://github.com/Takamasa045/michibiki/commit/df04c0e33f61c5d96bb4b1cefe6d6dc981397add))
* **deps:** override esbuild to 0.28.1 to resolve GHSA-gv7w-rqvm-qjhr ([#71](https://github.com/Takamasa045/michibiki/issues/71)) ([6a92a7e](https://github.com/Takamasa045/michibiki/commit/6a92a7e7538ad876875cf502ed269cf676070728))
* **deps:** update video engines ([#68](https://github.com/Takamasa045/michibiki/issues/68)) ([f9e9631](https://github.com/Takamasa045/michibiki/commit/f9e9631b451f0ba9491895162f71c9a4324b81a0))
* **deps:** update video engines to ^0.6.109 ([#83](https://github.com/Takamasa045/michibiki/issues/83)) ([cead0f6](https://github.com/Takamasa045/michibiki/commit/cead0f6aabb483f4dda314458852f8f5f69b933a))
* **deps:** update video engines to ^0.6.110 ([#85](https://github.com/Takamasa045/michibiki/issues/85)) ([dbe5d8d](https://github.com/Takamasa045/michibiki/commit/dbe5d8d29a9916cdf6027c703589b810e6eb66bd))
* **deps:** update video engines to ^0.6.112 ([#87](https://github.com/Takamasa045/michibiki/issues/87)) ([5abb374](https://github.com/Takamasa045/michibiki/commit/5abb37454364b0685779121f35c94802679573da))
* **deps:** update video engines to ^0.6.114 ([#91](https://github.com/Takamasa045/michibiki/issues/91)) ([8d78102](https://github.com/Takamasa045/michibiki/commit/8d78102a72bd2c206ab57e4a89866549887da4f4))
* **deps:** update video engines to ^0.6.115 ([#93](https://github.com/Takamasa045/michibiki/issues/93)) ([d694302](https://github.com/Takamasa045/michibiki/commit/d694302781cadaf31a164fbefc616536ac0db751))
* **deps:** update video engines to ^0.6.118 ([#94](https://github.com/Takamasa045/michibiki/issues/94)) ([87b5c7b](https://github.com/Takamasa045/michibiki/commit/87b5c7bcf4c74c681cfdfd03550e83fb7ae52316))
* **deps:** update video engines to ^0.6.119 ([#95](https://github.com/Takamasa045/michibiki/issues/95)) ([be29c12](https://github.com/Takamasa045/michibiki/commit/be29c126530c5ae46f3ed7ea3568a4f5d697f306))
* **deps:** update video engines to ^0.6.99 ([#80](https://github.com/Takamasa045/michibiki/issues/80)) ([43c62cd](https://github.com/Takamasa045/michibiki/commit/43c62cd81558e9c81c8cf8c8d6e24145785ee2b6))
* enforce node version requirement ([e20a6fd](https://github.com/Takamasa045/michibiki/commit/e20a6fd98626c7d300077ffdbaac8b2e3fef25d8))
* improve CLI routing and editframe timelines ([6adf40a](https://github.com/Takamasa045/michibiki/commit/6adf40aef1afe7be922447179237761479f7a4b2))


### Code Refactoring

* cleanup dead code, fix renovate manager, split oversized modules ([#73](https://github.com/Takamasa045/michibiki/issues/73)) ([360f902](https://github.com/Takamasa045/michibiki/commit/360f90262355f3dd14e4c3afa1646e54303261bb))


### Documentation

* restructure README and extract CLI reference to docs/CLI.md ([#75](https://github.com/Takamasa045/michibiki/issues/75)) ([8860ec7](https://github.com/Takamasa045/michibiki/commit/8860ec7ca681aa81a271d9fac6784fef80f982dc))

## [0.1.8](https://github.com/Takamasa045/michibiki/compare/v0.1.7...v0.1.8) (2026-06-13)


### Features

* add `pnpm organize` command and per-project outputs layout ([#70](https://github.com/Takamasa045/michibiki/issues/70)) ([bf9692a](https://github.com/Takamasa045/michibiki/commit/bf9692a9a044d05c7dfdc5ab9b16b1edf003f6b7))


### Bug Fixes

* **deps:** update video engines to ^0.6.42 ([#17](https://github.com/Takamasa045/michibiki/issues/17)) ([aca3598](https://github.com/Takamasa045/michibiki/commit/aca3598cc989e9eed1cb8319fdc3dca89aca004e))
* **deps:** update video engines to ^0.6.45 ([#29](https://github.com/Takamasa045/michibiki/issues/29)) ([c987dab](https://github.com/Takamasa045/michibiki/commit/c987dab42ccf84ab85ec252dbb06325e880ed4dd))
* **deps:** update video engines to ^0.6.46 ([#30](https://github.com/Takamasa045/michibiki/issues/30)) ([26d7be2](https://github.com/Takamasa045/michibiki/commit/26d7be24b334749b023c0a9cd27085ec404d7113))
* **deps:** update video engines to ^0.6.51 ([#31](https://github.com/Takamasa045/michibiki/issues/31)) ([8648c40](https://github.com/Takamasa045/michibiki/commit/8648c40980e0443d8174452cab0487999d5ac13d))
* **deps:** update video engines to ^0.6.52 ([#33](https://github.com/Takamasa045/michibiki/issues/33)) ([d4d23fe](https://github.com/Takamasa045/michibiki/commit/d4d23fedbb5a17e8925a16a762876576c64a21d7))
* **deps:** update video engines to ^0.6.56 ([#34](https://github.com/Takamasa045/michibiki/issues/34)) ([cbe0999](https://github.com/Takamasa045/michibiki/commit/cbe099932a048e7fc8920906d93cea7c88a03e57))
* **deps:** update video engines to ^0.6.58 ([#35](https://github.com/Takamasa045/michibiki/issues/35)) ([7247e00](https://github.com/Takamasa045/michibiki/commit/7247e005393e5db58de3c9567a7dba7126b16ccb))
* **deps:** update video engines to ^0.6.61 ([#37](https://github.com/Takamasa045/michibiki/issues/37)) ([064dbe2](https://github.com/Takamasa045/michibiki/commit/064dbe23157b471490529db3cd5c005c1e044945))
* **deps:** update video engines to ^0.6.62 ([#39](https://github.com/Takamasa045/michibiki/issues/39)) ([60d85e3](https://github.com/Takamasa045/michibiki/commit/60d85e3ae294718fda56ba13aa87b0ce63fe31f8))
* **deps:** update video engines to ^0.6.63 ([#40](https://github.com/Takamasa045/michibiki/issues/40)) ([817fdc6](https://github.com/Takamasa045/michibiki/commit/817fdc689091336429299598e448abc46e311639))
* **deps:** update video engines to ^0.6.64 ([#41](https://github.com/Takamasa045/michibiki/issues/41)) ([e55e36f](https://github.com/Takamasa045/michibiki/commit/e55e36f7db5823891f9247aba404be56df467654))
* **deps:** update video engines to ^0.6.69 ([#44](https://github.com/Takamasa045/michibiki/issues/44)) ([8536b1d](https://github.com/Takamasa045/michibiki/commit/8536b1d721daa1256aa1d79295b198115451ef62))
* **deps:** update video engines to ^0.6.70 ([#46](https://github.com/Takamasa045/michibiki/issues/46)) ([3798b43](https://github.com/Takamasa045/michibiki/commit/3798b436ae72ebc7113566f506a62abfff17e4e6))
* **deps:** update video engines to ^0.6.72 ([#47](https://github.com/Takamasa045/michibiki/issues/47)) ([c016bac](https://github.com/Takamasa045/michibiki/commit/c016bac40dcb59d27b562aa871c10eeafd9f7824))
* **deps:** update video engines to ^0.6.73 ([#49](https://github.com/Takamasa045/michibiki/issues/49)) ([3af8e7c](https://github.com/Takamasa045/michibiki/commit/3af8e7c9532724a96b73d7da6b8eef7375fdcfad))
* **deps:** update video engines to ^0.6.76 ([#52](https://github.com/Takamasa045/michibiki/issues/52)) ([20c3e32](https://github.com/Takamasa045/michibiki/commit/20c3e327b934624e244e20a855fa1c4cb39f8d0e))
* **deps:** update video engines to ^0.6.79 ([#53](https://github.com/Takamasa045/michibiki/issues/53)) ([0261ab7](https://github.com/Takamasa045/michibiki/commit/0261ab7ad9f30159160a04c60dfd65604a120d9c))
* **deps:** update video engines to ^0.6.80 ([#55](https://github.com/Takamasa045/michibiki/issues/55)) ([7052a89](https://github.com/Takamasa045/michibiki/commit/7052a89425d9cb7021a09fd51e917a2bb5dce687))
* **deps:** update video engines to ^0.6.81 ([#57](https://github.com/Takamasa045/michibiki/issues/57)) ([6858e1e](https://github.com/Takamasa045/michibiki/commit/6858e1e7fc160ec23f215116e405f91d37288328))
* **deps:** update video engines to ^0.6.84 ([#59](https://github.com/Takamasa045/michibiki/issues/59)) ([8b1def4](https://github.com/Takamasa045/michibiki/commit/8b1def49da5af199906113e18412ffae42395124))
* **deps:** update video engines to ^0.6.88 ([#60](https://github.com/Takamasa045/michibiki/issues/60)) ([79b5429](https://github.com/Takamasa045/michibiki/commit/79b54298a8dc03243337a06ca6e697ee16a4c152))
* **deps:** update video engines to ^0.6.91 ([#64](https://github.com/Takamasa045/michibiki/issues/64)) ([0c48f60](https://github.com/Takamasa045/michibiki/commit/0c48f60467b3b0af6e17c97e7098b3d549fd5912))
* **deps:** update video engines to ^0.6.93 ([#66](https://github.com/Takamasa045/michibiki/issues/66)) ([246881b](https://github.com/Takamasa045/michibiki/commit/246881be921a226702adab74017fa61ba49d1035))

## [0.1.7](https://github.com/Takamasa045/michibiki/compare/v0.1.6...v0.1.7) (2026-05-18)


### Bug Fixes

* **deps:** override vulnerable ws version ([#16](https://github.com/Takamasa045/michibiki/issues/16)) ([64baf19](https://github.com/Takamasa045/michibiki/commit/64baf1925b6fafd15b1a1098f5efb1b7adb4a33e))
* **deps:** update video engines to ^0.6.20 ([#12](https://github.com/Takamasa045/michibiki/issues/12)) ([15f060b](https://github.com/Takamasa045/michibiki/commit/15f060b3b16da2098d2351f14379e2bb82a646c3))
* **deps:** update video engines to ^0.6.6 ([#11](https://github.com/Takamasa045/michibiki/issues/11)) ([57d9dd1](https://github.com/Takamasa045/michibiki/commit/57d9dd194e0fb344da62cf585220dedd0943454a))
* use official hyperframes renderers ([a12506f](https://github.com/Takamasa045/michibiki/commit/a12506f456bdfa33e2192f3f44ae2278d32096dd))

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
