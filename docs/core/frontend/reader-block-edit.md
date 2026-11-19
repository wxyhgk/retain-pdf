# 阅读页改译文

2026-11-19 加。在阅读页里直接在框里改一段译文，不用回书详情的质量页。和 AI 一起改（按要求改写、出几个候选）是下一步，这一版只有手改和修订历史。

## 怎么用

2026-11-19 当天从「右侧栏」改成「在框里直接改」：对照读的时候左边就是原文，悬停时两栏同一段会一起框出来，侧栏里再放一遍原文是重复的，还要把 PDF 挤窄。

- **进入**：译文栏鼠标停在一段上，悬停框里点「改」，或者直接按 `E`，这一段就变成编辑框。只开着原文栏时会先切到对照。
- **大块**（宽至少 300px、高至少 72px）：编辑框盖在这一段原来的位置上，往下按内容长高，可以盖住下面几段，存完就收回去。
- **小块**（标题、单行字、行间公式）：在这一段下面弹出一个放大的框，宽至少 360px；离页底不够就放在上面。原来那段会描一圈框，看得出改的是哪一段。
- **原文**：对照时不放（左边就有）。只看译文时，框顶上放一行原文，默认三行，点开看全。
- **公式**：编辑框里是原始写法（`$…$`），下面实时预览渲染出来的样子（停手 250ms 再渲染）。
- **工具条**：上一段、下一段（`Alt+↑/↓`），原因（可不填），历史（N），取消（`Esc`），保存（`⌘/Ctrl+Enter`，或者在原因框里按 Enter）。
- **草稿**：按段记在阅读器里。换段、翻页都不丢；取消或存好就丢掉。
- **保存**：只写回译文，不排版。存好编辑框就收起，PDF 上那一段先盖一层新译文，左上角标「待排版」，和实时译文用同一套排字、公式渲染。没通过检查就不收起，就地列出原因。
- **重新排版**：右下角一条「改了 N 处，还没排进 PDF · 重新排版」（窄屏时让到底栏上面），攒几处点一次。排版是原地整本重排，几百页的书要几分钟。
  - 排版期间：阅读页继续显示已经加载的旧 PDF，不能再改。
  - 排完（任务回到 succeeded）：自动重新加载译文 PDF。
  - 没排成（失败、取消）：右下角说一声，改动都还在。
- **修订历史**：点「历史」展开，新的在前，最后一条是「初译」（第一次写回之前的那份）。每条有时间、来源（手改 / 助手改 / 精修）、原因。点「用这版」就是把那段文字再写回一次，本身也记一条修订，不会丢东西。

## 不能改的情况

- **拼出来的书**（`merged-…`，几次翻译按页合成）：后端是只读的，也没有逐页对应的源任务。编辑框里说明原因，等后端带出按页的任务对照再开。
- **正在处理的书**（排队、运行，包括正在重新排版）：后端返回 `job_running`，所以前端先拦下。
- **原文直开**（没有任务）：没有「改」。

## 实现

- **包里的契约**：`ReaderSessionDataPort.translationEdit`（`frontend/packages/reader/src/contracts/session.ts`）。
  - `resolveOwnerJobId`：重新排版出来的任务没有自己的译文，要顺着 `source_artifact_job_id` 找到持有译文的任务。写回、读条目、读修订都发给它；排版发给正在读的任务。
  - `loadItem`、`revise`、`fetchRevisions`、`rerender`。
- **宿主实现**：`frontend/web/src/features/reader/domain/translation-edit-port.ts`。
  - `GET/PATCH /jobs/:id/translations/:item_id`（source=user）。
  - `data/revisions`：按阅读页块号筛，后端认三位、四位写法。
  - `retry-stage` render，`create_new_job=false`。
- **块号**：阅读页是四位（`p012-b0005`），译文条目里可能存的是三位或不补零。后端 2026-11-19 起让条目的读、改、修订、重翻入口按同一规则认任何写法（一字不差的优先），返回条目里实际存的写法。前端直接拿阅读页块号读一次，写回用返回的 `item_id`。
- **待排版**：按修订记录现算。PDF 排好（任务 `timestamps.finished_at`）以后才写回的修订，每段取最后一次（`pendingEditsFromRevisions`）。所以关掉阅读页再开也接得上；排完一次，完成时间一变，就清空了。
- **排完重新加载 PDF**：`job-status.ts` 的终态刷新栅栏，在任务又进排队、运行时重置。所以原地重跑（重新排版、精修）以后再到 succeeded，会再刷新一次产物。
- **主要代码**：
  - `hooks/use-reader-block-edit.ts`：会话状态，排版进度。
  - `pdf/ReaderInlineBlockEditor.tsx`：编辑框，在 `PdfPageSlot` 里随页画；放哪由 `inlineEditLayout` 算。
  - `components/react-pdf/use-block-editor.ts`：读条目、草稿、保存、历史。
  - `components/react-pdf/ReaderPendingEditsPill.tsx`：右下角那条。
  - `pdf/EditedTranslationOverlay.tsx`：待排版那一层。
  - `shared/data/block-edit.ts`：纯函数。
- **测试**：`frontend/web/tests/reader/reader-block-edit.test.mjs`。
