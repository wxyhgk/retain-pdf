import type { ShapeToken } from "./types.js";
/**
 * 模块：book-card（书库网格里的书卡、网格本身、列表行、合集卡）。
 * 说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。
 * 样式在 web/src/features/library/ui/shell/BookCard.css、RecentJobItem.css（网格）、
 * web/src/features/collections/ui/CollectionsView.css。
 *
 * 书卡的结构：卡片根（外框，含封面和标题）> 封面 + 标题区。封面阴影不要写 none，写 0 0 transparent
 * （批量选中的环和阴影放在同一个 box-shadow 列表里，none 放进列表无效）。
 */
export declare const BOOK_CARD_SHAPE_TOKENS: ShapeToken[];
//# sourceMappingURL=book-card.d.ts.map