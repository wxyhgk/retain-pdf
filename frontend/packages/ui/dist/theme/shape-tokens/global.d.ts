import type { ShapeToken } from "./types.js";
/**
 * 全局旋钮：皮肤只设这十几个，全站有描边、有阴影的控件和面板一起变。
 * 默认都不设（:root 里没有），各处用自己现在的值兜底，所以现有皮肤看起来不变。
 *
 * 用法（三层，最后一层是现在写死的值）：
 *   box-shadow: var(--btn-shadow, var(--shape-shadow-sm, 0 1px 3px …));
 *   border: var(--btn-border-width, var(--shape-edge-width, 1px)) solid
 *           var(--btn-border-color, var(--shape-edge-color, var(--line)));
 *
 * 哪些控件吃全局旋钮：有边框或底色的「实体」控件和面板（按钮、输入框、书卡、弹窗、浮层、底栏……）。
 * 不吃的：幽灵按钮、纯文字链接、Tooltip、PDF 页、译文叠层、标注高亮。
 */
export declare const GLOBAL_SHAPE_TOKENS: ShapeToken[];
//# sourceMappingURL=global.d.ts.map