// BookCard「快速阅读」动作 —— 独立模块，改阅读逻辑只动本文件。
//
// 行为:
// - OCR-only 已完成 → 查看 OCR；翻译已完成 → 对照阅读（均保留 job 上下文）
// - 否则有 document → 读原文 (onReadSource(documentId))
// - 失败且无 document → 仍返回按钮，点击 no-op（兼容旧 UI/测试）

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import { resolveLibraryReadPresentation } from "../card/library-card-semantics.js";

export const BOOK_CARD_ACTION_READ = "read";

/**
 * @param item 书架 item
 * @param handlers onReader / onReadSource
 * @returns 0 或 1 个 action（当前始终 1 个）
 */
export function buildReadBookCardAction(
  item: LibraryCardItem = {},
  { onReader, onReadSource }: BookCardActionHandlers = {},
): BookCardAction[] {
  const presentation = resolveLibraryReadPresentation(item);
  let onClick: BookCardAction["onClick"] = () => {};

  if (presentation.target === "job") {
    onClick = () => {
      onReader?.(presentation.jobId, presentation.documentId);
    };
  } else if (presentation.target === "source") {
    onClick = () => {
      onReadSource?.(presentation.documentId);
    };
  }

  return [{
    id: BOOK_CARD_ACTION_READ,
    label: presentation.label,
    icon: "eye",
    // 历史测试锚点 .recent-job-reader
    className: "book-card-action book-card-action-read recent-job-reader",
    onClick,
  }];
}
