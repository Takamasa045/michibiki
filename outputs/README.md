# outputs/

生成された成果物（動画・音声・プレビュー・中間素材）の置き場所です。
**`outputs/README.md` 以外はすべて Git 管理対象外**（`.gitignore` 参照）。

## 保存規約：1成果物 = 1フォルダ

スキル／ツールが成果物を吐くときは、**種類別トップ（`outputs/audio/` 等）に直接置かず**、
プロジェクト単位のフォルダにまとめます。

```
outputs/
  projects/
    <project-slug>/        # 1つの成果物（キャンペーン・楽曲・案件）= 1フォルダ
      clips/               # 生成元クリップ（PixVerse / Sora / Veo など）
      audio/               # BGM / SFX / ナレーション / master
      previews/            # プレビュー画像・QCシート（qc/ をネスト可）
      final/               # 最終納品 MP4（promo-16x9.mp4 のように変種をファイル名で分岐）
      assets/              # 静止画・overlays・中間素材
      manifest.json        # （任意）何の成果物か・元プロンプト・日付など

  jobs/        # michibiki CLI が作る render job（outputs/jobs/<job-id>/）。触らない
  hyperframes/ # engine 既定出力（outputs/<engine>/<project>/）。触らない
  remotion/    # 〃
  editframe/   # 〃
```

### ルール

- **バリアント（promo / urgency / v2 など）で新フォルダを増やさない。**
  `final/promo-16x9.mp4` `final/urgency-9x16.mp4` のようにファイル名、または `final/urgency/` のサブフォルダで分岐する。
- スキルに出力先パスを渡せる場合は、必ず `outputs/projects/<slug>/<bucket>/` を指定する。
- `<project-slug>` は kebab-case（例: `pixverse-tokyo`, `ai-lab-takabon-suno-demo`）。
- CLI / engine の規約フォルダ（`jobs/` `hyperframes/` `remotion/` `editframe/`）は既存のまま。

詳細な背景は [`AGENTS.md`](../AGENTS.md) の「成果物の保存規約」を参照。

## 散らかったら整理する

```bash
node scripts/organize-outputs.mjs            # dry run（移動計画を表示するだけ）
node scripts/organize-outputs.mjs --apply    # 実行（移動 + .DS_Store / node_modules 掃除）
node scripts/organize-outputs.mjs --no-clean # 掃除をスキップして移動のみ
```

- 既存のターゲットを上書きしません（衝突は中断して報告）。
- `outputs/` の外には一切触れません。冪等（再実行で何もしなくなる）。
- 実行内容は `outputs/.organize-ledger.json` に追記され、後から監査できます。
