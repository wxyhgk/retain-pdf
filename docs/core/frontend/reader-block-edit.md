# 阅读页改译文

2026-11-19 加。在阅读页里直接改一段译文，不用回书详情的质量页。和 AI 一起改（按要求改写、出几个候选）是下一步，这一版只有手改和修订历史。

## 怎么用

- **选段**：译文栏鼠标停在一段上，悬停框里点「改」，或者直接按 `E`。会打开右侧的「改译文」面板，顶栏面板托盘里也有它（`edit`）。
- **改**：面板上面是原文（只读），中间是译文编辑框，公式写成 `$…$`，照原样保留。可以填一句为什么改。`⌘/Ctrl+Enter` 保存，`Alt+↑/↓` 换到上一段、下一段（只走正文、公式、表格），PDF 跟着跳。
- **草稿**：按段记着。改到一半换段，回来草稿还在；存过以后丢掉。
- **保存**：只写回译文，不排版。PDF 上那一段先盖一层新译文，左上角标「待排版」，和实时译文用同一套排字、公式渲染。
- **重新排版**：面板顶上一条「改了 N 处，还没排进 PDF · 重新排版」，攒几处点一次。排版是原地整本重排，几百页的书要几分钟。
  - 排版期间：阅读页继续显示已经加载的旧 PDF，不能再改。
  - 排完（任务回到 succeeded）：自动重新加载译文 PDF。
  - 没排成（失败、取消）：提示一句，改动都还在。
- **修订历史**：新的在前，最后一条是「初译」（第一次写回之前的那份）。每条有时间、来源（手改 / 助手改 / 精修）、原因。点「用这版」就是把那段文字再写回一次，本身也记一条修订，不会丢东西。

## 不能改的情况

- **拼出来的书**（`merged-…`，几次翻译按页合成）：后端是只读的，也没有逐页对应的源任务。面板说明原因，等后端带出按页的任务对照再开。
- **正在处理的书**（排队、运行，包括正在重新排版）：后端返回 `job_running`，所以前端先拦下。
- **原文直开**（没有任务）：没有「改」，面板托盘里的按钮禁用。

## 实现

- **包里的契约**：`ReaderSessionDataPort.translationEdit`（`frontend/packages/reader/src/contracts/session.ts`）。
  - `resolveOwnerJobId`：重新排版出来的任务没有自己的译文，要顺着 `source_artifact_job_id` 找到持有译文的任务。写回、读条目、读修订都发给它；排版发给正在读的任务。
  - `loadItem`、`revise`、`fetchRevisions`、`rerender`。
- **宿主实现**：`frontend/web/src/features/reader/domain/translation-edit-port.ts`。
  - `GET/PATCH /jobs/:id/translations/:item_id`（source=user）。
  - `data/revisions`：按阅读页块号筛，后端认三位、四位写法。
  - `retry-stage` render，`create_new_job=false`。
- **块号**：阅读页是四位（`p012-b0005`），译文条目里可能存的是三位或不补零。前端依次试这几种写法（`translationItemIdCandidates`）。后端以后会让这些入口认任何写法，到时候第一种就中。
- **待排版**：按修订记录现算。PDF 排好（任务 `timestamps.finished_at`）以后才写回的修订，每段取最后一次（`pendingEditsFromRevisions`）。所以关掉阅读页再开也接得上；排完一次，完成时间一变，就清空了。
- **排完重新加载 PDF**：`job-status.ts` 的终态刷新栅栏，在任务又进排队、运行时重置。所以原地重跑（重新排版、精修）以后再到 succeeded，会再刷新一次产物。
- **主要代码**：
  - `hooks/use-reader-block-edit.ts`：会话状态，排版进度。
  - `components/react-pdf/ReaderBlockEditPanel.tsx`、`use-block-editor.ts`：面板。
  - `pdf/EditedTranslationOverlay.tsx`：待排版那一层。
  - `shared/data/block-edit.ts`：纯函数。
- **测试**：`frontend/web/tests/reader/reader-block-edit.test.mjs`。
