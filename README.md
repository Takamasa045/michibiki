# Michibiki

[![CI](https://github.com/Takamasa045/michibiki/actions/workflows/ci.yml/badge.svg)](https://github.com/Takamasa045/michibiki/actions/workflows/ci.yml)

[English](#english) | [日本語](#日本語) | [简体中文](docs/i18n/README.zh-CN.md) | [한국어](docs/i18n/README.ko.md) | [Español](docs/i18n/README.es.md) | [Français](docs/i18n/README.fr.md)

> Translations under `docs/i18n/` are summaries and may lag behind the canonical English/Japanese sections. PRs welcome.

## English

Michibiki is an AI video production router. It turns a natural-language video request into a `VideoSpec`, selects the best video engine, and creates a generated project or render output.

The name comes from the Japanese word "導き" (michibiki), meaning guidance. It reflects the agent's role: guiding each video request toward the most suitable path by choosing the right engine, workflow, and output shape.

Current execution supports Remotion project generation/rendering, HyperFrames HTML/CSS/JS project generation with official HyperFrames CLI / producer / engine render backends, and Editframe timeline handoff project generation with local MP4 timeline previews. Remotion runs in `auto` mode by default: it uses an existing Remotion Studio Monorepo when available, then falls back to a standalone official Remotion project when no monorepo is present. HyperFrames renders through the official CLI by default and can also use the official producer package or the low-level engine package. Editframe renders timeline previews through the local browser/ffmpeg path.

```text
User Prompt / CLI / Studio UI
  ↓
VideoSpec
  ↓
Engine Router
  ├── HyperFrames Engine Adapter
  ├── Remotion Engine Adapter
  └── Editframe Engine Adapter
  ↓
Generated Project / Preview / Render
```

### Current Scope

Michibiki is CLI-first today. The HyperFrames adapter generates a HyperFrames-compatible HTML project and renders through selectable official backends: `official-cli` (default), `official-producer`, or `official-engine`. The Editframe adapter still generates local timeline handoff projects and MP4 previews; it does not bundle or replace the official Editframe SDK. The Remotion adapter uses an external Remotion Studio Monorepo checkout when available, or creates a standalone official Remotion project inside the job directory when it is not. Generated jobs may contain prompts, asset paths, and rendered files, and are ignored by default under `outputs/jobs/`.

## Packages

- `packages/video-spec` - core `VideoSpec`, `SceneSpec`, `AssetSpec`, engine interface, and prompt-to-spec heuristics
- `packages/router` - engine selection rules, relative `engineFits` scoring, `selectionGuide`, and `featureHighlights`
- `packages/compliance` - license guard messages and execution blocking decisions
- `packages/render-jobs` - shared job directory, manifest, and preview-result management
- `packages/browser-renderer` - shared headless Chrome + ffmpeg renderer for browser-preview engines
- `packages/engine-remotion` - adapter for external Remotion Studio Monorepo projects and standalone official Remotion projects
- `packages/engine-hyperframes` - adapter for Web/DOM/CSS/JS motion projects with official HyperFrames CLI / producer / engine rendering
- `packages/engine-editframe` - adapter for timeline/media handoff projects and local MP4 timeline previews
- `apps/cli` - `michibiki` CLI (`video-router` remains available as an alias)

## Setup

Michibiki is distributed through GitHub Releases, not npmjs.com. Clone the repository, install dependencies, and build:

```bash
git clone https://github.com/Takamasa045/michibiki.git
cd michibiki
node scripts/setup.mjs
```

Requirements: Node.js 24.16+, pnpm 11+, ffmpeg (for HyperFrames/Editframe MP4 rendering), and Chromium/Chrome/Edge (auto-detected by `michibiki doctor`).

## Dependency Automation

GitHub runs Renovate from `.github/workflows/renovate.yml` on weekdays at 07:15 JST, with `renovate.json` limiting updates to before 9am JST. The existing `video engines` Renovate group keeps HyperFrames, Remotion standalone project runtime constants, React runtime packages, and Editframe packages updated together.

Before the scheduled workflow can open pull requests, add a repository secret named `RENOVATE_TOKEN`. Use a classic PAT with `public_repo` for this public repository, or `repo` if the repository becomes private. Include the `workflow` scope so Renovate can also update GitHub Actions such as `actions/checkout` and `renovatebot/github-action`. A GitHub App installation token with equivalent repository permissions also works.

Run the `Renovate` workflow manually from GitHub Actions after setting the secret to confirm that it can create/update dependency PRs.

### Windows

Michibiki can run from an extracted ZIP on Windows with PowerShell. See `WINDOWS_START_HERE.md` for the short handoff. Install Node.js 24.16+, enable pnpm through Corepack, and keep ffmpeg on `PATH` when you need MP4 preview/render commands:

```powershell
node scripts/setup.mjs
```

Chrome and Edge are auto-detected from the standard `Program Files` and user-local install locations. If your browser is installed elsewhere, set `VIDEO_ROUTER_CHROME` before running preview/render:

```powershell
$env:VIDEO_ROUTER_CHROME="D:\Apps\Chrome\Application\chrome.exe"
pnpm michibiki doctor
```

## Quickstart

Run locally from the repository root:

```bash
pnpm michibiki doctor
pnpm michibiki decide --prompt "Create a 15-second vertical event promo video."
```

`pnpm michibiki <command>` is how every CLI invocation works in this repo. The legacy `pnpm video-router` script and the `video-router` binary remain available as aliases.

### Existing VideoSpec / PixVerse Handoff

Michibiki can start from an existing `VideoSpec` JSON instead of a prompt. This is the recommended bridge from PixVerse Character Pipeline handoff folders.

```bash
pnpm michibiki decide --spec path/to/michibiki/video-spec.json
pnpm michibiki generate --spec path/to/michibiki/video-spec.json --engine editframe
```

When `--spec` is used, relative asset sources are resolved from the `video-spec.json` file location. A PixVerse handoff usually points to an already rendered MP4, so `editframe` is the practical default when the next step is trimming, captions, music, or social repurposing. Use `--engine auto` to let the router score all engines again.

The Remotion adapter runs in `auto` mode by default. If the external Remotion Studio Monorepo is found, Michibiki generates into that monorepo. If it is not found, Michibiki creates a standalone official Remotion project under the job directory instead.

Standalone Remotion output includes a minimal `package.json`, `src/index.ts`, `src/Root.tsx`, and `public/assets/data/video-spec.json`. Preview it with the command printed by `michibiki preview`, or force it with:

```bash
pnpm michibiki generate --engine remotion --remotion-mode standalone --prompt "Create a 15-second promo."
```

For monorepo mode, the adapter looks for the external Remotion Studio Monorepo in this order:

1. `VIDEO_ROUTER_REMOTION_REPO`
2. `engines/remotion-studio-monorepo`
3. `../remotion-studio-monorepo`
4. `~/apps/remotion-studio-monorepo`

Recommended local setup:

```bash
git clone https://github.com/Takamasa045/remotion-studio-monorepo engines/remotion-studio-monorepo
pnpm --dir engines/remotion-studio-monorepo install
```

You can force monorepo mode with `--remotion-mode monorepo` or force standalone mode with `--remotion-mode standalone`.

## CLI

After `pnpm build`:

```bash
pnpm michibiki decide \
  --prompt "AIエージェント勉強会のプロモ動画を30秒で作りたい。縦型、日程、会場、参加枠、CTAを入れて。"
```

The legacy `pnpm video-router` script and `video-router` binary remain available as aliases.

Use `decide` for side-effect-free engine selection before a user has approved generation. It prints the selected engine, a natural-language `selectionGuide`, and `engineFits` scores for Remotion, HyperFrames, and Editframe without creating a job, project, preview, or render. Use `generate` or `create` only after the generation scope is approved.

Every generated job writes `engine-decision.json` with the same selected engine, `selectionGuide`, and `engineFits` data. The percentages are relative across the three engines so users can choose a different path with `--engine` when the creative direction fits better. Each engine fit includes `bestUse` and `featureHighlights`.

Engine behavior, recommendation rules, and agent contracts are documented in:

- [`docs/ENGINE_PROFILES.md`](docs/ENGINE_PROFILES.md) — Remotion / HyperFrames / Editframe strengths, tradeoffs, and best-use patterns
- [`AGENTS.md`](AGENTS.md) — canonical agent rules for natural-language video requests and URL promo requests (Codex / Claude Code / Antigravity shared rules)
- [`CLAUDE.md`](CLAUDE.md) — Claude Code compatibility pointer to `AGENTS.md`
- [`GEMINI.md`](GEMINI.md) — Antigravity / Gemini compatibility pointer to `AGENTS.md`
- [`docs/AGENT_RESPONSE_EXAMPLES.md`](docs/AGENT_RESPONSE_EXAMPLES.md) — agent response samples

### Outputs

Generated artifacts live under `outputs/`. Each deliverable gets its own folder — `outputs/projects/<slug>/{clips,audio,previews,final,assets}` — so a single video's source clips, audio, previews, and final renders stay together instead of scattering across type-named buckets. CLI render jobs (`outputs/jobs/<job-id>/`) and engine defaults (`outputs/<engine>/<project>/`) keep their existing conventions. All of `outputs/` except `outputs/README.md` is git-ignored.

Re-consolidate any scatter with the organizer (dry run by default):

```bash
pnpm organize              # print the move/cleanup plan, change nothing
pnpm organize --apply      # move into outputs/projects/<slug>/ and prune empty dirs
pnpm organize --clean-jobs # also delete regenerable node_modules under outputs/jobs/
```

It never overwrites an existing target, stays within `outputs/`, is idempotent, and records every action to `outputs/.organize-ledger.json`. See [`outputs/README.md`](outputs/README.md) and the Output Layout Rule in [`AGENTS.md`](AGENTS.md).

### Agent Compatibility

`AGENTS.md` is the single source of truth for agent behavior in this repository. **Codex CLI, Codex Cloud, and Antigravity all read `AGENTS.md` natively** with no extra setup. Claude Code reaches the same rules through `CLAUDE.md`, and Antigravity additionally reads `GEMINI.md`. Tool-specific files stay as thin pointers so video-routing rules, approval gates, and engine guidance do not drift.

| Engine | AGENTS.md auto-load | Skill execution | CLI execution | Setup |
|---|---|---|---|---|
| Claude Code | ✅ via `CLAUDE.md` | ✅ full | ✅ | clone only |
| Codex CLI | ✅ native | ❌ | ✅ | clone only |
| Codex Cloud | ✅ native | ❌ | ⚠️ ffmpeg/headless Chrome may be restricted | clone + sandbox check |
| Antigravity | ✅ native + `GEMINI.md` | ❌ | ⚠️ pair with terminal | clone only |

Skill execution refers to Claude Code-specific custom skills (e.g. `mv-production-pipeline`, `remotion-best-practices`). Codex and Antigravity still get the full `AGENTS.md` routing rules and CLI workflow.

Useful commands:

```bash
pnpm michibiki decide --prompt "..."
pnpm michibiki create --prompt "..."
pnpm michibiki preview --job outputs/jobs/<job-id>
pnpm michibiki doctor
pnpm michibiki engines
pnpm michibiki inspect --job outputs/jobs/<job-id>
pnpm michibiki render --job outputs/jobs/<job-id>
```

Recommended pipeline (4 stages, each opt-in):

```bash
pnpm michibiki decide --prompt "..."                                   # 1. inspect engineFits, no side effects
pnpm michibiki generate --prompt "..." [--engine X]                    # 2. project files only
pnpm michibiki preview --job outputs/jobs/<id>                         # 3. validate (headless browser for HyperFrames/Editframe)
pnpm michibiki render --job outputs/jobs/<id> --confirm-render         # 4. final MP4 (gated)
```

`generate` no longer auto-runs preview. Pass `--preview` to opt in. `--render` requires `--confirm-render` to actually run an MP4 — this prevents agents from rendering without explicit user approval.

HyperFrames rendering uses the official CLI by default. Select another backend when needed:

```bash
pnpm michibiki render --job outputs/jobs/<id> --confirm-render --hyperframes-renderer official-producer
pnpm michibiki render --job outputs/jobs/<id> --confirm-render --hyperframes-renderer official-engine
```

Useful HyperFrames render options:

```bash
--hyperframes-quality draft|standard|high
--hyperframes-format mp4|webm|mov
--hyperframes-workers 2
--hyperframes-docker
--hyperframes-gpu
```

`official-engine` attempts the low-level `@hyperframes/engine` capture API first. If the installed package cannot be loaded directly by Node, Michibiki falls back to `@hyperframes/producer`, which is the official complete MP4 pipeline built on top of the engine.

When a HyperFrames prompt asks for HTML-in-Canvas / `drawElementImage` / DOM-to-canvas VFX, Michibiki installs the official registry bundle into the generated project with the workspace-pinned HyperFrames CLI, equivalent to `pnpm --filter @michibiki/engine-hyperframes exec hyperframes add html-in-canvas --dir <generated-project> --no-clipboard --json`. Live Studio preview needs `chrome://flags/#canvas-draw-element`; official HyperFrames rendering enables that flag automatically.

Force a specific engine:

```bash
pnpm michibiki generate --engine hyperframes --prompt "Turn this LP into a 15-second DOM motion video https://example.com"
pnpm michibiki generate --engine editframe --asset ./clip.mp4 --asset ./voice.mp3 --prompt "Create a captioned short from these assets."
```

Generated jobs are written to:

```text
outputs/jobs/<job-id>/
  video-spec.json
  engine-decision.json
  license-result.json
  project/project.json
  preview/preview-result.json
  render/
  logs/
```

## Examples and Release Readiness

Runnable examples are in `examples/`. They cover multiple entry points, not only URLs:

```bash
pnpm michibiki create --duration 3 --prompt "$(cat examples/event-promo/prompt.txt)"
pnpm michibiki generate --duration 1 --render --confirm-render --prompt "$(cat examples/lp-trailer/prompt.txt)"
pnpm michibiki create --duration 3 --prompt "$(cat examples/data-video/brief.json)"
pnpm michibiki generate --duration 1 --asset examples/asset-short/input/clip.mp4 --asset examples/asset-short/input/voice.mp3 --render --confirm-render --prompt "$(cat examples/asset-short/prompt.txt)"
pnpm michibiki create --engine remotion --remotion-mode standalone --duration 3 --prompt "$(cat examples/event-promo/prompt.txt)"
```

The example set includes natural-language prompts, URL/LP inputs, structured JSON briefs, and asset-based timeline inputs. Each path is expected to produce the same decision shape: selected engine, `engineFits`, `selectionGuide`, `bestUse`, and `featureHighlights`.

Use `docs/PUBLISHING.md` for release publishing steps and `docs/ROADMAP.md` for planned work.

## License Notice

This repository's original code is licensed under the MIT License.

This project integrates multiple video generation and rendering engines as external dependencies:

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - subject to Editframe's official terms and pricing

Each third-party engine remains governed by its own license and terms.
Please review and comply with each license before using this project commercially or in a team environment.

## 日本語

Michibiki は、自然言語の動画制作リクエストを `VideoSpec` に変換し、Remotion / HyperFrames / Editframe の中から最適な動画制作エンジンを選択するAI動画制作ルーターです。

名前は日本語の「導き」に由来します。Agent が動画制作リクエストを読み取り、最適なエンジン・ワークフロー・出力形式へ導く存在であることを表しています。

現在は、Remotion のプロジェクト生成・レンダリングに加え、HyperFrames の HTML/CSS/JS 生成と公式 HyperFrames CLI / producer / engine 経由のレンダー、Editframe の `timeline.json` 生成とローカルMP4タイムラインプレビューに対応しています。Remotion は標準で `auto` モードです。外部の Remotion Studio Monorepo があればそれを利用し、無ければジョブディレクトリ内に standalone の公式Remotion最小プロジェクトを生成します。HyperFrames は標準で公式 CLI を使い、必要に応じて公式 producer package、低レベル engine package へ切り替えられます。

### 現在の範囲

Michibiki は現在 CLI-first です。HyperFrames アダプターは HyperFrames 互換の HTML プロジェクトを生成し、`official-cli`（標準）、`official-producer`、または `official-engine` で MP4 化できます。Editframe アダプターはまだローカルの timeline handoff と MP4 プレビューの範囲です。Remotion アダプターは外部の Remotion Studio Monorepo があればそれを呼び出し、無ければジョブディレクトリ内に standalone の公式Remotionプロジェクトを生成します。生成ジョブにはプロンプト、素材パス、レンダー結果が含まれる可能性があり、標準では `outputs/jobs/` 配下として git 管理外にしています。

主な機能:

- 自然言語プロンプトから `VideoSpec` を生成
- Engine Router によるエンジン選択と、3エンジンの `engineFits` 相対評価
- `selectionGuide` / `bestUse` / `featureHighlights` による自然言語の提案
- Remotion auto モードによる Monorepo / standalone 公式プロジェクト生成
- HyperFrames HTML/CSS/JS プロジェクト生成と公式 CLI / producer / engine 経由のMP4レンダー
- Editframe timeline handoff 生成とMP4タイムラインプレビュー
- HyperFrames の従来 local backend と Editframe で使う headless Chrome + ffmpeg レンダー基盤
- `outputs/jobs/<job-id>` への成果物保存
- `docs/ENGINE_PROFILES.md` と `AGENTS.md` による Codex / Claude Code / Antigravity 向けエンジン提案ルール（`CLAUDE.md` と `GEMINI.md` は `AGENTS.md` への薄いポインタ）
- ライセンス注意の表示

### エージェント互換性

このリポジトリでは `AGENTS.md` をエージェント動作ルールの唯一の本文として扱います。Codex は `AGENTS.md` を直接読み、Claude Code は `CLAUDE.md` 経由、Antigravity / Gemini 系は `GEMINI.md` 経由で同じルールを参照します。動画ルーティング、承認ゲート、エンジン説明の drift を避けるため、ツール別ファイルには本文を複製しません。

セットアップ:

Michibiki は GitHub Releases で配布しており npmjs.com には公開していません。リポジトリを clone してから依存をインストールします。

```bash
git clone https://github.com/Takamasa045/michibiki.git
cd michibiki
node scripts/setup.mjs
```

必要環境: Node.js 24.16+、pnpm 11+、ffmpeg（HyperFrames / Editframe の MP4 レンダーに必要）、Chromium / Chrome / Edge（`michibiki doctor` で自動検出）。

依存更新の自動化:

GitHub では `.github/workflows/renovate.yml` により、平日 07:15 JST に Renovate を実行します。`renovate.json` の `video engines` グループで、HyperFrames、Remotion standalone 生成時の runtime 定数、React runtime、Editframe 関連 package をまとめて更新 PR にします。

実行には repository secret `RENOVATE_TOKEN` が必要です。この public repo では classic PAT の `public_repo` と `workflow` scope を付けて登録します。private repo にする場合は `repo` scope を使います。GitHub App installation token を使う場合も、Contents / Pull requests / Issues / Workflows の書き込み権限を与えてください。

Windows:

ZIP を展開したフォルダで PowerShell から実行できます。短い受け渡し手順は `WINDOWS_START_HERE.md` にあります。MP4 の preview/render を使う場合は ffmpeg を `PATH` に入れてください。

```powershell
node scripts/setup.mjs
```

Chrome / Edge は標準インストール先から自動検出します。別の場所に入れている場合は `VIDEO_ROUTER_CHROME` を指定します。

```powershell
$env:VIDEO_ROUTER_CHROME="D:\Apps\Chrome\Application\chrome.exe"
pnpm michibiki doctor
```

基本コマンド:

```bash
pnpm michibiki doctor
pnpm michibiki decide --prompt "AIエージェント勉強会のプロモ動画を30秒で作りたい。"
pnpm michibiki create --prompt "AIエージェント勉強会のプロモ動画を30秒で作りたい。"
pnpm michibiki preview --job outputs/jobs/<job-id>
pnpm michibiki generate --prompt "AIエージェント勉強会のプロモ動画を30秒で作りたい。"
```

既存の `VideoSpec` JSON から始めることもできます。PixVerse Character Pipeline の handoff folder を受け取る場合は、この入口を使います。

```bash
pnpm michibiki decide --spec path/to/michibiki/video-spec.json
pnpm michibiki generate --spec path/to/michibiki/video-spec.json --engine editframe
```

`--spec` で読む場合、相対 asset path は `video-spec.json` の場所を基準に解決されます。PixVerse handoff は完成済み MP4 を指すことが多いため、次工程がカット編集、字幕、BGM、SNS 展開なら `editframe` が実用的な既定です。再度3エンジン比較したい場合は `--engine auto` を指定します。

実行例は `examples/` にあります。自然言語、URL/LP、構成JSON、素材ありの入力タイプを含み、どの入口でも `engineFits`、`selectionGuide`、`bestUse`、`featureHighlights` が出ることを確認できます。
HyperFrames で HTML-in-Canvas / `drawElementImage` / DOM-to-canvas VFX を指定した場合は、ワークスペースで固定された HyperFrames CLI を使い、`pnpm --filter @michibiki/engine-hyperframes exec hyperframes add html-in-canvas --dir <generated-project> --no-clipboard --json` 相当で公式 registry bundle を生成プロジェクトに追加します。Studio の live preview は `chrome://flags/#canvas-draw-element` が必要ですが、公式レンダー時は自動で有効化されます。
公開手順は `docs/PUBLISHING.md`、今後の計画は `docs/ROADMAP.md` を確認してください。

ライセンス:

このリポジトリ内の自作コードは MIT ライセンスで公開しています。

本プロジェクトは、外部依存として以下の動画生成・レンダリングエンジンを利用します。

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - Editframe公式の利用条件・Pricingに従います

各エンジン本体は、それぞれの公式ライセンス・利用条件に従います。
商用利用・チーム利用・SaaS利用を行う場合は、各ツールのライセンス条件をご確認ください。
