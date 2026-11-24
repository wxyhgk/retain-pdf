/** 模块：小细节（选中文字、滚动条、聚焦外框、光标、勾选框）。说明见
 * docs/ops/planning/theme-customization/20261124-主题第二轮-还能换什么.md。
 *
 * 写法和别的模块不同：CSS 里兜底写 revert-layer（base.css 的 @layer base 里），不设变量 = 没有这条规则 = 浏览器默认。
 * 不能写 var(--x) 不带兜底：未定义时属性失效成 unset，::selection 的背景会变透明。 */
export const DETAILS_SHAPE_TOKENS = [
    { name: "--selection-bg", kind: "color", description: "选中文字的背景色（页面各处；PDF 文字层的选区另有自己的颜色，不受影响）", fallback: "浏览器默认选中色" },
    { name: "--selection-fg", kind: "color", description: "选中文字的字色", fallback: "浏览器默认（字色不变）" },
    { name: "--scrollbar-thumb", kind: "color", description: "滚动条滑块颜色；要和 --scrollbar-track 一起设才生效", fallback: "auto（系统默认）" },
    { name: "--scrollbar-track", kind: "color", description: "滚动条轨道颜色；只设了滑块时轨道透明", fallback: "transparent" },
    { name: "--scrollbar-width", kind: "keyword", values: ["auto", "thin", "none"], description: "滚动条粗细：auto 系统默认，thin 细，none 隐藏（页面里自己写了的隐藏滚动条不受影响）", fallback: "auto" },
    { name: "--focus-ring-width", kind: "length", description: "没有自己写聚焦样式的控件的键盘聚焦环粗细；要把 --focus-ring-style 设成实线样式才看得出", fallback: "浏览器默认" },
    { name: "--focus-ring-color", kind: "color", description: "同上，聚焦环颜色", fallback: "浏览器默认" },
    { name: "--focus-ring-style", kind: "keyword", values: ["auto", "solid", "dashed", "dotted", "double"], description: "同上，聚焦环线型", fallback: "auto（浏览器默认）" },
    { name: "--check-color", kind: "color", description: "勾选框和单选框的选中色（accent-color）；页面里自己写了 accent-color 的不受影响", fallback: "浏览器默认或上一层的 accent-color" },
    { name: "--cursor-default", kind: "keyword", values: ["auto", "default", "text", "crosshair", "help", "wait", "progress"], description: "页面默认光标（挂在 body 上，没自己写 cursor 的元素继承）", fallback: "auto" },
    { name: "--cursor-pointer", kind: "keyword", values: ["pointer", "grab", "help", "crosshair", "cell", "alias"], description: "可点击元素的光标：链接、摘要、下拉框、role=button/tab/menuitem，以及阅读器里写了它的按钮；其他按钮要把各自的 cursor: pointer 改成 var(--cursor-pointer, pointer) 才跟着变", fallback: "pointer" },
];
//# sourceMappingURL=details.js.map