// BookCard「翻译」动作 —— 独立模块，改翻译入口只动本文件。
//
// 默认不上卡片；由调用方显式 concat。
// 展示条件：馆藏未翻译、OCR-only 已完成或 job 失败，且有 document_id + onTranslate。

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import {
  isLibraryOnlyItem,
} from "../documents/document-card-item.js";
import { isOcrOnlyItem } from "../card/library-card-semantics.js";
import { isRetryableTerminalStatus } from "@/platform/contracts/job-status.js";

export const BOOK_CARD_ACTION_TRANSLATE = "translate";

/**
 * @param item 书架 item
 * @param handlers onTranslate
 * @returns 0 或 1 个 action
 */
export function buildTranslateBookCardAction(
  item: LibraryCardItem = {},
  { onTranslate }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  if (!documentId || !onTranslate) {
    return [];
  }
  const status = `${item.status || ""}`.trim().toLowerCase();
  // 终态里只有「成功」不可再翻；失败/取消/超时都应保留重新翻译入口。
  const retryableTerminal = isRetryableTerminalStatus(status);
  const canTranslate =
    isLibraryOnlyItem(item) ||
    retryableTerminal ||
    (isOcrOnlyItem(item) && status === "succeeded");
  if (!canTranslate) {
    return [];
  }

  return [{
    id: BOOK_CARD_ACTION_TRANSLATE,
    label: "翻译",
    icon: "languages",
    className: "book-card-action book-card-action-translate",
    onClick: (_event, current) => {
      if (current) onTranslate?.(current);
    },
  }];
}
