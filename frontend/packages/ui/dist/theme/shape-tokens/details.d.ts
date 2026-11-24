import type { ShapeToken } from "./types.js";
/** 模块：小细节（选中文字、滚动条、聚焦外框、光标、勾选框）。说明见
 * docs/ops/planning/theme-customization/20261124-主题第二轮-还能换什么.md。
 *
 * 写法和别的模块不同：CSS 里兜底写 revert-layer（base.css 的 @layer base 里），不设变量 = 没有这条规则 = 浏览器默认。
 * 不能写 var(--x) 不带兜底：未定义时属性失效成 unset，::selection 的背景会变透明。 */
export declare const DETAILS_SHAPE_TOKENS: ShapeToken[];
//# sourceMappingURL=details.d.ts.map