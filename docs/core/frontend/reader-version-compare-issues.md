# 阅读页：对比版本、待处理（和顶栏、悬浮小球的布局）

2026-11-20 加。两件事都是为了「把译文改好、挑出好的那份」。

同一天顶栏也收了一次（用户嫌顶部按钮太多）：顶栏只留左边「目录」、中间「原文 / 对照 / 译文」、右边「下载」「关闭」，都尽量只用图标；
「搜索」挪到底栏，点开的卡从底栏往上弹；面板（Markdown，用 Markdown 的标志）和「对比版本」进右下角的悬浮小球
（`ReaderToolBall.tsx`、`styles/toolball.css`）。小球是唯一的启动器，面板开着时不藏，挪到面板左边——2026-09 删掉的那个可拖圆钮
就是因为开着面板时被 CSS 藏掉、里面的功能进不去。

## 对比版本

一本书翻过好几次（换模型、重新翻译）就有好几份译文。悬浮小球里有「对比版本」（只有一份译文时不出现，手机宽度也不放）：

- 点开列这本书的译文版本（隐藏的、没翻完的不列），新的在上，名字后面带时间；右边正在读的那份标「正在读」，不能选。
- 选一份：切到对照，左栏换成那一份的译文，右栏照旧是正在读的这份。几份译文用的是同一份 OCR 结果，块编号和位置一样，悬停时两栏框的是同一段。
- 两栏书页顶上各浮一块淡淡的水印：RetainPDF 标记、模型名大字、「对比 / 正在读 · 方式 · 时间」小字（左金右绿）。
  每栏自己是个 overflow:auto 的容器（从不滚），sticky 贴不住，所以量出每栏中线用 fixed 放（`VersionWatermarks`）。
  2026-11-20 起代替书页上方那一条文字。
- 「用左边这份」「退出对比」在小球的版本列表里。「用左边这份」：设成这本书阅读用的版本（`PUT /documents/:id/translation-version`，和书详情「译文版本」里选的一样），再把地址里的 `job_id` 换成那一份的任务，阅读页按地址重新载入。
- 切到只看原文或只看译文，就不对比了。

实现：

- 宿主端口 `ReaderSessionDataPort.translationVersions`（`list`、`resolveJob`、`select`），web 侧在 `features/reader/domain/translation-versions-port.ts`。
  `resolveJob` 走 `GET /documents/:id/reading?version=`，可能是合并出来的虚拟任务。
- `packages/reader/src/hooks/use-reader-version-compare.ts`：载入那一份的任务（`loadReaderPayload`，带 regions），译文 PDF 地址用 `resolveReaderTranslatedPdfUrl`。
  左栏走原文栏那一路，所以把那一份的译文放进 regions 的 `source`（`asComparePaneRegions`）：悬停复制、搜索标记读的都是那一份的译文。
- 阅读上下文多一个 `compareVersion`（地址 + 块）；`ReaderCompareGrid` 有它时左栏换地址和块。
- 界面在 `components/react-pdf/ReaderVersionCompare.tsx`（版本列表、水印），样式 `styles/version-compare.css`。

## 待处理

> 2026-11-27 起列表挪进左栏的「待处理」页签（底栏这颗去掉，顶栏左边那颗角上带个数），N / Shift+N 照旧，
> 见 [书页区、左栏](../../ops/planning/reader-redesign/20261127-左栏收拢目录搜索书签待处理.md)。下面是当时的写法。

底栏多一颗「⚠ N」（没有问题时不出现）：

- 点开按类列出要人看一眼的段落：
  - **没翻成**：`translation_items` 里 `final_status = failed`，先显示原文。
  - **内容问题**：`qa_violations` 里 critical / major，排版那类除外。
  - **版面放不下**：`layout_fit` 只列 critical；major 多是溢出两三磅，看不出来，不列。
- 点一条跳到那一段，悬停就能「改」。
- 按 N 跳到下一处、Shift+N 回上一处。接着上一次跳到的那条走；还没跳过就从眼下这一页往后（往前）找，到头绕回。光标在输入框里时不接。
- 列表开着时底栏不自动收起。

实现：宿主端口 `ReaderSessionDataPort.loadIssues`，web 侧在 `features/reader/domain/reader-issues-port.ts`，都从通用取数接口读，每条带 `reader_item_id`。
读不到（旧任务没有这些数据、合并出来的虚拟任务）就当没有。阅读包里是 `hooks/use-reader-issues.ts`、`components/react-pdf/ReaderIssuesControl.tsx`，样式 `styles/issues.css`。
