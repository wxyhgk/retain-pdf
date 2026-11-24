import type { ShapeToken } from "./types.js";

/** 模块：form。说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。 */
export const FORM_SHAPE_TOKENS: ShapeToken[] = [
  // 输入框、textarea、下拉（field.css）
  { name: "--field-border-width", kind: "length", description: "输入框、多行框、下拉的描边粗细（设置、凭据里走全局元素样式的输入框也吃它）", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--field-border-color", kind: "color", description: "输入框、多行框、下拉的描边颜色（聚焦、错误态颜色不受它管）", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--field-radius", kind: "length", description: "输入框、多行框、下拉的圆角（同上，包括设置、凭据对话框里按 id 单独写了圆角的几个）", fallback: "var(--shape-radius-control, var(--ui-radius-md))" },
  { name: "--field-shadow", kind: "shadow", description: "输入框、多行框、下拉平时的阴影", fallback: "var(--shape-shadow-sm, none)" },
  { name: "--field-focus-shadow", kind: "shadow", description: "输入框聚焦时的阴影（不设则和平时一样）", fallback: "var(--field-shadow, var(--shape-shadow-sm, none))" },
  // 分段切换（choice.css）
  { name: "--seg-border-width", kind: "length", description: "分段切换外框的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--seg-border-color", kind: "color", description: "分段切换外框的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--seg-radius", kind: "length", description: "分段切换外框的圆角", fallback: "var(--shape-radius-control, var(--btn-radius))；网格排列时是 var(--ui-radius-md)" },
  { name: "--seg-option-radius", kind: "length", description: "分段切换每个选项的圆角", fallback: "var(--shape-radius-control, var(--btn-radius))；网格排列时是 var(--ui-radius-sm)" },
  { name: "--seg-shadow", kind: "shadow", description: "分段切换外框的阴影", fallback: "var(--shape-shadow-sm, none)" },
  { name: "--seg-active-bg", kind: "color", description: "分段切换选中项的底色", fallback: "var(--btn-primary-bg)" },
  { name: "--seg-active-fg", kind: "color", description: "分段切换选中项的文字颜色", fallback: "var(--btn-primary-fg)" },
  // 菜单（menu.css）
  { name: "--menu-border-width", kind: "length", description: "下拉菜单的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--menu-border-color", kind: "color", description: "下拉菜单的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--menu-radius", kind: "length", description: "下拉菜单的圆角", fallback: "var(--shape-radius-surface, var(--ui-radius-md))" },
  { name: "--menu-shadow", kind: "shadow", description: "下拉菜单的阴影", fallback: "var(--shape-shadow-md, 0 10px 28px color-mix(in srgb, var(--shadow-color) 16%, transparent))" },
  { name: "--menu-item-radius", kind: "length", description: "菜单项的圆角", fallback: "var(--ui-radius-sm)" },
  { name: "--menu-item-hover-bg", kind: "color", description: "菜单项高亮（悬停、键盘选中）的底色", fallback: "color-mix(in srgb, var(--ink) 6%, transparent)" },
  // 侧边抽屉（sheet.css）
  { name: "--sheet-border-width", kind: "length", description: "侧边抽屉靠内容一侧的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--sheet-border-color", kind: "color", description: "侧边抽屉靠内容一侧的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--sheet-shadow", kind: "shadow", description: "侧边抽屉的阴影", fallback: "var(--shape-shadow-lg, 0 0 32px color-mix(in srgb, var(--shadow-color) 18%, transparent))" },
  // 面板（panel.css）。--panel-radius 是弹窗壳的圆角，不是这里的，所以面板圆角叫 --panel-surface-radius。
  { name: "--panel-border-width", kind: "length", description: "面板（Panel）的描边粗细", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--panel-border-color", kind: "color", description: "面板（Panel）的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--panel-surface-radius", kind: "length", description: "面板（Panel）的圆角（弹窗壳的圆角是 --panel-radius，另一回事）", fallback: "var(--shape-radius-surface, var(--ui-radius-lg))" },
  { name: "--panel-shadow", kind: "shadow", description: "面板（Panel）的阴影", fallback: "var(--shape-shadow-md, none)" },
];
