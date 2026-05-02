# CLAUDE.md - Michibiki Claude Code Rules

Claude Code がこのリポジトリで作業する際は、このファイルと root `AGENTS.md` の両方を参照してください。上位のシステム・開発者・ユーザー指示を優先します。

## Video Request Routing Rule

ユーザーが自然言語で「このページのプロモ動画を作りたい」「〇〇な動画を作りたい」「URLから動画にしたい」と依頼した場合、ページ内容の要約だけで止めないでください。必ず Michibiki のエンジン比較を提示します。

標準フロー:

1. URLや素材がある場合は、ページ本文・素材種別・既存動画ファイル参照を確認する。
2. 既存MP4や動画素材があると判断した場合は、実際の `.mp4` / `.webm` / `<video>` / `og:video` 参照、またはユーザー提供のローカルファイルを根拠として示す。見出しやテキストだけで「既存MP4がある」と断定しない。
3. `michibiki generate --engine auto --prompt "<user request>"`、または同等の `selectEngine()` 判定を使い、`engine-decision.json` の `engineFits` と `selectionGuide` を確認する。
4. Remotion / HyperFrames / Editframe の3つを、相対評価パーセンテージ付きで提示する。
5. 各エンジンについて「この動画ならどう活かせるか」を1文で説明する。
6. 自動推奨エンジンを示したうえで、ユーザーが `--engine remotion` / `--engine hyperframes` / `--engine editframe` を選べるようにする。
7. ユーザーがエンジン選択を明示していない場合、比較提示のあとに「この方針で生成に進めるか」を確認する。ただし、ユーザーが明確に生成まで依頼している場合は推奨エンジンで進めてよい。

返答に必ず含める内容:

- `Recommended engine`
- `engineFits` の3エンジン分の相対評価
- 各エンジンの `bestUse`
- 各エンジンの `featureHighlights`
- 既存動画素材の有無と、その判断根拠

提案時の注意:

- 3エンジンの特徴は `docs/ENGINE_PROFILES.md` を参照する。
- `featureHighlights` を使い、各エンジンの具体機能を根拠に提案する。抽象的に「LP向き」「編集向き」とだけ言わない。
- Remotion を「再利用テンプレート用途」だけに限定しない。単発の高密度なアニメーション、キネティックタイポ、スプリング/イージング、パララックス、Lottie/3D風アクセント、フレーム単位の演出にも向くことを説明する。
- Editframe を「既存素材の編集用途」だけに限定しない。素材がない場合でも、字幕、BGM/ナレーション同期、トランジション、画像/ページキャプチャの重ね合わせ、タイムライン主導の演出に活かせることを説明する。

禁止:

- ページ概要だけを返して、エンジン比較を省略する。
- `engineFits` を確認せずに「今回は Remotion でよい」など単一エンジンだけを提案する。
- 動画ファイル参照を確認せずに「既存MP4がある」と断定する。
