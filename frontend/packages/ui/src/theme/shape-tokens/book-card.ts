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
export const BOOK_CARD_SHAPE_TOKENS: ShapeToken[] = [
  // 书卡外框（卡片根，包住封面和标题）
  { name: "--card-pad", kind: "length", description: "书卡外框的内边距（封面和标题到外框的距离）", fallback: "0" },
  { name: "--card-border-width", kind: "length", description: "书卡外框的描边粗细", fallback: "var(--shape-edge-width, 0)" },
  { name: "--card-border-color", kind: "color", description: "书卡外框的描边颜色", fallback: "var(--shape-edge-color, transparent)" },
  { name: "--card-radius", kind: "length", description: "书卡外框的圆角", fallback: "var(--shape-radius-surface, 0)" },
  { name: "--card-bg", kind: "color", description: "书卡外框的底色", fallback: "transparent" },
  { name: "--card-shadow", kind: "shadow", description: "书卡外框的阴影（硬阴影风格在这里设偏移实色阴影）", fallback: "var(--shape-shadow-md, none)" },
  { name: "--card-press-transform", kind: "transform", description: "按下书卡时的位移或缩放", fallback: "var(--shape-press-transform, scale(0.99))" },
  { name: "--card-press-shadow", kind: "shadow", description: "按下书卡时外框的阴影", fallback: "var(--shape-press-shadow, 和不按时一样)" },
  // 封面
  { name: "--card-cover-inset", kind: "length", description: "封面四周留白（嵌在外框里的白边），要带单位，如 6px", fallback: "0px" },
  { name: "--card-cover-radius", kind: "length", description: "封面圆角", fallback: "var(--shape-radius-surface, 1rem)" },
  { name: "--card-cover-bg", kind: "color", description: "封面底色（没有封面图或图不满时露出来）", fallback: "--muted-surface 的 40%" },
  { name: "--card-cover-border-width", kind: "length", description: "封面自己的描边粗细", fallback: "0" },
  { name: "--card-cover-border-color", kind: "color", description: "封面自己的描边颜色", fallback: "transparent" },
  { name: "--card-cover-shadow", kind: "shadow", description: "封面的阴影；不要就写 0 0 transparent", fallback: "0 2px 16px，--shadow-color 7%" },
  { name: "--card-hover-translate", kind: "transform", description: "悬停或聚焦时封面的位移（translate 属性的值），如 0 -4px", fallback: "0 -0.125rem" },
  { name: "--card-cover-hover-shadow", kind: "shadow", description: "悬停或聚焦时封面的阴影", fallback: "0 8px 28px，--shadow-color 12%" },
  // 标题区
  { name: "--card-body-gap", kind: "length", description: "封面和标题区的间距", fallback: "0.5rem" },
  { name: "--card-body-pad", kind: "length", description: "标题区的内边距（标题和页数到外框的距离）", fallback: "0" },
  { name: "--card-title-size", kind: "length", description: "书卡标题的字号", fallback: "0.75rem" },
  { name: "--card-title-weight", kind: "number", description: "书卡标题的字重", fallback: "var(--shape-heading-weight, 600)" },
  { name: "--card-title-leading", kind: "number", description: "书卡标题的行高（倍数）", fallback: "1.375" },
  { name: "--card-meta-size", kind: "length", description: "书卡下方「页数 · 日期」的字号", fallback: "10px" },

  // 网格
  { name: "--grid-col-min", kind: "length", description: "书库网格每列的最小宽度（决定一行放几张卡）", fallback: "136px" },
  { name: "--grid-gap-x", kind: "length", description: "书库网格的列间距", fallback: "32px" },
  { name: "--grid-gap-y", kind: "length", description: "书库网格的行间距", fallback: "34px" },

  // 列表行
  { name: "--listrow-border-width", kind: "length", description: "列表行的描边粗细", fallback: "var(--shape-edge-width, 0)" },
  { name: "--listrow-border-color", kind: "color", description: "列表行的描边颜色", fallback: "var(--shape-edge-color, transparent)" },
  { name: "--listrow-radius", kind: "length", description: "列表行的圆角", fallback: "var(--shape-radius-surface, 1rem)" },
  { name: "--listrow-bg", kind: "color", description: "列表行的底色", fallback: "transparent" },
  { name: "--listrow-hover-bg", kind: "color", description: "鼠标悬停时列表行的底色", fallback: "--muted-surface 的 45%" },
  { name: "--listrow-shadow", kind: "shadow", description: "列表行的阴影", fallback: "var(--shape-shadow-sm, 0 1px 0，--shadow-color 4%)" },
  { name: "--listrow-press-transform", kind: "transform", description: "按下列表行时的位移或缩放", fallback: "var(--shape-press-transform, scale(0.99))" },
  { name: "--listrow-press-shadow", kind: "shadow", description: "按下列表行时的阴影", fallback: "var(--shape-press-shadow, 和不按时一样)" },
  { name: "--listrow-cover-radius", kind: "length", description: "列表行左侧小封面的圆角", fallback: "var(--shape-radius-surface, calc(var(--radius) + 4px))" },
  { name: "--listrow-cover-bg", kind: "color", description: "列表行左侧小封面的底色", fallback: "var(--paper)" },
  { name: "--listrow-cover-shadow", kind: "shadow", description: "列表行左侧小封面的阴影；不要就写 0 0 transparent", fallback: "0 2px 10px，--shadow-color 6%" },

  // 合集卡（文件夹封面堆叠 + 管理按钮）
  { name: "--collection-card-border-width", kind: "length", description: "合集卡的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--collection-card-border-color", kind: "color", description: "合集卡的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--collection-card-radius", kind: "length", description: "合集卡的圆角", fallback: "var(--shape-radius-surface, 14px)" },
  { name: "--collection-card-shadow", kind: "shadow", description: "合集卡的阴影", fallback: "var(--shape-shadow-md, 0 10px 24px，--ink 8%)" },
  { name: "--collection-card-hover-border-color", kind: "color", description: "悬停时合集卡的描边颜色", fallback: "var(--shape-edge-color, --accent 22% 混 --line)" },
  { name: "--collection-card-hover-shadow", kind: "shadow", description: "悬停时合集卡的阴影", fallback: "var(--shape-shadow-md, 0 14px 30px，--ink 12%)" },
  { name: "--collection-card-manage-radius", kind: "length", description: "合集卡右上角「管理」按钮的圆角", fallback: "var(--shape-radius-control, 10px)" },
  { name: "--collection-card-manage-shadow", kind: "shadow", description: "合集卡右上角「管理」按钮的阴影", fallback: "var(--shape-shadow-sm, 0 1px 4px，--ink 14%)" },
];
