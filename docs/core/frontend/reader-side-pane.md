# 阅读页第二栏（宿主页签）

2026-11-25 起。宿主（`frontend/web`）可以往阅读页顶栏加一个页签：左边是书、右边是宿主的内容。
第一个用它的是学习系统的「学习」页签（设计见 [学习页签接进阅读器](../../ops/planning/learning-system/20261125-学习页签接进阅读器.md)），
以后插件往阅读页加面板也走这里。

## 阅读器不认识里面是什么

`@retainpdf/reader` 只开一个口子 `sidePane`（`ReaderAdapters` 里，可选），类型在
`frontend/packages/reader/src/contracts/side-pane.ts`（`@retainpdf/reader/contracts` 导出）：

| 宿主给 | 说明 |
|---|---|
| `label` | 页签上的字 |
| `isAvailableFor({ documentId, jobId })` | 这本书出不出这个页签；抛错当作不出 |
| `render(api)` | 右栏的内容；出错只在这一栏里说一句（错误边界），不带崩阅读页 |

| 阅读器给（`api`） | 说明 |
|---|---|
| `navigateToAnchor({ page, itemId?, quote? })` | 左栏翻过去并把那一块亮一下。先按块编号（`p129-b000`），再按「那一页上的这段原文」，都找不到只翻页；返回 `"block"` / `"page"` / `"none"` |
| `setMarginMarkers(markers, onSelect?)` | 书页左边白边里的小圆点，颜色用皮肤语义色（`ok` / `danger` / `warn` / `accent` / `muted`，可空心）；点了回调 `onSelect(key)` |
| `currentPage` | 左栏现在看到第几页 |
| `documentId`、`jobId`、`close()` | 这本书是谁；关掉第二栏 |

阅读器里没有任何学习系统的词：页签图标是通用的「右栏」，圆点颜色只是语义色。

## 行为

- **只在这个页签里**：原文 / 对照 / 译文三个页签一点不变，圆点只在第二栏开着时画。点原文 / 对照 / 译文就离开第二栏。
- **和 Markdown 面板共用「开着哪个面板」**（`assistantPanel` 的值 `side`，`READER_HOST_PANEL_IDS`）：同一时间只开一个，
  按书记住（重开阅读页还在），换书不串；这本书宿主说没有时，存下来的 `side` 当作没开。它不在 dock 里，dock 也不给它画 tab 条。
- **书只剩一栏**：和开着 Markdown 面板一样，对照降成单栏、不叠实时译文；`译文` 模式下看译文，其余看原文
  （键盘 1 / 2 / 3 换模式时，第二栏开着就只换左栏看哪份）。右栏和书之间的分隔照旧能拖。
- 不做划词弹窗（阅读页的规矩，见 [悬停框](./reader-hover-tools.md) 那一段历史）：书和右栏之间只靠「回书里看」和小圆点来回。

## 代码

- `hooks/use-reader-side-pane.ts`：这本书有没有、给宿主的 `api`、圆点按页分好（`resolveMarginMarkers`）。
- `components/react-pdf/ReaderSidePane.tsx`：占 dock 的位置（`ReaderPanelShell`），包错误边界。
- `pdf/MarginMarkerLayer.tsx`：每页画圆点，和那一块的第一行对齐，同一块上的几个点往下错开；找不到块画在页顶。
- `ReaderWorkspaceTabs` 的 `sidePane` 属性；样式 `styles/side-pane.css`。
- 宿主：`frontend/web/src/app/reader/external.ts` 的 `readerSidePanePort` = `src/app/reader/learning-side-pane.tsx`，
  把这个口子接到 `@retainpdf/learning` 的学习区（`LearningPane`）上；阅读器和学习区互不认识，只在这一个文件里对接。
  学习区要的样式（基础组件、白板、学习区）由 web 的阅读页样式入口 `src/styles/entries/reader.css` 引，阅读器包不引。
- 测试：`frontend/web/tests/reader/reader-side-pane.test.mjs`；`visual:check` 的 `reader-side` 状态。
