# Third Party Notices

This project is designed to integrate with third-party video engines without copying their source code into the original router packages.

## Third-party engines

| Engine | Role | License / Terms |
| --- | --- | --- |
| HyperFrames | Web/DOM/HTML/CSS/JS-style video generation | Apache-2.0 |
| Remotion | React/TypeScript motion graphics, template projects, local rendering | Remotion License |
| Editframe | media editing, timelines, subtitles, cloud/browser rendering | Editframe official terms and pricing |

## Local external engine checkout

The recommended local checkout path for the Remotion engine is:

```text
engines/remotion-studio-monorepo/
```

That directory is ignored by this repository's `.gitignore` because it is treated as an external engine checkout.

## Generated artifacts

Generated job files are written under:

```text
outputs/projects/
```

They may contain user prompts, project metadata, asset paths, and render outputs. They are ignored by default.

