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

AI 回答相关样式还通过 `scripts/ai.css` 单独构建为 `dist/ai.css`，供 `@retainpdf/reader/ai.css` 消费。

## 结构

```text
frontend/packages/reader/styles/
├── entry.css               # Reader 完整样式入口
├── ai.css                  # AI Markdown/流式回答样式入口
├── tokens.css              # Reader 主题 token
├── themes/                 # classic/jiangnan/mojia/night/seacliff
├── core/                   # Tailwind theme、氛围底与下载反馈
├── layout.css / chrome.css / content.css / react-pdf.css
├── fab*.css / selection-pop.css / notes-float.css
├── float-markdown.css / float-ai*.css / hud.css / markdown.css
└── dialog-shell.css / reader.utilities.css
```

目录中仍有若干名称带 `legacy` 的历史 CSS 文件，以及旧抽屉/收藏等未进入当前入口的分片。它们不代表受支持的 `?engine=legacy` 运行时，也不由当前 `entry.css` 导入。清理这些文件应作为独立任务，并在删除前确认没有测试、文档工具或外部消费者依赖。

`frontend/web/src/styles/reader/*` 是迁移后残留的旧镜像，已经与本目录发生差异，不应继续双写或用作对照真值。

## 归属规则

- Reader 组件、工具、主题和内容呈现样式写在本目录。
- 不引入书架、上传、状态卡、凭据等 `frontend/web` 主页领域样式。
- 新选择器使用 `reader-*` 或 Reader 组件明确拥有的命名空间。
- 需要宿主通用能力时，优先在包内提供稳定样式，而不是反向 import `frontend/web` 页面样式。
- `entry.css` 是完整 Reader 入口；`ai.css` 是可被主页软宿主单独加载的 AI 子集。
- 当前 Reader 非模态浮层统一从 `dialog-shell.css` 获取 `reader-floating-surface` 与 `reader-floating-close`；业务分片只负责定位、尺寸和内部内容。

## 验证

```bash
npm --prefix frontend/packages/reader run build
npm --prefix frontend/web run build:css
npm --prefix frontend/web test -- 'tests/reader/*.test.mjs'
npm --prefix frontend/web test -- 'tests/architecture/*.test.mjs'
npm --prefix frontend/web run visual:check
```

只有确认实际渲染变化符合预期后才更新视觉基线。
