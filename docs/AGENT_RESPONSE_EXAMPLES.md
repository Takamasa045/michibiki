# Agent Response Examples

エージェント（Claude Code / Codex / Antigravity）が Michibiki の `Video Request Routing Rule`（root `AGENTS.md`）に従って返答する際の参考例です。実際のパーセンテージ・本文は、`michibiki decide` または `selectEngine()` の出力で置き換えてください。

## URL/LP起点のプロモ動画リクエスト

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

## 既存MP4素材ありのリクエスト

```text
Recommended engine: editframe (62%)

- Editframe: 62%
  提供素材（clip.mp4 / voice.mp3）をそのままタイムラインに乗せ、字幕・BGM・トランジションで編集感のある仕上げにできます。
- Remotion: 25%
  React/TSXで素材を制御したい場合や、データ駆動のバリアントが必要な場合に向きます。
- HyperFrames: 13%
  既存素材は活かしづらく、LP/DOM起点の表現には向きません。

既存動画: ユーザー提供の clip.mp4 をローカルで確認しました。
```

## 短文・コピー設計の例

`generate` の出力は、ユーザー提供のプロンプト本文ではなく、Hook / Detail / CTA に再構成した短い `script` / `captions` / `scenes[].text` を渡します。

```text
Hook (0:00–0:03):  「30秒で勉強会の概要をシェア」
Detail (0:03–0:25): 日付・会場・登壇者・参加枠
CTA (0:25–0:30):   「申込みはプロフィールから」
```

## 注意

- パーセンテージや本文はサンプルです。`michibiki decide` の出力を必ず使ってください。
- 各エンジンの `bestUse` / `featureHighlights` の根拠は `docs/ENGINE_PROFILES.md` を参照してください。
