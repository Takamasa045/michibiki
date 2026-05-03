# Michibiki (简体中文)

> このファイルは README.md のサマリ翻訳です。最新情報は英語版 / 日本語版を参照してください。
> This file is a summary translation of README.md. Refer to the English / Japanese version for the latest details.

Michibiki 是一个 AI 视频制作路由器。它会把自然语言视频需求转换为 `VideoSpec`，然后在 Remotion / HyperFrames / Editframe 中选择最合适的视频生成或编辑引擎。

当前版本支持 Remotion 项目生成和渲染，也支持 HyperFrames 的 HTML/CSS/JS 生成与本地 MP4 渲染，以及 Editframe 的 `timeline.json` 生成与本地 MP4 时间线预览。Remotion 默认使用 `auto` 模式：有 Remotion Studio Monorepo 时使用它，没有时在任务目录中生成 standalone 官方 Remotion 项目。HyperFrames/Editframe 通过 headless Chrome 和 ffmpeg 渲染。

## 主要功能

- 从自然语言提示生成 `VideoSpec`
- 自动选择视频引擎，并输出 Remotion / HyperFrames / Editframe 的相对适合度
- 输出 `selectionGuide`、`bestUse` 和 `featureHighlights`
- 通过 Remotion auto 模式生成 Monorepo 或 standalone 官方项目
- 生成 HyperFrames HTML/CSS/JS 项目并渲染 MP4
- 生成 Editframe timeline handoff 并渲染 MP4 时间线预览
- 将结果保存到 `outputs/jobs/<job-id>`
- 显示第三方引擎的许可证提醒

## 基本命令

```bash
pnpm install
pnpm build
pnpm test
pnpm michibiki create --prompt "Create a 30-second vertical event promo video."
pnpm michibiki doctor
pnpm michibiki preview --job outputs/jobs/<job-id>
pnpm michibiki generate --prompt "Create a 30-second vertical event promo video."
```

## 许可证说明

本仓库的原创代码使用 MIT License。第三方引擎仍受各自许可证和官方条款约束。

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - Editframe 官方条款和价格政策

商业、团队或 SaaS 使用前，请确认各工具的官方许可条件。
