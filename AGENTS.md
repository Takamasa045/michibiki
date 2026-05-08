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
- ルーターは以下の signals を見ている: 実アセット種別（video/audio/image/url）、URL の参照文脈（参照/詳細はこちら系）、timeline editing（ナレーション/BGM/字幕/編集/スライドショー）、web/DOM（LP/ページ/GSAP/スクロール）、HTML-in-canvas（DOMをcanvas化してblur/glitch/shader/WebGL/WebGPU風にポスト処理）、avatar/talking-head、data-driven/template、data viz（ダッシュボード/KPI/チャート）、explainer/tutorial、lyric/MV、coded motion design（kinetic typo/spring/easing/motion graphics/three.js）、cloud batch render（lambda/バッチ）、webinar recap、format（縦型短尺/長尺）。プロンプト本文を最初に丁寧に読む前提で動く。
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
3. `michibiki preview --job outputs/jobs/<id>` — preview 起動（HyperFrames/Editframe では headless Chrome + ffmpeg のフレームキャプチャが走る、副作用あり）。
4. `michibiki render --job outputs/jobs/<id> --confirm-render` — 最終 MP4 レンダー。`--confirm-render` 無しでは実行されず exit code 2 で停止する。

ルール:

- エンジン比較や制作方針提案のために `generate` / `create` / `render` / `preview` を実行しない。`generate --dry-run` も判定専用ではないため使わない。
- ステージ 2（`generate`）へ進むには、尺、アスペクト、用途、トーン、CTA、使用エンジンへの合意が揃っていることを確認する。
- ステージ 3（`preview`）へ進むには、`generate` の出力（プロジェクト構成、コピー、シーン）をユーザーが確認してから実行する。`generate --preview` で同時実行することも可能だが、その場合も事前合意が必要。
- ステージ 4（`render`）は「レンダーして」「MP4まで」「完成動画を出して」などの明示依頼があり、かつ preview の結果に問題がない場合のみ実行する。`--confirm-render` を必ず付ける。CLI ゲートが exit 2 で止めるが、エージェントはユーザー合意なくこのフラグを付けてはならない。
- 「生成まで依頼している場合は推奨エンジンで進めてよい」と解釈できる場面でも、上記の合意が不足している場合は、生成・編集・レンダーへ進まず確認する。

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
