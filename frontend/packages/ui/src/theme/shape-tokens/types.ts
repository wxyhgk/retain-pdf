/** 一个形状变量的登记。以后自定义主题的白名单、编辑器的表单都从这张表来。 */
export type ShapeTokenKind =
  /** 长度：px / em / rem / %，可以是 0 */
  | "length"
  /** 颜色：hex、rgb()、或 var(--语义色) / color-mix(…var(--语义色)…) */
  | "color"
  /** box-shadow 值，可以是 none */
  | "shadow"
  /** 字体族 */
  | "font"
  /** 纯数字（字重、倍数） */
  | "number"
  /** transform / translate 值，可以是 none */
  | "transform"
  /** CSS filter 值（如 drop-shadow(...)），可以是 none */
  | "filter"
  /** 只能取 values 里列出的几个词之一（如显示开关 block / none） */
  | "keyword";

export type ShapeToken = {
  /** 变量名，带 -- 前缀 */
  name: `--${string}`;
  kind: ShapeTokenKind;
  /** 一句中文说明：管哪里 */
  description: string;
  /**
   * 不设这个变量时实际用的值（写在 CSS 里 var() 的最后一层兜底）。
   * 只是给编辑器显示用；真值在 CSS 里。全局旋钮写「各处现在的值」。
   */
  fallback: string;
  /** kind 为 keyword 时可以取的值 */
  values?: string[];
};
