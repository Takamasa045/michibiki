# Windows Start Here

Michibiki は Windows でも ZIP を展開して使えます。PowerShell で展開先フォルダを開いてください。

## 必要なもの

- Node.js 24.18 以上
- pnpm 11.9 以上（Corepack で有効化）
- Google Chrome / Microsoft Edge / Chromium
- ffmpeg（MP4 の preview / render を使う場合）

## 初回セットアップ

```powershell
node scripts/setup.mjs
```

Codex や Claude Code を使っている場合は、このフォルダを開いて「セットアップして」と依頼すれば、エージェントは `node scripts/setup.mjs` を実行する想定です。

Chrome / Edge は標準インストール先から自動検出されます。別の場所に入れている場合は `VIDEO_ROUTER_CHROME` を指定してください。

```powershell
$env:VIDEO_ROUTER_CHROME="D:\Apps\Chrome\Application\chrome.exe"
pnpm michibiki doctor
```

## まず試すコマンド

```powershell
pnpm michibiki decide --prompt "30秒のイベント告知動画を作りたい"
```

`preview` / `render` を使う場合は、`pnpm michibiki doctor` で ffmpeg と Chrome / Edge が `OK` になっていることを確認してください。
