// BookCard Tổng hợp Nhà máy Nút Hành động。
// Một tệp cho mỗi chức năng；Tài liệu này chỉ kết hợp，Không viết onClick Chi tiết doanh nghiệp。

import { buildReadBookCardAction } from "./read.js";
import { buildTranslateBookCardAction } from "./translate.js";
import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export { BOOK_CARD_ACTION_READ, buildReadBookCardAction } from "./read.js";
export {
  BOOK_CARD_ACTION_TRANSLATE,
  buildTranslateBookCardAction,
} from "./translate.js";

/** ngầm thừa nhận：Chỉ đọc nhanh。 */
export function buildDefaultBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return buildReadBookCardAction(item, handlers);
}

/** đọc +（Khi có điều kiện）phiên dịch。 */
export function buildShelfBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return [
    ...buildReadBookCardAction(item, handlers),
    ...buildTranslateBookCardAction(item, handlers),
  ];
}

export function bookCardActionsSignature(actions: BookCardAction[] | null | undefined): string {
  if (!Array.isArray(actions) || !actions.length) return "";
  return actions
    .map(
      (a) =>
        `${a?.id ?? ""}|${a?.label ?? ""}|${a?.disabled ? "1" : "0"}|${a?.className ?? ""}`,
    )
    .join(";");
}
