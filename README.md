# Video Router Agent

[English](#english) | [日本語](#日本語) | [简体中文](#简体中文) | [한국어](#한국어) | [Español](#español) | [Français](#français)

## English

Video Router Agent is an AI video production router. It turns a natural-language video request into a `VideoSpec`, selects the best video engine, and creates a generated project or render output.

Current MVP execution supports Remotion project generation/rendering, HyperFrames HTML/CSS/JS project generation with local MP4 rendering, and Editframe timeline handoff project generation with local MP4 timeline previews. Remotion uses the existing Remotion Studio Monorepo; HyperFrames renders through headless Chrome plus ffmpeg; Editframe renders timeline previews through the same local browser/ffmpeg path.

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

### MVP Scope

This is a CLI-first MVP. The HyperFrames and Editframe adapters generate local draft projects and MP4 previews; they do not bundle or replace the official HyperFrames/Editframe SDKs. The Remotion adapter calls an external Remotion Studio Monorepo checkout. Generated jobs may contain prompts, asset paths, and rendered files, and are ignored by default under `outputs/jobs/`.

## MVP Packages

- `packages/video-spec` - core `VideoSpec`, `SceneSpec`, `AssetSpec`, engine interface, and prompt-to-spec heuristics
- `packages/router` - engine selection rules
- `packages/compliance` - license guard messages and execution blocking decisions
- `packages/render-jobs` - shared job directory, manifest, and preview-result management
- `packages/browser-renderer` - shared headless Chrome + ffmpeg renderer for browser-preview engines
- `packages/engine-remotion` - adapter for the existing Remotion Studio Monorepo
- `packages/engine-hyperframes` - adapter for Web/DOM/CSS/JS motion projects and local MP4 rendering
- `packages/engine-editframe` - adapter for timeline/media handoff projects and local MP4 timeline previews
- `apps/cli` - `video-router` CLI

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

The Remotion adapter looks for the external Remotion Studio Monorepo in this order:

1. `VIDEO_ROUTER_REMOTION_REPO`
2. `engines/remotion-studio-monorepo`
3. `../remotion-studio-monorepo`
4. `~/apps/remotion-studio-monorepo`

Recommended local setup:

```bash
git clone https://github.com/Takamasa045/remotion-studio-monorepo engines/remotion-studio-monorepo
pnpm --dir engines/remotion-studio-monorepo install
```

## CLI

After `pnpm build`:

```bash
pnpm video-router generate \
  --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。縦型、焚き火、星空、AIエージェント感を入れて。"
```

Useful commands:

```bash
pnpm video-router create --prompt "..."
pnpm video-router preview --job outputs/jobs/<job-id>
pnpm video-router doctor
pnpm video-router engines
pnpm video-router inspect --job outputs/jobs/<job-id>
pnpm video-router render --job outputs/jobs/<job-id>
```

Render during generation:

```bash
pnpm video-router generate --prompt "..." --render
```

Force a specific engine:

```bash
pnpm video-router generate --engine hyperframes --prompt "Turn this LP into a 15-second DOM motion video https://example.com"
pnpm video-router generate --engine editframe --asset ./clip.mp4 --asset ./voice.mp3 --prompt "Create a captioned short from these assets."
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

## Examples and MVP Gate

Runnable MVP examples are in `examples/`.

```bash
pnpm video-router generate --engine hyperframes --duration 1 --render --prompt "$(cat examples/lp-trailer/prompt.txt)"
pnpm video-router generate --engine editframe --duration 1 --asset examples/asset-short/input/clip.mp4 --asset examples/asset-short/input/voice.mp3 --render --prompt "$(cat examples/asset-short/prompt.txt)"
pnpm video-router create --engine remotion --duration 3 --dry-run --prompt "$(cat examples/event-promo/prompt.txt)"
```

Use `docs/MVP_CHECKLIST.md` as the release gate for the CLI-first MVP.

## License Notice

This repository's original code is licensed under the MIT License.

This project integrates multiple video generation and rendering engines as external dependencies:

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - subject to Editframe's official terms and pricing

Each third-party engine remains governed by its own license and terms.
Please review and comply with each license before using this project commercially or in a team environment.

## 日本語

Video Router Agent は、自然言語の動画制作リクエストを `VideoSpec` に変換し、Remotion / HyperFrames / Editframe の中から最適な動画制作エンジンを選択するAI動画制作ルーターです。

現在のMVPでは、Remotionのプロジェクト生成・レンダリングに加え、HyperFrames の HTML/CSS/JS 生成とローカルMP4レンダー、Editframe の `timeline.json` 生成とローカルMP4タイムラインプレビューに対応しています。Remotion は既存の Remotion Studio Monorepo を利用し、HyperFrames/Editframe は headless Chrome と ffmpeg でMP4化します。

### MVP の範囲

これは CLI-first の MVP です。HyperFrames / Editframe アダプターはローカルのドラフトプロジェクトと MP4 プレビューを生成しますが、公式 SDK の同梱や代替実装ではありません。Remotion アダプターは外部の Remotion Studio Monorepo を呼び出します。生成ジョブにはプロンプト、素材パス、レンダー結果が含まれる可能性があり、標準では `outputs/jobs/` 配下として git 管理外にしています。

主な機能:

- 自然言語プロンプトから `VideoSpec` を生成
- Engine Router によるエンジン選択
- Remotion Studio Monorepo へのプロジェクト生成
- HyperFrames HTML/CSS/JS プロジェクト生成とMP4レンダー
- Editframe timeline handoff 生成とMP4タイムラインプレビュー
- HyperFrames/Editframe 共通の headless Chrome + ffmpeg レンダー基盤
- `outputs/jobs/<job-id>` への成果物保存
- ライセンス注意の表示

基本コマンド:

```bash
pnpm install
pnpm build
pnpm test
pnpm video-router create --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。"
pnpm video-router doctor
pnpm video-router preview --job outputs/jobs/<job-id>
pnpm video-router generate --prompt "雪山のアウトドアイベント告知動画を30秒で作りたい。"
```

MVP用の実行例は `examples/` にあります。
CLI-first MVP の公開前チェックは `docs/MVP_CHECKLIST.md` を確認してください。

ライセンス:

このリポジトリ内の自作コードは MIT ライセンスで公開しています。

本プロジェクトは、外部依存として以下の動画生成・レンダリングエンジンを利用します。

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - Editframe公式の利用条件・Pricingに従います

各エンジン本体は、それぞれの公式ライセンス・利用条件に従います。
商用利用・チーム利用・SaaS利用を行う場合は、各ツールのライセンス条件をご確認ください。

## 简体中文

Video Router Agent 是一个 AI 视频制作路由器。它会把自然语言视频需求转换为 `VideoSpec`，然后在 Remotion / HyperFrames / Editframe 中选择最合适的视频生成或编辑引擎。

当前 MVP 支持 Remotion 项目生成和渲染，也支持 HyperFrames 的 HTML/CSS/JS 生成与本地 MP4 渲染，以及 Editframe 的 `timeline.json` 生成与本地 MP4 时间线预览。Remotion 使用现有的 Remotion Studio Monorepo；HyperFrames/Editframe 通过 headless Chrome 和 ffmpeg 渲染。

主要功能:

- 从自然语言提示生成 `VideoSpec`
- 自动选择视频引擎
- 调用 Remotion Studio Monorepo 生成项目
- 生成 HyperFrames HTML/CSS/JS 项目并渲染 MP4
- 生成 Editframe timeline handoff 并渲染 MP4 时间线预览
- 将结果保存到 `outputs/jobs/<job-id>`
- 显示第三方引擎的许可证提醒

基本命令:

```bash
pnpm install
pnpm build
pnpm test
pnpm video-router create --prompt "Create a 30-second vertical event promo video."
pnpm video-router doctor
pnpm video-router preview --job outputs/jobs/<job-id>
pnpm video-router generate --prompt "Create a 30-second vertical event promo video."
```

许可证说明:

本仓库的原创代码使用 MIT License。第三方引擎仍受各自许可证和官方条款约束。

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - Editframe 官方条款和价格政策

商业、团队或 SaaS 使用前，请确认各工具的官方许可条件。

## 한국어

Video Router Agent는 자연어 영상 제작 요청을 `VideoSpec`으로 변환하고, Remotion / HyperFrames / Editframe 중 가장 적합한 영상 제작 엔진을 선택하는 AI 영상 제작 라우터입니다.

현재 MVP는 Remotion 프로젝트 생성/렌더링, HyperFrames HTML/CSS/JS 생성과 로컬 MP4 렌더링, Editframe `timeline.json` 생성과 로컬 MP4 타임라인 프리뷰를 지원합니다. Remotion은 기존 Remotion Studio Monorepo를 사용하고, HyperFrames/Editframe은 headless Chrome과 ffmpeg로 렌더링합니다.

주요 기능:

- 자연어 프롬프트에서 `VideoSpec` 생성
- Engine Router를 통한 엔진 선택
- Remotion Studio Monorepo 프로젝트 생성
- HyperFrames HTML/CSS/JS 프로젝트 생성 및 MP4 렌더링
- Editframe timeline handoff 생성 및 MP4 타임라인 프리뷰 렌더링
- `outputs/jobs/<job-id>`에 결과 저장
- 외부 엔진 라이선스 안내 표시

기본 명령:

```bash
pnpm install
pnpm build
pnpm test
pnpm video-router create --prompt "Create a 30-second vertical event promo video."
pnpm video-router doctor
pnpm video-router preview --job outputs/jobs/<job-id>
pnpm video-router generate --prompt "Create a 30-second vertical event promo video."
```

라이선스 안내:

이 저장소의 자체 작성 코드는 MIT License로 제공됩니다. 외부 엔진은 각각의 공식 라이선스와 이용 약관을 따릅니다.

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - Editframe 공식 약관 및 가격 정책

상업적 사용, 팀 사용, SaaS 사용 전에는 각 도구의 공식 라이선스 조건을 확인하세요.

## Español

Video Router Agent es un enrutador de producción de video con IA. Convierte una solicitud en lenguaje natural en un `VideoSpec`, selecciona el motor de video más adecuado y crea un proyecto generado o una salida de render.

El MVP actual admite generación y renderizado con Remotion, generación HTML/CSS/JS y renderizado MP4 local para HyperFrames, y generación `timeline.json` con previsualización MP4 local para Editframe. Remotion usa el Remotion Studio Monorepo existente; HyperFrames/Editframe renderizan con headless Chrome y ffmpeg.

Funciones principales:

- Generar `VideoSpec` desde un prompt en lenguaje natural
- Seleccionar automáticamente el motor de video
- Crear proyectos mediante Remotion Studio Monorepo
- Generar proyectos HTML/CSS/JS para HyperFrames y renderizar MP4
- Generar handoffs `timeline.json` para Editframe y renderizar previsualizaciones MP4
- Guardar resultados en `outputs/jobs/<job-id>`
- Mostrar avisos de licencia para motores externos

Comandos básicos:

```bash
pnpm install
pnpm build
pnpm test
pnpm video-router create --prompt "Create a 30-second vertical event promo video."
pnpm video-router doctor
pnpm video-router preview --job outputs/jobs/<job-id>
pnpm video-router generate --prompt "Create a 30-second vertical event promo video."
```

Licencia:

El código original de este repositorio está publicado bajo MIT License. Cada motor externo se rige por su propia licencia y sus términos oficiales.

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - términos y precios oficiales de Editframe

Antes de usarlo con fines comerciales, en equipo o como SaaS, revisa las condiciones oficiales de cada herramienta.

## Français

Video Router Agent est un routeur de production vidéo basé sur l'IA. Il transforme une demande en langage naturel en `VideoSpec`, choisit le moteur vidéo le plus adapté, puis crée un projet généré ou une sortie de rendu.

Le MVP actuel prend en charge la génération et le rendu Remotion, la génération HTML/CSS/JS et le rendu MP4 local pour HyperFrames, ainsi que la génération `timeline.json` avec aperçu MP4 local pour Editframe. Remotion utilise le Remotion Studio Monorepo existant; HyperFrames/Editframe rendent via headless Chrome et ffmpeg.

Fonctionnalités principales:

- Générer un `VideoSpec` à partir d'un prompt en langage naturel
- Sélectionner automatiquement le moteur vidéo
- Créer des projets via Remotion Studio Monorepo
- Générer des projets HTML/CSS/JS pour HyperFrames et rendre en MP4
- Générer des handoffs `timeline.json` pour Editframe et rendre des aperçus MP4
- Enregistrer les résultats dans `outputs/jobs/<job-id>`
- Afficher les avertissements de licence pour les moteurs externes

Commandes de base:

```bash
pnpm install
pnpm build
pnpm test
pnpm video-router create --prompt "Create a 30-second vertical event promo video."
pnpm video-router doctor
pnpm video-router preview --job outputs/jobs/<job-id>
pnpm video-router generate --prompt "Create a 30-second vertical event promo video."
```

Licence:

Le code original de ce dépôt est publié sous MIT License. Chaque moteur externe reste soumis à sa propre licence et à ses conditions officielles.

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - conditions et tarifs officiels d'Editframe

Avant une utilisation commerciale, en équipe ou en SaaS, vérifiez les conditions officielles de chaque outil.
