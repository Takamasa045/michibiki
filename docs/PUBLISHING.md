# Publishing

This project is ready for a CLI-first MVP release when the local release gate and CI both pass.

## GitHub Release

1. Use this directory as the repository root.
2. Keep generated jobs under `outputs/jobs/`; they are ignored by git.
3. Keep third-party engine checkouts under `engines/`; they are ignored by git.
4. Run the release gate:

```bash
pnpm release:check
pnpm michibiki doctor
pnpm michibiki generate --engine hyperframes --duration 1 --render --prompt "$(cat examples/lp-trailer/prompt.txt)"
pnpm michibiki generate --engine editframe --duration 1 --asset examples/asset-short/input/clip.mp4 --asset examples/asset-short/input/voice.mp3 --render --prompt "$(cat examples/asset-short/prompt.txt)"
pnpm michibiki create --engine remotion --duration 3 --dry-run --prompt "$(cat examples/event-promo/prompt.txt)"
```

## npm Packages

The repository is a pnpm workspace. The root package stays `private: true` to prevent accidental publication.

Publish workspace packages only after confirming the package names and scope are available in the target npm organization.

Local publish:

```bash
npm login
npm whoami
pnpm -r publish --access public
```

GitHub Actions publish:

1. Create an npm automation token with publish access.
2. Add it to the repository as the `NPM_TOKEN` secret.
3. Run the `Publish npm packages` workflow manually. It will run `pnpm release:check` and publish workspace packages.

Each publishable package includes only compiled `dist` files and `package.json`.

## Third-party Engines

The npm packages do not vendor Remotion, HyperFrames, or Editframe source code. Users remain responsible for each engine's current official license and terms.
