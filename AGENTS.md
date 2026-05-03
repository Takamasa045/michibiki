# AGENTS.md - Michibiki Agent Rules

このリポジトリで Claude Code / Codex などのエージェントが作業する際のカノニカルなルールです。Claude Code 用の `CLAUDE.md` はこのファイルへのポインタです。上位のシステム・開発者・ユーザー指示を優先します。

各エンジンの特徴・適用範囲・公式ドキュメント参照は [`docs/ENGINE_PROFILES.md`](docs/ENGINE_PROFILES.md) を参照してください。返答サンプルは [`docs/AGENT_RESPONSE_EXAMPLES.md`](docs/AGENT_RESPONSE_EXAMPLES.md) にあります。

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
- ルーターは以下の signals を見ている: 実アセット種別（video/audio/image/url）、URL の参照文脈（参照/詳細はこちら系）、timeline editing（ナレーション/BGM/字幕/編集/スライドショー）、web/DOM（LP/ページ/GSAP/スクロール）、avatar/talking-head、data-driven/template、data viz（ダッシュボード/KPI/チャート）、explainer/tutorial、lyric/MV、coded motion design（kinetic typo/spring/easing/motion graphics/three.js）、cloud batch render（lambda/バッチ）、webinar recap、format（縦型短尺/長尺）。プロンプト本文を最初に丁寧に読む前提で動く。
- 否定文（〜なし/〜無い/〜じゃない/〜ではない/〜は作らない）とメタ参照（〜について/〜の話/〜を取り上げる）は near-context（前後 16 文字）で検出し、該当 keyword を無効化する。「LPは作らないが、企業ロゴアニメ」のような prompt は LP signal が消えて Remotion が選ばれる。
- ルーターが見るテキストは `spec.goal`（ユーザー入力の生プロンプト）と user-provided CTA のみ。`spec.title` / `content.script` / `content.captions` / `content.scenes` は from-prompt.ts が自動推論したもので、否定文脈を失った keyword を再注入する可能性があるので signal 抽出には使わない。
- `clarifyingQuestions` は top vs 2nd の差が 8% 以下の時に生成される。提案文ではこれをユーザーへの質問としてそのまま提示し、回答（A/B または `--engine`）を待つ。

生成品質の扱い:

- エンジン選定と映像コピー設計は別工程として扱い、長いプロンプトやページ本文をそのまま表示テキストへ流し込まない。
- `generate` の出力は、制作条件と視聴者向けコピーを分離し、Hook / Detail / CTA などの短い `script` / `captions` / `scenes[].text` に再構成してから各エンジンへ渡す。

生成・レンダー実行の承認境界:

- エンジン比較や制作方針提案のために `michibiki generate` / `michibiki create` / `michibiki render` / `michibiki preview` を実行しない。`generate --dry-run` も判定専用ではないため使わない。
- 生成プロジェクト作成へ進むには、尺、アスペクト、用途、トーン、CTA、使用エンジンへの合意が揃っていることを確認する。
- MP4レンダーは「レンダーして」「MP4まで」「完成動画を出して」などの明示依頼がある場合のみ実行する。
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
