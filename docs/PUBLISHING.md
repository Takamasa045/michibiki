# Publishing

This project publishes public releases through GitHub Releases. It does not publish to npmjs.com.

## GitHub Release

The `Release` workflow uses Release Please and `GITHUB_TOKEN`, so it only needs GitHub repository permissions.

1. Land changes on `main` with Conventional Commit messages such as `feat:`, `fix:`, `perf:`, or `docs:`.
2. The `Release` workflow opens or updates a release PR when there are releasable changes.
3. Review the generated version bump and `CHANGELOG.md` update.
4. Merge the release PR. The workflow creates the `v*` tag and GitHub Release.

GitHub automatically attaches source archives to each release. Build outputs and engine checkouts are intentionally not committed:

- generated jobs stay under `outputs/jobs/`
- third-party engine checkouts stay under `engines/`

## Release Gate

Run this before merging release changes:

```bash
pnpm release:check
pnpm michibiki doctor
pnpm michibiki generate --engine hyperframes --duration 1 --render --prompt "$(cat examples/lp-trailer/prompt.txt)"
pnpm michibiki generate --engine editframe --duration 1 --asset examples/asset-short/input/clip.mp4 --asset examples/asset-short/input/voice.mp3 --render --prompt "$(cat examples/asset-short/prompt.txt)"
pnpm michibiki create --engine remotion --duration 3 --dry-run --prompt "$(cat examples/event-promo/prompt.txt)"
```

## npm

The repository is a pnpm workspace, but npmjs.com is not a publication target for this release mode. The root package stays `private: true`, and there is no npm token, Trusted Publisher, or npm publish workflow required.

## Third-party Engines

The repository does not vendor Remotion, HyperFrames, or Editframe source code. Users remain responsible for each engine's current official license and terms.
