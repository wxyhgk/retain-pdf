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
  // 封面：倾斜、书页厚度、书脊（书页厚度没有单独变量：在 --card-cover-shadow 里写多层实色偏移阴影，
  // 如 1px 1px 0 var(--paper), 2px 2px 0 var(--ink), 3px 3px 0 var(--paper), 4px 4px 0 var(--ink)，悬停的阴影同样要写一份）
  { name: "--card-tilt", kind: "transform", description: "封面的倾斜角度（rotate 属性的值），如 -1.5deg；不倾斜就不设", fallback: "none" },
  { name: "--card-tilt-alt", kind: "transform", description: "偶数位书卡封面的倾斜角度，通常设成 --card-tilt 的反方向；不设就和 --card-tilt 一样", fallback: "var(--card-tilt, none)" },
  { name: "--card-tilt-hover", kind: "transform", description: "悬停或聚焦时封面的倾斜角度，写 0deg 就是回正；不设就保持不悬停时的角度", fallback: "和不悬停时一样" },
  { name: "--card-spine-width", kind: "length", description: "封面左侧书脊折痕的宽度，0 不显示", fallback: "0px" },
  { name: "--card-spine-color", kind: "color", description: "书脊折痕的颜色（左缘最深，向右渐隐，再有一道细折线）", fallback: "transparent" },
  // 标题区
  { name: "--card-body-gap", kind: "length", description: "封面和标题区的间距", fallback: "0.5rem" },
  { name: "--card-body-pad", kind: "length", description: "标题区的内边距（标题和页数到外框的距离）", fallback: "0" },
  { name: "--card-title-size", kind: "length", description: "书卡标题的字号", fallback: "0.75rem" },
  { name: "--card-title-weight", kind: "number", description: "书卡标题的字重", fallback: "var(--shape-heading-weight, 600)" },
  { name: "--card-title-leading", kind: "number", description: "书卡标题的行高（倍数）", fallback: "1.375" },
  { name: "--card-title-font", kind: "font", description: "书卡标题的字体", fallback: "var(--shape-heading-font, 继承正文)" },
  { name: "--card-meta-size", kind: "length", description: "书卡下方「页数 · 日期」的字号", fallback: "10px" },

  // 装饰位：书签丝带（只挂在「在读」的书上）、右下折角。默认不显示。
  { name: "--card-ribbon-display", kind: "keyword", values: ["block", "none"], description: "书签丝带显不显示：block 显示，none 不显示。只出现在「在读」的书上", fallback: "none" },
  { name: "--card-ribbon-color", kind: "color", description: "书签丝带的颜色", fallback: "var(--accent)" },
  { name: "--card-ribbon-width", kind: "length", description: "书签丝带的宽度", fallback: "14px" },
  { name: "--card-ribbon-height", kind: "length", description: "书签丝带的长度", fallback: "26px" },
  { name: "--card-ribbon-top", kind: "length", description: "书签丝带离书卡上边的距离，负数会探出书卡", fallback: "-3px" },
  { name: "--card-ribbon-right", kind: "length", description: "书签丝带离书卡右边的距离", fallback: "12px" },
  { name: "--card-ribbon-left", kind: "length", description: "书签丝带离书卡左边的距离；右上角的「存档」角标会挡住丝带时，设这个并把 --card-ribbon-right 设成 auto", fallback: "auto" },
  { name: "--card-ribbon-notch", kind: "length", description: "书签丝带下端燕尾缺口的深度", fallback: "6px" },
  { name: "--card-ribbon-filter", kind: "filter", description: "书签丝带的描边或投影，写 drop-shadow(...)；不要就写 none", fallback: "none" },
  { name: "--card-fold-size", kind: "length", description: "书卡右下折角的大小，0 不显示", fallback: "0px" },
  { name: "--card-fold-color", kind: "color", description: "书卡右下折角的颜色", fallback: "var(--accent)" },
  { name: "--card-fold-offset", kind: "length", description: "折角离书卡右下角的距离（书卡有描边时可以设成描边粗细的负数，盖住描边）", fallback: "0px" },

  // 网格
  { name: "--grid-col-min", kind: "length", description: "书库网格每列的最小宽度（决定一行放几张卡）", fallback: "136px" },
  { name: "--grid-gap-x", kind: "length", description: "书库网格的列间距", fallback: "32px" },
  { name: "--grid-gap-y", kind: "length", description: "书库网格的行间距", fallback: "34px" },
  { name: "--grid-align", kind: "keyword", values: ["start", "stretch", "end", "center"], description: "网格里每张书卡在行内的对齐：start 各自按内容高度，stretch 同一行拉到同高（用搁板时设这个，板才在一条线上）", fallback: "start" },
  { name: "--grid-pad-x", kind: "length", description: "网格左右两侧的内边距；搁板两头会各探出半个列间距，设成 --grid-gap-x 的一半可以不探出网格", fallback: "0px" },

  // 搁板：每张书卡下面画一段板，左右各多出半个列间距，相邻的卡拼成整行连续的板；最后一行不满时只画到最后一张卡。
  // 用到板时 --card-border-width（或 --shape-edge-width）要带单位，不能写裸 0。
  { name: "--shelf-display", kind: "keyword", values: ["block", "none"], description: "搁板显不显示：block 显示，none 不显示", fallback: "none" },
  { name: "--shelf-height", kind: "length", description: "搁板的厚度（含上沿描边）", fallback: "10px" },
  { name: "--shelf-color", kind: "color", description: "搁板的颜色", fallback: "var(--muted-surface)" },
  { name: "--shelf-edge-width", kind: "length", description: "搁板上沿描边的粗细", fallback: "2px" },
  { name: "--shelf-edge-color", kind: "color", description: "搁板上沿描边的颜色", fallback: "transparent" },
  { name: "--shelf-shadow", kind: "shadow", description: "搁板的阴影（如板下一道实色偏移阴影）", fallback: "none" },
  { name: "--shelf-offset", kind: "length", description: "搁板离书卡底边的距离，正数板在书卡下面，负数板会盖住书卡底部", fallback: "0px" },

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
