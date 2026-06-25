# AGENTS.md - Michibiki Agent Rules

このリポジトリで Claude Code / Codex / Antigravity などのエージェントが作業する際のカノニカルなルールです。**Codex CLI / Codex Cloud / Antigravity はこのファイルを直接読み込みます**。Claude Code は `CLAUDE.md`、Antigravity は補助的に `GEMINI.md` も読みますが、いずれも本ファイルへのポインタです。上位のシステム・開発者・ユーザー指示を優先します。

各エンジンの特徴・適用範囲・公式ドキュメント参照は [`docs/ENGINE_PROFILES.md`](docs/ENGINE_PROFILES.md) を参照してください。返答サンプルは [`docs/AGENT_RESPONSE_EXAMPLES.md`](docs/AGENT_RESPONSE_EXAMPLES.md) にあります。

## Agent Entry Points

- `AGENTS.md` が canonical です。Video Request Routing Rule、承認境界、Skill 利用ルールはここだけを更新します。
- `CLAUDE.md` は Claude Code 互換の薄いポインタです。ルール本文は重複させません。
- `GEMINI.md` は Antigravity / Gemini 系互換の薄いポインタです。ルール本文は重複させません。
- Codex CLI / Codex Cloud は `AGENTS.md` をネイティブに参照するため、追加のポインタファイルは作成しません。
- Antigravity の workspace rules ディレクトリを使う場合も、追加するのは `AGENTS.md` への参照だけにし、Michibiki 固有ルールを複製しないでください。
- Skill 機能は Claude Code でのみ動作します。Codex / Antigravity では Skill 利用ルールは適用対象外で、`AGENTS.md` のルーティングと CLI 実行のみがカノニカルです。

## Repository Setup Requests

ユーザーが「セットアップして」「使えるようにして」「pnpm install して」など、このリポジトリの初回セットアップを依頼した場合は、通常の動画生成フローへ進む前に次を実行してください。

1. Node.js が入っているか確認する: `node --version`
2. Node.js 24.18 未満、または Node.js が無い場合は、Node.js 24.18 以上が必要だと伝えて止まる。
3. 依存が未導入でも動く初期化コマンドとして `node scripts/setup.mjs` を実行する。
4. `pnpm michibiki doctor` の結果を要約し、ffmpeg / Chrome / Edge が WARN の場合は不足しているものを短く案内する。

Windows では PowerShell 前提で案内し、必要なら `WINDOWS_START_HERE.md` を参照してください。Chrome / Edge が標準パス以外にある場合は、`VIDEO_ROUTER_CHROME` の指定例を出します。

## Video Request Routing Rule

ユーザーが自然言語で「このページのプロモ動画を作りたい」「〇〇な動画を作りたい」「URLから動画にしたい」と依頼した場合、ページ内容の要約だけで止めないでください。必ず Michibiki のエンジン比較を提示します。

標準フロー:

1. ユーザーのプロンプト本文・URL・素材種別・既存動画ファイル参照を最初に確認する。プロンプト全体を読み、何が「主たる仕事」（編集 / Web/LP表現 / コード駆動演出 / 量産）かを判断する。
2. 既存MP4や動画素材があると判断した場合は、実際の `.mp4` / `.webm` / `<video>` / `og:video` 参照、またはユーザー提供のローカルファイルを根拠として示す。見出しやテキストだけで「既存MP4がある」と断定しない。
3. 比較・提案だけが目的の場合は `michibiki decide --engine auto --prompt "<user request>"`、または同等の副作用なし `selectEngine()` 判定を使い、`engineFits` / `selectionGuide` / `switchHints` / selected engine / selected proposal 相当の項目を確認する。
4. Remotion / HyperFrames / Editframe の3つを、相対評価パーセンテージ付きで提示する。`Recommended engine` は3エンジン中で最も `fitPercent` が高いエンジン（同点時は remotion → hyperframes → editframe の順で固定）。素材の有無だけで自動的に Editframe にしない。
5. 各エンジンについて「この動画ならどう活かせるか」を1文で説明する（具体機能の根拠は `docs/ENGINE_PROFILES.md` を参照）。
6. `switchHints` の各候補（推奨以外の2エンジン）について、「どんな条件が増えれば／変われば、そのエンジンが推奨になるか」をユーザーに示す。例: 「LP感を強めたいなら HyperFrames が伸びる」「ナレーションと字幕同期を入れるなら Editframe が伸びる」。
7. 自動推奨エンジンを示したうえで、ユーザーが `--engine remotion` / `--engine hyperframes` / `--engine editframe` を選べるようにする。
8. ユーザーがエンジン選択を明示していない場合、比較提示のあとに「この方針で生成に進めるか」を確認する。「プロモを作って」「動画にして」は、原則としてエンジン比較と制作方針提案までに留める。

返答に必ず含める内容:

- `Recommended engine`
- `engineFits` の3エンジン分の相対評価
- 各エンジンの `bestUse`
- 各エンジンの `featureHighlights`
- `switchHints` の各候補（条件 + そのエンジンに切り替えると何が良くなるか）
- 既存動画素材の有無と、その判断根拠

選定ロジックの扱い:

- `engineFits` は3エンジン間の相対評価で、`Recommended engine` は最大スコアのエンジン（同点時は remotion → hyperframes → editframe）。`selectAutoEngine` がスコアを参照するので、素材添付や特定キーワードだけで if/else 確定はしない。
- `selectionGuide` の `Recommended engine`、または `engine-decision.json` の selected engine / selected proposal 相当の項目がある場合は、それを最終推奨として使う。
- 尺、アスペクト、BGM/SFX、ナレーション、字幕同期、ハイテンポ編集など制作条件が追加・変更された場合は、前回の判定を流用せず再度 `selectEngine()` 相当を実行する。
- `switchHints` は推奨以外の2エンジンに対し、「どの条件が加わればそちらが伸びるか」を返す。提案文ではこれをそのまま読み替えてユーザーに示す。
- `selectionGuide` に `Close call` 注記が含まれている場合（top と 2nd の差が 8% 以下）は、ユーザーに「微差なので switchHints を読んで方向性を確認してほしい」と必ず伝える。
- ルーターは以下の signals を見ている: 実アセット種別（video/audio/image/url）、URL の参照文脈（参照/詳細はこちら系）、timeline editing（ナレーション/BGM/字幕/編集/スライドショー）、web/DOM（LP/ページ/GSAP/スクロール）、HTML-in-canvas（DOMをcanvas化してblur/glitch/shader/WebGL/WebGPU風にポスト処理）、avatar/talking-head、data-driven/template、data viz（ダッシュボード/KPI/チャート）、explainer/tutorial、lyric/MV、coded motion design（kinetic typo/spring/easing/motion graphics/three.js）、cloud batch render（lambda/バッチ）、webinar recap、format（縦型短尺/長尺）、capability catalog（Remotion の `<HtmlInCanvas>` / `@remotion/transitions` / `@remotion/web-renderer`、HyperFrames の capture / registry add / snapshot / inspect、Editframe の `ef-timegroup` / `ef-waveform` / `ef-captions` / `@editframe/*` / Render API など）。プロンプト本文を最初に丁寧に読む前提で動く。
- 否定文（〜なし/〜無い/〜じゃない/〜ではない/〜は作らない）とメタ参照（〜について/〜の話/〜を取り上げる）は near-context（前後 16 文字）で検出し、該当 keyword を無効化する。「LPは作らないが、企業ロゴアニメ」のような prompt は LP signal が消えて Remotion が選ばれる。
- ルーターが見るテキストは `spec.goal`（ユーザー入力の生プロンプト）と user-provided CTA のみ。`spec.title` / `content.script` / `content.captions` / `content.scenes` は from-prompt.ts が自動推論したもので、否定文脈を失った keyword を再注入する可能性があるので signal 抽出には使わない。
- `clarifyingQuestions` は top vs 2nd の差が 8% 以下の時に生成される。提案文ではこれをユーザーへの質問としてそのまま提示し、回答（A/B または `--engine`）を待つ。
- `michibiki generate` / `michibiki create` は `clarifyingQuestions` が空でない状態で `--engine` も `--resolve-ambiguity` も指定されていない場合、生成を拒否して exit code 2 で停止する（曖昧性ゲート）。エージェントは generate を呼ぶ前に `decide` で曖昧性を確認し、ユーザーに `(A)/(B)` を聞く・もしくは `--engine` を指定する手順を踏む。

生成品質の扱い:

- エンジン選定と映像コピー設計は別工程として扱い、長いプロンプトやページ本文をそのまま表示テキストへ流し込まない。
- `generate` の出力は、制作条件と視聴者向けコピーを分離し、Hook / Detail / CTA などの短い `script` / `captions` / `scenes[].text` に再構成してから各エンジンへ渡す。

生成・レンダー実行の承認境界:

ルーターは 4 段階で動く。各ステージは独立で、エージェントは必ず順番に進める:

1. `michibiki decide --prompt "..."` — 副作用なし。エンジン比較と方針提案のみ。
2. `michibiki generate --prompt "..." [--engine X]` — プロジェクトファイル生成のみ。preview/render は走らせない。
3. `michibiki preview --job outputs/projects/<slug>` — preview 起動（HyperFrames/Editframe では headless Chrome + ffmpeg のフレームキャプチャが走る、副作用あり）。
4. `michibiki render --job outputs/projects/<slug> --confirm-render` — 最終 MP4 レンダー。`--confirm-render` 無しでは実行されず exit code 2 で停止する。

ルール:

- エンジン比較や制作方針提案のために `generate` / `create` / `render` / `preview` を実行しない。`generate --dry-run` も判定専用ではないため使わない。
- ステージ 2（`generate`）へ進むには、尺、アスペクト、用途、トーン、CTA、使用エンジンへの合意が揃っていることを確認する。
- ステージ 3（`preview`）へ進むには、`generate` の出力（プロジェクト構成、コピー、シーン）をユーザーが確認してから実行する。`generate --preview` で同時実行することも可能だが、その場合も事前合意が必要。
- ステージ 4（`render`）は「レンダーして」「MP4まで」「完成動画を出して」などの明示依頼があり、かつ preview の結果に問題がない場合のみ実行する。`--confirm-render` を必ず付ける。CLI ゲートが exit 2 で止めるが、エージェントはユーザー合意なくこのフラグを付けてはならない。
- 「生成まで依頼している場合は推奨エンジンで進めてよい」と解釈できる場面でも、上記の合意が不足している場合は、生成・編集・レンダーへ進まず確認する。

## 成果物の保存規約 (Output Layout Rule)

成果物（動画・音声・プレビュー・中間素材）は **1成果物 = 1フォルダ** で保存します。スキルやツールに出力先を渡せる場合は、種類別トップ（`outputs/audio/` 等）に直接吐かせず、必ず以下のプロジェクト単位パスを指定してください。

```
outputs/projects/<project-slug>/
  clips/      # 生成元クリップ（PixVerse / Sora / Veo など）
  audio/      # BGM / SFX / ナレーション / master
  previews/   # プレビュー画像・QCシート（qc/ をネスト可）
  final/      # 最終納品 MP4
  assets/     # 静止画・overlays・中間素材
  manifest.json  # （任意）何の成果物か・元プロンプト・日付
```

ルール:

- `<project-slug>` は kebab-case（例: `pixverse-tokyo`, `ai-lab-takabon-suno-demo`）。1つのキャンペーン・楽曲・案件で1フォルダ。
- **バリアント（promo / urgency / v2 など）で新フォルダを増やさない。** `final/promo-16x9.mp4` `final/urgency-9x16.mp4` のようにファイル名で分岐するか、必要なら `final/urgency/` のサブフォルダにする。`outputs/pixverse-clips-urgency/` のような接尾辞フォルダは作らない。
- CLI 経由の成果物も `outputs/projects/<slug>/` に書き込まれる（`<slug>` はタイトル由来、衝突時は `-2` 等を付与。機械向けに `video-spec.json` / `project/` / `render/` / `preview/` / `logs/` を持つ）。旧 `outputs/jobs/<id>` は互換のため resolve のみ維持。engine 既定出力は `outputs/<engine>/<project>/`（`hyperframes` / `remotion` / `editframe`）で、CLI を介さない単体利用時のみ。これらの規約フォルダは触らない。
- `outputs/` は `outputs/README.md` を除き丸ごと Git 管理対象外。構造の説明は `outputs/README.md` にある。
- 種類別に散らかった既存成果物は `node scripts/organize-outputs.mjs`（dry run）で計画を確認し、`--apply` で `outputs/projects/<slug>/` へ再集約する。移動は既存ファイルを上書きせず、`outputs/.organize-ledger.json` に記録される。

## Editframe 直接制作セットアップ

ユーザーが明示的に "Let's build a video with Editframe."、`--engine editframe`、または Editframe で動画・テンプレート・編集ツール・自動生成ワークフローを作りたいと依頼した場合の補助ルールです。これは Michibiki のエンジン比較・承認境界を上書きしません。エンジン未選択の自然言語依頼では、先に `michibiki decide` または同等の `selectEngine()` 判定を使います。

### 先にユーザーへ伝える

制作に入る前に、「Node.js / FFmpeg の確認、Editframe agent skills の導入、プロジェクト作成準備をこちらで進めます」と短く伝える。

### セットアップ確認

1. Node.js が入っているか確認する: `command -v node && node --version`
2. FFmpeg が入っているか確認する: `command -v ffmpeg && ffmpeg -version`
3. Editframe agent skills が未導入なら、使用する `skills` CLI のバージョンを確認して `pnpm dlx skills@<version> add editframe/skills` で入れる。未確認の `npx` / `latest` 実行は避ける。
4. 要件が固まってから新規 Editframe プロジェクトを作成する

Node.js または FFmpeg が無い場合は、可能なら CLI で導入する。macOS では Homebrew が使えるなら `brew install node ffmpeg` を優先する。CLI 導入が難しい場合だけ、ユーザーに公式ページを案内する:

- Node.js: https://nodejs.org/en/download/
- FFmpeg: https://ffmpeg.org/download.html

### 制作前に必ず聞くこと

プロジェクト作成・素材取得・実装を始める前に、ユーザーの意図を先に揃える。

- 作りたいもの: Single video / Video template / Video editing tool / Video workflow automation / Something else
- 既存素材: 動画、画像、音声のローカルパスまたは URL
- Web サイト URL を素材元にするか
- 使いたい Node.js / React ライブラリがあるか
- React か vanilla HTML/CSS/JS の希望

Web サイト URL が提供された場合は、構築前に HTML、リンクされた CSS、画像、動画、音声を取得してローカルにキャッシュし、コンポジションは live URL ではなくローカルパスを参照する。取得した内容は、実装前に短く要約してユーザーへ共有する。

### Composition Skill と作成コマンド

提案・設計・実装の前に `composition` または `editframe-composition` Skill を読む。HTML と React のどちらを使うか、root timegroup に明示寸法があるか、必要なメディア要素・字幕・transition・render 手段を確認する。

ユーザーが React / HTML の希望を明示した場合は、必要に応じて次のショートカットを使う:

```bash
# React
npm create @editframe@latest -- react --global

# HTML / vanilla CSS / JS
npm create @editframe@latest -- html --global
```

プロジェクト作成後、こちらでバックグラウンドプロセスを管理できる環境なら `npm start` を起動し、出力された localhost URL を開く、またはユーザーに提示する。管理できない環境では、ユーザーに `npm start` を実行して表示された URL を開くよう伝える。

Skill 利用ルール:

- Remotion 関連の提案、コード生成、編集、プレビュー、レンダー、デバッグを行う場合は、毎回必ず `remotion-best-practices` を先に読む（プラグイン接頭辞付きで表示される場合も同じスキルとして扱う）。
- その他のエンジン、外部サービス、動画/音声/画像/ドキュメント領域でも、利用可能な公式スキルまたはプロジェクト固有スキルがある場合は、作業前に該当スキルを読む。
- スキルを使った場合は、返答または進捗でどのスキルを使ったかを短く明記する。

禁止:

- ページ概要だけを返して、エンジン比較を省略する。
- 比較・提案だけの段階で `generate` / `create` / `render` / `preview` を実行する。
- `engineFits` を確認せずに「今回は Remotion でよい」など単一エンジンだけを提案する。
- 素材が添付されているという理由だけで自動的に Editframe を推奨と決める（`engineFits` のスコアを必ず参照）。
- `switchHints` を省略してユーザーに「他エンジンに切り替える判断材料」を渡さない。
- 動画ファイル参照を確認せずに「既存MP4がある」と断定する。
- エンジンの特徴を `docs/ENGINE_PROFILES.md` を確認せずに語る（Remotion を「再利用テンプレート専用」、Editframe を「既存素材編集専用」と限定するなど）。
