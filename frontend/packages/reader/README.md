# `@retainpdf/reader`

RetainPDF 的独立 react-pdf 阅读器包。组件、hooks、PDF 加载、批注、阅读工具、AI 面板和 Reader 样式都以本包为实现真值；`frontend/web` 只是其中一个宿主。

## 公共入口

| package export | 用途 |
|----------------|------|
| `@retainpdf/reader` | 无副作用的 `ReaderApp` / `ReaderAppReactPdf` 组件出口 |
| `@retainpdf/reader/boot` | 浏览器 MPA 显式挂载入口 |
| `@retainpdf/reader/adapters` | 宿主能力类型、注册和读取 |
| `@retainpdf/reader/ai` | 可独立消费的 Reader AI 组件/能力 |
| `@retainpdf/reader/runtime/*` | 按 ai/config/content/data/state 划分的非 UI 能力 |
| `@retainpdf/reader/styles.css` | 完整 Reader 样式 |
| `@retainpdf/reader/ai.css` | AI 回答与面板样式子集 |

导入包根不会自动挂载 DOM。浏览器宿主需要先调用 `setReaderAdapters(...)`，再显式调用 `bootReader()`，或者自行渲染导出的 React 组件。

## 宿主契约

本包不直接依赖 `frontend/web/src/js/*`。宿主通过 `ReaderAdapters` 注入：

- 当前 Reader session 与文档来源；
- 受保护 PDF/资源请求；
- Markdown 资源解析；
- 下载文件名与下载执行；
- 服务端收藏；
- 模型凭据状态；
- 文档 AI 请求。

RetainPDF Web 的实现位于：

```text
frontend/web/src/pages/reader/entry.tsx
  → frontend/web/src/pages/reader/adapters/retainpdf.ts
  → frontend/web/src/pages/reader/external.ts
  → frontend/web/src/shared/reader/host/*
```

宿主不得 alias、相对导入或发布依赖 `frontend/packages/reader/src`。需要非 React 能力时，使用 `runtime/ai`、`runtime/config`、`runtime/content`、`runtime/data`、`runtime/state` 等公开 exports。

## 构建

```bash
npm --prefix frontend/packages/reader run build
npm --prefix frontend/packages/reader run typecheck
```

构建会生成 ESM、类型声明、`dist/styles.css` 和 `dist/ai.css`。在 Web MPA 中验证完整宿主链：

```bash
npm --prefix frontend/web run build:js
npm --prefix frontend/web run build:css
npm --prefix frontend/web test -- 'tests/reader/*.test.mjs'
```

## Markdown 与 AI 渲染

- AI 回答使用 `markstream-react` 流式渲染，数学公式由 KaTeX 处理。
- 原始 HTML 按 escape 策略处理；Markdown 图片和链接由受限 custom nodes 接管。
- 受保护图片只允许当前任务的 Markdown image 路径，并通过宿主 `fetchProtected` 转为 blob；第三方图片不得携带 `X-API-Key`。
- 代码块当前使用轻量 `<pre><code>`。Mermaid、D2、Infographic 等 optional peers 未进入基础包。
- `shared/data/markdown-payload.ts` 统一处理当前字段、旧 payload 形状和 API envelope。
- 整篇 Markdown 先显示可读 fallback，再分批升级 MathJax SVG；图片按视口懒加载并限制并发。
- 正文目录、搜索和公式升级各自保持 DOM 边界，避免互相重写。

相关回归测试位于 `frontend/web/tests/reader`。

## 样式真值

`frontend/packages/reader/styles/entry.css` 是完整 Reader 样式入口：

```text
frontend/packages/reader/scripts/styles.css
  → frontend/packages/reader/styles/entry.css
  → frontend/packages/reader/dist/styles.css

frontend/web/src/styles/entries/reader.css
  → frontend/packages/reader/styles/entry.css
  → frontend/web/dist/css/reader.css
```

`frontend/web/src/styles/reader/*` 是迁移后保留的旧镜像，不应继续编辑。具体归属和验证命令见 [`styles/README.md`](styles/README.md)。

Reader 的快捷键帮助、工具菜单、选区工具、下载 Toast 和非停靠悬浮面板统一使用 `reader-floating-surface`；标题栏关闭按钮使用 `reader-floating-close`。这些是非模态工具 surface，不套 Web 主页的模态 Dialog 尺寸与遮罩。

## Legacy 状态

当前包和 `frontend/web` 都只启动 react-pdf Reader，没有 `?engine=legacy` 分支。仓库中残留的 legacy 文件名、旧数据 fallback 或历史 CSS 产物不构成受支持的第二引擎。详见 [`src/LEGACY.md`](src/LEGACY.md)。

## 相关文档

- [Reader 样式](styles/README.md)
- [Legacy 当前状态](src/LEGACY.md)
- [Web Reader 宿主边界](../../web/src/pages/reader/README.md)
- [Web 前端地图](../../web/src/FEATURES.md)
- [Web 测试指南](../../web/tests/README.md)
