// Hành động «Dịch» của BookCard — mô-đun độc lập; chỉ sửa file này khi đổi lối vào dịch.
//
// Mặc định không có trên thẻ; người gọi concat tường minh.
// Điều kiện hiển thị: bộ sưu tập chưa dịch hoặc job thất bại, và có document_id + onTranslate.

import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";
import { isLibraryOnlyItem } from "../../../composition/external.js";

export const BOOK_CARD_ACTION_TRANSLATE = "translate";

/**
 * @param item item thư viện
 * @param handlers onTranslate
 * @returns 0 hoặc 1 action
 */
export function buildTranslateBookCardAction(
  item: LibraryCardItem = {},
  { onTranslate }: BookCardActionHandlers = {},
): BookCardAction[] {
  const documentId = `${item.document_id || ""}`.trim();
  if (!documentId || !onTranslate) {
    return [];
  }
  const canTranslate =
    isLibraryOnlyItem(item) || `${item.status || ""}`.trim() === "failed";
  if (!canTranslate) {
    return [];
  }

  return [{
    id: BOOK_CARD_ACTION_TRANSLATE,
    label: "Dịch",
    icon: "languages",
    className: "book-card-action book-card-action-translate",
    onClick: (_event, current) => {
      onTranslate?.(current);
    },
  }];
}
