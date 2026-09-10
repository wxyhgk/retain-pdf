// BookCard 操作按钮工厂聚合。
// 每种功能一个文件；本文件只组合，不写 onClick 业务细节。

import { buildReadBookCardAction } from "./read.js";
import { buildTranslateBookCardAction } from "./translate.js";
import type { BookCardAction, BookCardActionHandlers, LibraryCardItem } from "../types.js";

export { BOOK_CARD_ACTION_READ, buildReadBookCardAction } from "./read.js";
export {
  BOOK_CARD_ACTION_TRANSLATE,
  buildTranslateBookCardAction,
} from "./translate.js";

/** 默认：只有快速阅读。 */
export function buildDefaultBookCardActions(
  item: LibraryCardItem = {},
  handlers: BookCardActionHandlers = {},
): BookCardAction[] {
  return buildReadBookCardAction(item, handlers);
}

/** 阅读 +（有条件时）翻译。 */
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
