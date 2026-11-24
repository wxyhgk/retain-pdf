import type { ShapeToken } from "./types.js";

/**
 * 模块：button（ui 包 Button / IconButton、首页 app-button、跨页 button-link）。
 * 说明见 docs/ops/planning/theme-customization/20261124-主题完全可自定义.md「模块划分」。
 * 已有的 --btn-radius、--btn-primary-bg/fg 在 styles/themes/_component-defaults.css，不在这张表。
 * 幽灵按钮不吃描边和阴影变量；hover 阴影只有 ui 包 Button 吃（app-button、button-link 没有）。
 */
export const BUTTON_SHAPE_TOKENS: ShapeToken[] = [
  { name: "--btn-border-width", kind: "length", description: "实体按钮的描边粗细（幽灵按钮固定 1px 透明）", fallback: "var(--shape-edge-width, 1px)" },
  { name: "--btn-primary-border", kind: "color", description: "主要按钮的描边颜色", fallback: "var(--shape-edge-color, transparent)" },
  { name: "--btn-secondary-border", kind: "color", description: "次要按钮的描边颜色", fallback: "var(--shape-edge-color, var(--line))" },
  { name: "--btn-secondary-hover-border", kind: "color", description: "次要按钮悬停时的描边颜色", fallback: "var(--shape-edge-color, color-mix(in srgb, var(--accent) 28%, var(--line)))" },
  { name: "--btn-danger-border", kind: "color", description: "危险按钮的描边颜色", fallback: "var(--shape-edge-color, 各变体现在的值)" },
  { name: "--btn-danger-hover-border", kind: "color", description: "危险按钮悬停时的描边颜色", fallback: "var(--shape-edge-color, var(--danger))" },
  { name: "--btn-shadow", kind: "shadow", description: "实体按钮平时的阴影（硬阴影风格设成 4px 4px 0 深色）", fallback: "var(--shape-shadow-sm, 各变体现在的值：Button 为 none，app-button 主要/危险为 0 6px 18px 淡色)" },
  { name: "--btn-hover-shadow", kind: "shadow", description: "Button 悬停时的阴影", fallback: "和平时一样" },
  { name: "--btn-press-transform", kind: "transform", description: "实体按钮按下时的位移，如 translate(2px, 2px)", fallback: "var(--shape-press-transform, none)" },
  { name: "--btn-press-shadow", kind: "shadow", description: "实体按钮按下时的阴影（一般设成 none，看起来压下去）", fallback: "var(--shape-press-shadow, 和平时一样)" },
  { name: "--btn-link-radius", kind: "length", description: "button-link（页面里的链接式按钮）的圆角", fallback: "var(--shape-radius-control, 全圆角)" },
];
