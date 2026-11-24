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
export const GLOBAL_SHAPE_TOKENS = [
    { name: "--shape-edge-width", kind: "length", description: "实体控件和面板的描边粗细", fallback: "各处现在的值（多数 1px，书卡 0）" },
    { name: "--shape-edge-color", kind: "color", description: "实体控件和面板的描边颜色", fallback: "各处现在的值（多数 var(--line)）" },
    { name: "--shape-shadow-sm", kind: "shadow", description: "小件的阴影：按钮、输入框、标签、底栏图标", fallback: "各处现在的值" },
    { name: "--shape-shadow-md", kind: "shadow", description: "中件的阴影：书卡、浮层、菜单、工具栏", fallback: "各处现在的值" },
    { name: "--shape-shadow-lg", kind: "shadow", description: "大件的阴影：弹窗、抽屉", fallback: "各处现在的值" },
    { name: "--shape-press-transform", kind: "transform", description: "按下时的位移，如 translate(2px, 2px)", fallback: "各处现在的值（多数 scale(.94–.99) 或没有）" },
    { name: "--shape-press-shadow", kind: "shadow", description: "按下时的阴影（硬阴影风格一般设成 none，看起来是压下去）", fallback: "和不按时一样" },
    { name: "--shape-radius-control", kind: "length", description: "小控件圆角：输入框、标签、图标按钮", fallback: "各处现在的值" },
    { name: "--shape-radius-surface", kind: "length", description: "面板圆角：书卡、浮层、菜单、卡片", fallback: "各处现在的值" },
    { name: "--shape-heading-weight", kind: "number", description: "标题字重", fallback: "各处现在的值（600–700）" },
];
//# sourceMappingURL=global.js.map