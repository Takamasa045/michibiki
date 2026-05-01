# Engine Licenses

Michibiki separates original router code from third-party video engines.

## Original Code

- License: MIT
- Scope: code in this repository, including `apps/*`, `packages/*`, docs, and examples unless otherwise noted

## HyperFrames

- License: Apache-2.0
- Status in this repository: draft adapter
- Requirement: retain required Apache-2.0 notices when HyperFrames code or binaries are distributed

## Remotion

- License: Remotion License
- Status in this repository: MVP adapter
- Integration model: external engine, called through the existing Remotion Studio Monorepo CLI
- Important note: commercial automation, team usage, SaaS usage, or client work may require a Remotion Company License. Confirm the current official Remotion license before commercial use.

## Editframe

- License/terms: Editframe official terms and pricing
- Status in this repository: timeline handoff adapter with local MP4 preview rendering
- Important note: confirm plan requirements for cloud rendering, team use, and commercial use before execution.

## Compliance Guard Behavior

The CLI writes `license-result.json` for each job.

- HyperFrames: allowed with low-risk notice
- Remotion personal/OSS: allowed with medium-risk notice
- Remotion commercial/client-work: blocked unless the user explicitly acknowledges risk
- Editframe: allowed with medium-risk notice

This guard is a practical warning layer, not a legal opinion.
