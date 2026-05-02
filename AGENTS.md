# AGENTS.md - Michibiki Agent Rules

このリポジトリで Claude Code / Codex などのエージェントが作業する際の補助ルールです。上位のシステム・開発者・ユーザー指示を優先します。

## Video Request Routing Rule

ユーザーが自然言語で「このページのプロモ動画を作りたい」「〇〇な動画を作りたい」「URLから動画にしたい」と依頼した場合、ページ内容の要約だけで止めないでください。必ず Michibiki のエンジン比較を提示します。

標準フロー:

1. URLや素材がある場合は、ページ本文・素材種別・既存動画ファイル参照を確認する。
2. 既存MP4や動画素材があると判断した場合は、実際の `.mp4` / `.webm` / `<video>` / `og:video` 参照、またはユーザー提供のローカルファイルを根拠として示す。見出しやテキストだけで「既存MP4がある」と断定しない。
3. `michibiki generate --engine auto --prompt "<user request>"`、または同等の `selectEngine()` 判定を使い、`engine-decision.json` の `engineFits` と `selectionGuide`、および selected engine / selected proposal 相当の項目を確認する。
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

選定ロジックの扱い:

- `engineFits` は3エンジン間の相対評価であり、最大パーセンテージだけを `Recommended engine` とみなさない。
- `selectionGuide` の `Recommended engine`、または `engine-decision.json` の selected engine / selected proposal 相当の項目がある場合は、それを最終推奨として優先する。
- 尺、アスペクト、BGM/SFX、ナレーション、字幕同期、ハイテンポ編集など制作条件が追加・変更された場合は、前回の判定を流用せず再度 `selectEngine()` 相当を実行する。
- 相対スコア最大のエンジンと最終推奨が異なる場合は、スコア差と制作条件による補正理由を1文で説明する。

生成品質の扱い:

- エンジン選定と映像コピー設計は別工程として扱い、長いプロンプトやページ本文をそのまま表示テキストへ流し込まない。
- `generate` の出力は、制作条件と視聴者向けコピーを分離し、Hook / Detail / CTA などの短い `script` / `captions` / `scenes[].text` に再構成してから各エンジンへ渡す。

返答例:

```text
Recommended engine: hyperframes (55%)

- HyperFrames: 55%
  LP/URL起点なので、ページのセクションをDOM・スクロール・カード表現でプロモ化しやすいです。
- Remotion: 32%
  キネティックタイポ、スプリング/イージング、パララックス、3D風アクセントなど、単発でも凝ったフレーム単位のアニメーションに向いています。再利用が必要な場合だけprops化します。
- Editframe: 13%
  実写素材がなくても、字幕、BGM/ナレーション同期、トランジション、画像/ページキャプチャの重ね合わせで、タイムライン主導の編集感あるプロモにできます。

既存動画: HTML上の `.mp4` / `<video>` 参照は未検出です。
```

提案時の注意:

- 3エンジンの特徴は `docs/ENGINE_PROFILES.md` を参照する。
- `featureHighlights` を使い、各エンジンの具体機能を根拠に提案する。抽象的に「LP向き」「編集向き」とだけ言わない。
- Remotion を「再利用テンプレート用途」だけに限定しない。単発の高密度なアニメーション、キネティックタイポ、スプリング/イージング、パララックス、Lottie/3D風アクセント、フレーム単位の演出にも向くことを説明する。
- Editframe を「既存素材の編集用途」だけに限定しない。素材がない場合でも、字幕、BGM/ナレーション同期、トランジション、画像/ページキャプチャの重ね合わせ、タイムライン主導の演出に活かせることを説明する。

禁止:

- ページ概要だけを返して、エンジン比較を省略する。
- `engineFits` を確認せずに「今回は Remotion でよい」など単一エンジンだけを提案する。
- `engineFits` の最大パーセンテージだけで `Recommended engine` を決める。
- 動画ファイル参照を確認せずに「既存MP4がある」と断定する。
