# AGENTS.md - Michibiki Agent Rules

このリポジトリで Claude Code / Codex などのエージェントが作業する際の補助ルールです。上位のシステム・開発者・ユーザー指示を優先します。

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
- 既存動画素材の有無と、その判断根拠

返答例:

```text
Recommended engine: hyperframes (55%)

- HyperFrames: 55%
  LP/URL起点なので、ページのセクションをDOM・スクロール・カード表現でプロモ化しやすいです。
- Remotion: 32%
  日付、会場、定員、CTAをprops化した再利用テンプレートに向いています。
- Editframe: 13%
  実写素材、音声、既存動画がある場合は字幕・B-roll中心の編集に活かせます。

既存動画: HTML上の `.mp4` / `<video>` 参照は未検出です。
```

禁止:

- ページ概要だけを返して、エンジン比較を省略する。
- `engineFits` を確認せずに「今回は Remotion でよい」など単一エンジンだけを提案する。
- 動画ファイル参照を確認せずに「既存MP4がある」と断定する。
