# `@retainpdf/reader`

RetainPDF 的独立 react-pdf 阅读器包。组件、hooks、PDF 加载、阅读工具、Markdown 面板和 Reader 样式都以本包为实现真值（2026-11-03 RetainPDF 自己的 AI 删了，批注、AI 面板随之没了）；`frontend/web` 只是其中一个宿主。

## 公共入口

| package export | 用途 |
|----------------|------|
| `@retainpdf/reader` | 无副作用的 `ReaderApp` / `ReaderAppReactPdf` 组件出口 |
| `@retainpdf/reader/boot` | 浏览器 MPA 显式挂载入口 |
| `@retainpdf/reader/adapters` | 宿主能力类型、注册和读取 |
| `@retainpdf/reader/runtime/*` | 按 config/content/data/state 划分的非 UI 能力 |
| `@retainpdf/reader/styles.css` | 完整 Reader 样式 |

导入包根不会自动挂载 DOM。浏览器宿主需要先调用 `setReaderAdapters(...)`，再显式调用 `bootReader()`，或者自行渲染导出的 React 组件。

## 阅读页主组件怎么分

`src/ReaderAppReactPdf.tsx` 只做组装：谁和谁共享什么状态、reader context、渲染顺序。各块的状态和 effect 在 `src/app/` 下（2026-11-27 从原来 685 行的主组件里原样拆出，行为不变）：

| 文件 | 管什么 |
|---|---|
| `pane-composition.ts` | 可见台面（几栏、叠不叠实时译文）的纯函数；主组件照旧导出 |
| `use-live-translation-overlay.tsx` | 实时译文叠层：开没开、自动开 / 关、顶栏 pill 和源栏「译文」开关、「翻译完成 · 看对照」 |
| `use-reader-mode-persistence.ts` | 原文 / 对照 / 译文按书恢复和存档 |
| `use-reader-finder.ts`、`ReaderFinderArea.tsx` | 左栏：目录 / 书内搜索（防抖、Cmd/Ctrl+F、点了跳）/ 书签 / 待处理（N 走下一处）；浮着或钉住（本机记住） |
| `use-reader-pdf-assets.ts` | PDF 自带书签、各栏 PDF 对象、放大查看开着哪块 |
| `use-reader-block-editing.ts` | 改译文和「改过几次」角标 |
| `use-reader-extension-host.ts` | 贡献表这一侧：给扩展看的阅读页接口、阅读页建的那张表、从表里收拢出来的东西 |
| `ReaderOverlays.tsx` | 放大查看 |

新功能先在 `app/` 下写成一个 hook / 组件，主组件里只加调用和渲染位置。

## 扩展和贡献表（`src/extensions/`）

功能也可以写成**扩展**（2026-11-27 起，提问是第一个；方案见 `docs/ops/planning/reader-redesign/20261127-阅读页贡献表.md`）：
一个组件，挂在阅读页根节点里浮层的位置，画出来的就是它的浮层；用 `useReaderApi()` 读阅读页（书、块、目录、页数、跳页），
用 `useReaderContribution()` 往贡献表登记：右键菜单项（`menuItems`）和菜单里的一块（`menuSection`）、每页一层（`pageLayer`）、
文字层标记（`textMarks`）、小球里的按钮（`toolbarItems`）、对照左栏换成的那一份（`comparedDocument`）、占着指针（`takesPointer`）、
快捷键说明（`shortcuts`）；右边停靠的面板写在扩展定义上（`panels`）。
加一个扩展：写组件，在 `extensions/builtin.ts` 的列表里加一行。一个扩展出错只丢掉它自己。

现在的内置扩展（按顺序）：画笔、Markdown、对比版本、交叉引用（`extensions/builtin/`）、提问（`ask/ReaderAskExtension.tsx`）。


## 宿主契约

本包不直接依赖 `frontend/web/src/js/*`。宿主通过 `ReaderAdapters` 注入：

- 当前 Reader session 与文档来源；
- 受保护 PDF/资源请求；
- Markdown 资源解析；
- 下载文件名与下载执行；
- 模型凭据状态；
- 改译文（`sessionData.translationEdit`，见 [阅读页改译文](../../../docs/core/frontend/reader-block-edit.md)）：不给就没有「改」按钮。

RetainPDF Web 的实现位于：

```text
frontend/web/src/app/reader/entry.tsx
  → frontend/web/src/app/reader/adapters/retainpdf.ts
  → frontend/web/src/app/reader/external.ts
  → frontend/web/src/features/reader/domain/host/*
```

宿主不得 alias、相对导入或发布依赖 `frontend/packages/reader/src`。需要非 React 能力时，使用 `runtime/config`、`runtime/content`、`runtime/data`、`runtime/state` 等公开 exports。

唯一例外是软导航共享实现：包内暂无公开 navigation subpath，`frontend/web/src/platform/navigation/soft-reader.ts` 以源码路径 re-export `shared/navigation/soft-reader.ts`，与包内 `ReaderCloseHome` 共用同一真源。补齐公开 navigation export 后应改为经 package exports 消费。

## 构建

```bash
npm --prefix frontend/packages/reader run build
npm --prefix frontend/packages/reader run typecheck
```

构建会生成 ESM、类型声明和 `dist/styles.css`。在 Web MPA 中验证完整宿主链：

```bash
npm --prefix frontend/web run build:js
npm --prefix frontend/web run build:css
npm --prefix frontend/web test -- 'tests/reader/*.test.mjs'
```

## Markdown 渲染

- 公式由 MathJax 渲染（markdown-math）。
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
- [Web Reader 宿主边界](../../web/src/app/reader/README.md)
- [Web 前端地图](../../web/src/FEATURES.md)
- [Web 测试指南](../../web/tests/README.md)
