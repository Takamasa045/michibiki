# Michibiki

[![CI](https://github.com/Takamasa045/michibiki/actions/workflows/ci.yml/badge.svg)](https://github.com/Takamasa045/michibiki/actions/workflows/ci.yml)

[English](#english) | [日本語](#日本語) | [简体中文](docs/i18n/README.zh-CN.md) | [한국어](docs/i18n/README.ko.md) | [Español](docs/i18n/README.es.md) | [Français](docs/i18n/README.fr.md)

> Translations under `docs/i18n/` are summaries and may lag behind the canonical English/Japanese sections. PRs welcome.

## English

Michibiki is an AI video production router. It turns a natural-language video request into a `VideoSpec`, selects the best video engine, and creates a generated project or render output.

The name comes from the Japanese word "導き" (michibiki), meaning guidance. It reflects the agent's role: guiding each video request toward the most suitable path by choosing the right engine, workflow, and output shape.

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

Michibiki is CLI-first today. It supports:

- **Remotion** — project generation/rendering in `auto` mode: uses an existing Remotion Studio Monorepo when available, then falls back to a standalone official Remotion project when no monorepo is present.
- **HyperFrames** — HTML/CSS/JS project generation rendered through the official CLI by default, with optional official producer or low-level engine backends.
- **Editframe** — timeline handoff project generation with local MP4 timeline previews. It does not bundle or replace the official Editframe SDK.

Generated jobs may contain prompts, asset paths, and rendered files, and are ignored by default under `outputs/projects/`.

## Packages

- `packages/video-spec` — core `VideoSpec`, `SceneSpec`, `AssetSpec`, engine interface, and prompt-to-spec heuristics
- `packages/router` — engine selection rules, relative `engineFits` scoring, `selectionGuide`, and `featureHighlights`
- `packages/compliance` — license guard messages and execution blocking decisions
- `packages/render-jobs` — shared job directory, manifest, and preview-result management
- `packages/browser-renderer` — shared headless Chrome + ffmpeg renderer for browser-preview engines
- `packages/engine-remotion` — adapter for external Remotion Studio Monorepo projects and standalone official Remotion projects
- `packages/engine-hyperframes` — adapter for Web/DOM/CSS/JS motion projects with official HyperFrames CLI / producer / engine rendering
- `packages/engine-editframe` — adapter for timeline/media handoff projects and local MP4 timeline previews
- `apps/cli` — `michibiki` CLI (`video-router` remains available as an alias)

## Setup

Michibiki is distributed through GitHub Releases, not npmjs.com. Clone the repository, install dependencies, and build:

```bash
git clone https://github.com/Takamasa045/michibiki.git
cd michibiki
node scripts/setup.mjs
```

Requirements: Node.js 24.16+, pnpm 11.6+, ffmpeg (for HyperFrames/Editframe MP4 rendering), and Chromium/Chrome/Edge (auto-detected by `michibiki doctor`).

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

Run locally from the repository root. `pnpm michibiki <command>` is how every CLI invocation works in this repo; the legacy `pnpm video-router` script and `video-router` binary remain available as aliases.

```bash
pnpm michibiki doctor
pnpm michibiki decide --prompt "Create a 15-second vertical event promo video."
```

The recommended workflow has four opt-in stages, so nothing renders or generates without explicit approval:

```bash
pnpm michibiki decide   --prompt "..."                            # 1. inspect engineFits, no side effects
pnpm michibiki generate --prompt "..." [--engine X]               # 2. project files only
pnpm michibiki preview  --job outputs/projects/<slug>                   # 3. validate (headless browser for HyperFrames/Editframe)
pnpm michibiki render   --job outputs/projects/<slug> --confirm-render  # 4. final MP4 (gated)
```

`generate` no longer auto-runs preview (`--preview` opts in), and `--render` requires `--confirm-render` to actually produce an MP4 — this prevents agents from rendering without explicit user approval.

The Remotion adapter runs in `auto` mode by default: it uses an external Remotion Studio Monorepo if found, otherwise creates a standalone official Remotion project under the job directory. Force a path with `--remotion-mode monorepo|standalone`.

**Full command reference, HyperFrames render backends/options, Remotion mode resolution, and runnable examples are in [`docs/CLI.md`](docs/CLI.md).**

## Outputs

Generated artifacts live under `outputs/projects/<slug>/`. Each deliverable gets its own folder named after the request title, so everything for one video stays together instead of scattering across an opaque `jobs/<id>` bucket. CLI runs derive `<slug>` from the title and never overwrite an existing folder (a collision appends `-2`, `-3`, …); a CLI deliverable holds its machine substructure (`video-spec.json`, `engine-decision.json`, `project/`, `render/`, `preview/`, `logs/`), while hand-assembled deliverables use the human-curated buckets (`clips/`, `audio/`, `previews/`, `final/`, `assets/`) in the same per-project folder. Engine defaults (`outputs/<engine>/<project>/`) are used only for direct, non-CLI engine usage. All of `outputs/` except `outputs/README.md` is git-ignored.

Re-consolidate any scatter with the organizer (dry run by default):

```bash
pnpm organize              # print the move/cleanup plan, change nothing
pnpm organize --apply      # move into outputs/projects/<slug>/ and prune empty dirs
pnpm organize --clean-jobs # also delete regenerable node_modules under outputs/jobs/ and outputs/projects/
```

It never overwrites an existing target, stays within `outputs/`, is idempotent, and records every action to `outputs/.organize-ledger.json`. See [`outputs/README.md`](outputs/README.md) and the Output Layout Rule in [`AGENTS.md`](AGENTS.md).

## Agent Compatibility

`AGENTS.md` is the single source of truth for agent behavior in this repository. **Codex CLI, Codex Cloud, and Antigravity all read `AGENTS.md` natively** with no extra setup. Claude Code reaches the same rules through `CLAUDE.md`, and Antigravity additionally reads `GEMINI.md`. Tool-specific files stay as thin pointers so video-routing rules, approval gates, and engine guidance do not drift.

| Engine | AGENTS.md auto-load | Skill execution | CLI execution | Setup |
|---|---|---|---|---|
| Claude Code | ✅ via `CLAUDE.md` | ✅ full | ✅ | clone only |
| Codex CLI | ✅ native | ❌ | ✅ | clone only |
| Codex Cloud | ✅ native | ❌ | ⚠️ ffmpeg/headless Chrome may be restricted | clone + sandbox check |
| Antigravity | ✅ native + `GEMINI.md` | ❌ | ⚠️ pair with terminal | clone only |

Skill execution refers to Claude Code-specific custom skills (e.g. `mv-production-pipeline`, `remotion-best-practices`). Codex and Antigravity still get the full `AGENTS.md` routing rules and CLI workflow.

Engine behavior, recommendation rules, and agent contracts are documented in:

- [`docs/CLI.md`](docs/CLI.md) — full CLI reference, pipeline, HyperFrames options, and examples
- [`docs/ENGINE_PROFILES.md`](docs/ENGINE_PROFILES.md) — Remotion / HyperFrames / Editframe strengths, tradeoffs, and best-use patterns
- [`AGENTS.md`](AGENTS.md) — canonical agent rules for natural-language video requests and URL promo requests (Codex / Claude Code / Antigravity shared rules)
- [`CLAUDE.md`](CLAUDE.md) — Claude Code compatibility pointer to `AGENTS.md`
- [`GEMINI.md`](GEMINI.md) — Antigravity / Gemini compatibility pointer to `AGENTS.md`
- [`docs/AGENT_RESPONSE_EXAMPLES.md`](docs/AGENT_RESPONSE_EXAMPLES.md) — agent response samples

## Dependency Automation

GitHub runs Renovate from `.github/workflows/renovate.yml` on weekdays at 07:15 JST, with `renovate.json` limiting updates to before 9am JST. The `video engines` Renovate group keeps HyperFrames, Remotion standalone project runtime constants, React runtime packages, and Editframe packages updated together.

Before the scheduled workflow can open pull requests, add a repository secret named `RENOVATE_TOKEN` (a classic PAT with `public_repo` + `workflow` scope for this public repository, or `repo` if it becomes private; a GitHub App installation token with equivalent permissions also works). Run the `Renovate` workflow manually once after setting the secret to confirm it can create/update dependency PRs.

## Release Readiness

Use `docs/PUBLISHING.md` for release publishing steps and `docs/ROADMAP.md` for planned work.

## License Notice

This repository's original code is licensed under the MIT License.

This project integrates multiple video generation and rendering engines as external dependencies:

- HyperFrames — Apache-2.0
- Remotion — Remotion License
- Editframe — subject to Editframe's official terms and pricing

Each third-party engine remains governed by its own license and terms.
Please review and comply with each license before using this project commercially or in a team environment.

## 日本語

Michibiki は、自然言語の動画制作リクエストを `VideoSpec` に変換し、Remotion / HyperFrames / Editframe の中から最適な動画制作エンジンを選択するAI動画制作ルーターです。

名前は日本語の「導き」に由来します。Agent が動画制作リクエストを読み取り、最適なエンジン・ワークフロー・出力形式へ導く存在であることを表しています。

```text
ユーザープロンプト / CLI / Studio UI
  ↓
VideoSpec
  ↓
Engine Router
  ├── HyperFrames Engine Adapter
  ├── Remotion Engine Adapter
  └── Editframe Engine Adapter
  ↓
生成プロジェクト / プレビュー / レンダー
```

Michibiki は現在 CLI-first です。対応状況:

- **Remotion** — `auto` モードでのプロジェクト生成・レンダリング。外部の Remotion Studio Monorepo があればそれを利用し、無ければジョブディレクトリ内に standalone の公式Remotion最小プロジェクトを生成します。
- **HyperFrames** — HTML/CSS/JS プロジェクトを生成し、標準で公式 CLI、必要に応じて公式 producer package・低レベル engine package でMP4化します。
- **Editframe** — `timeline.json` 生成とローカルMP4タイムラインプレビュー。公式 Editframe SDK を同梱・代替するものではありません。

生成ジョブにはプロンプト、素材パス、レンダー結果が含まれる可能性があり、標準では `outputs/projects/` 配下として git 管理外にしています。

### 主な機能

- 自然言語プロンプトから `VideoSpec` を生成
- Engine Router によるエンジン選択と、3エンジンの `engineFits` 相対評価
- `selectionGuide` / `bestUse` / `featureHighlights` による自然言語の提案
- Remotion auto モードによる Monorepo / standalone 公式プロジェクト生成
- HyperFrames HTML/CSS/JS プロジェクト生成と公式 CLI / producer / engine 経由のMP4レンダー
- Editframe timeline handoff 生成とMP4タイムラインプレビュー
- HyperFrames の従来 local backend と Editframe で使う headless Chrome + ffmpeg レンダー基盤
- `outputs/projects/<slug>` への成果物保存とライセンス注意の表示

### セットアップ

Michibiki は GitHub Releases で配布しており npmjs.com には公開していません。リポジトリを clone してから依存をインストールします。

```bash
git clone https://github.com/Takamasa045/michibiki.git
cd michibiki
node scripts/setup.mjs
```

必要環境: Node.js 24.16+、pnpm 11.6+、ffmpeg（HyperFrames / Editframe の MP4 レンダーに必要）、Chromium / Chrome / Edge（`michibiki doctor` で自動検出）。

#### Windows

ZIP を展開したフォルダで PowerShell から実行できます。短い受け渡し手順は `WINDOWS_START_HERE.md` にあります。MP4 の preview/render を使う場合は ffmpeg を `PATH` に入れてください。Chrome / Edge は標準インストール先から自動検出します。別の場所に入れている場合は `VIDEO_ROUTER_CHROME` を指定します。

```powershell
node scripts/setup.mjs
$env:VIDEO_ROUTER_CHROME="D:\Apps\Chrome\Application\chrome.exe"
pnpm michibiki doctor
```

### クイックスタート

リポジトリのルートから実行します。`pnpm michibiki <command>` がこのリポジトリでの基本的な呼び出し方です。旧来の `pnpm video-router` スクリプトと `video-router` バイナリもエイリアスとして利用できます。

```bash
pnpm michibiki doctor
pnpm michibiki decide --prompt "AIエージェント勉強会のプロモ動画を30秒で作りたい。"
```

推奨ワークフローは 4 段階で、それぞれ opt-in です。承認なしに生成・レンダーが走らないようになっています。

```bash
pnpm michibiki decide   --prompt "..."                            # 1. engineFits を確認（副作用なし）
pnpm michibiki generate --prompt "..." [--engine X]               # 2. プロジェクトファイルのみ生成
pnpm michibiki preview  --job outputs/projects/<slug>                   # 3. 検証（HyperFrames/Editframe は headless ブラウザ）
pnpm michibiki render   --job outputs/projects/<slug> --confirm-render  # 4. 最終MP4（ゲートあり）
```

`generate` はプレビューを自動実行しません（`--preview` で opt-in）。`--render` で実際にMP4を出力するには `--confirm-render` が必須です。これにより、エージェントがユーザー承認なしにレンダーすることを防ぎます。

Remotion アダプターは標準で `auto` モードです。外部の Remotion Studio Monorepo があればそれを利用し、無ければジョブディレクトリ内に standalone の公式Remotionプロジェクトを生成します。`--remotion-mode monorepo|standalone` で固定できます。

**全コマンドリファレンス、HyperFrames のレンダーバックエンド/オプション、Remotion のモード解決、実行例は [`docs/CLI.md`](docs/CLI.md) にまとめています。**

### 出力（Outputs）

成果物は `outputs/projects/<slug>/` 配下に保存されます。1本の動画ごとにリクエストのタイトル由来の専用フォルダを持ち、不透明な `jobs/<id>` バケットに散らばらずまとまります。CLI 実行時は `<slug>` をタイトルから生成し、既存フォルダを上書きしません（衝突時は `-2`, `-3`, … を付与）。CLI 成果物は機械向けの内部構造（`video-spec.json`, `engine-decision.json`, `project/`, `render/`, `preview/`, `logs/`）を持ち、手組みの成果物は同じプロジェクトフォルダ内で人間向けバケット（`clips/`, `audio/`, `previews/`, `final/`, `assets/`）を使います。エンジン既定（`outputs/<engine>/<project>/`）は CLI を介さない単体利用時のみ使われます。`outputs/README.md` 以外の `outputs/` は git 管理外です。

散らばった成果物は organizer で再集約できます（標準は dry run）。

```bash
pnpm organize              # 移動/整理プランを表示するだけ（変更しない）
pnpm organize --apply      # outputs/projects/<slug>/ へ移動し空ディレクトリを整理
pnpm organize --clean-jobs # outputs/jobs と outputs/projects 配下の再生成可能な node_modules も削除
```

既存ファイルを上書きせず、`outputs/` の外には出ず、冪等で、すべての操作を `outputs/.organize-ledger.json` に記録します。詳細は [`outputs/README.md`](outputs/README.md) と [`AGENTS.md`](AGENTS.md) の Output Layout Rule を参照してください。

### エージェント互換性

このリポジトリでは `AGENTS.md` をエージェント動作ルールの唯一の本文として扱います。Codex は `AGENTS.md` を直接読み、Claude Code は `CLAUDE.md` 経由、Antigravity / Gemini 系は `GEMINI.md` 経由で同じルールを参照します。動画ルーティング、承認ゲート、エンジン説明の drift を避けるため、ツール別ファイルには本文を複製しません。

### 依存更新の自動化

GitHub では `.github/workflows/renovate.yml` により、平日 07:15 JST に Renovate を実行します。`renovate.json` の `video engines` グループで、HyperFrames、Remotion standalone 生成時の runtime 定数、React runtime、Editframe 関連 package をまとめて更新 PR にします。

実行には repository secret `RENOVATE_TOKEN` が必要です。この public repo では classic PAT に `public_repo` と `workflow` scope を付けて登録します（private 化する場合は `repo` scope）。GitHub App installation token を使う場合も、Contents / Pull requests / Issues / Workflows の書き込み権限を与えてください。設定後に `Renovate` workflow を一度手動実行し、PR を作成/更新できることを確認してください。

### ドキュメント

- [`docs/CLI.md`](docs/CLI.md) — 全コマンドリファレンス・パイプライン・HyperFrames オプション・実行例
- [`docs/ENGINE_PROFILES.md`](docs/ENGINE_PROFILES.md) — Remotion / HyperFrames / Editframe の特徴と使い分け
- [`AGENTS.md`](AGENTS.md) — エージェント向けカノニカルなルール
- [`docs/AGENT_RESPONSE_EXAMPLES.md`](docs/AGENT_RESPONSE_EXAMPLES.md) — 返答サンプル
- 公開手順は [`docs/PUBLISHING.md`](docs/PUBLISHING.md)、今後の計画は [`docs/ROADMAP.md`](docs/ROADMAP.md)

### ライセンス

このリポジトリ内の自作コードは MIT ライセンスで公開しています。

本プロジェクトは、外部依存として以下の動画生成・レンダリングエンジンを利用します。

- HyperFrames — Apache-2.0
- Remotion — Remotion License
- Editframe — Editframe公式の利用条件・Pricingに従います

各エンジン本体は、それぞれの公式ライセンス・利用条件に従います。
商用利用・チーム利用・SaaS利用を行う場合は、各ツールのライセンス条件をご確認ください。
