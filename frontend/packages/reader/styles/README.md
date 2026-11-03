# `@retainpdf/reader` 样式真值

Reader 的生产样式由 `frontend/packages/reader/styles/entry.css` 统一装配。`frontend/web/src/styles/entries/reader.css` 只是 Web MPA 的薄代理，新的 Reader 样式不要写回 `frontend/web/src/styles/reader`。

## 消费链

Web MPA：

```text
frontend/web/src/styles/entries/reader.css
  → frontend/packages/reader/styles/entry.css
  → frontend/web/dist/css/reader.css
```

Reader 包：

```text
frontend/packages/reader/scripts/styles.css
  → frontend/packages/reader/styles/entry.css
  → frontend/packages/reader/dist/styles.css
```

（以前另有 AI 回答样式 `dist/ai.css`，2026-11-03 随 RetainPDF 自己的 AI 删了。）

## 结构

```text
frontend/packages/reader/styles/
├── entry.css               # Reader 完整样式入口
├── tokens.css              # Reader 主题 token
├── themes/                 # classic/jiangnan/mojia/night/seacliff
├── core/                   # Tailwind theme、氛围底与下载反馈
├── layout.css / chrome.css / content.css / react-pdf.css
├── assistant-dock.css / selection-pop.css / panel-shell.css
├── float-markdown.css / float-ai*.css / hud.css / markdown.css / markdown-blocks.css
└── dialog-shell.css / reader.utilities.css
```

旧抽屉/收藏/区域菜单等未进入 `entry.css` 的孤儿分片（`annotations.css` / `favorites.css` / `selection.css` / `region-popover.css` / `side-drawer.css`，共 1349 行）已删除：它们零引用，包括桌面端打包配置。可拖动圆钮的 `fab*.css` 随圆钮本身一起删除。新增分片必须在 `entry.css` 里显式 `@import`，否则它不会被构建，也不会有人发现。

`frontend/web/src/styles/reader/*` 是迁移后残留的旧镜像，已经与本目录发生差异，不应继续双写或用作对照真值。

## 归属规则

- Reader 组件、工具、主题和内容呈现样式写在本目录。
- 不引入书架、上传、状态卡、凭据等 `frontend/web` 主页领域样式。
- 新选择器使用 `reader-*` 或 Reader 组件明确拥有的命名空间。
- 需要宿主通用能力时，优先在包内提供稳定样式，而不是反向 import `frontend/web` 页面样式。
- `entry.css` 是完整 Reader 入口。
- 当前 Reader 非模态浮层（下载 toast、选区浮条、快捷键面板）统一从 `dialog-shell.css` 获取 `reader-floating-surface` 与 `reader-floating-close`；业务分片只负责定位、尺寸和内部内容。
- Dock 面板**不是浮层**：它们贴在右栏（`.reader-notes-panel--workspace`），既不可拖动也不叠在 PDF 上。浮窗形态与 `--docked` 形态已随 `ReaderPanelShell` 一起删除。

## 验证

```bash
npm --prefix frontend/packages/reader run build
npm --prefix frontend/web run build:css
npm --prefix frontend/web test -- 'tests/reader/*.test.mjs'
npm --prefix frontend/web test -- 'tests/architecture/*.test.mjs'
npm --prefix frontend/web run visual:check
```

只有确认实际渲染变化符合预期后才更新视觉基线。
