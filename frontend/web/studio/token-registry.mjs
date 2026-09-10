// Theme Studio 的 token 注册表（浏览器原生 ES module，不进构建管线）。
//
// 真值对照：
// - 颜色契约：src/styles/themes/_contract.css（必选 20+1）
// - L3 形态/布局/材质：src/styles/themes/_component-defaults.css
// tests/studio-token-registry.test.mjs 锁住"注册表 token 必须真实存在于
// src/styles"——契约演进时这里跟着改，不会静默漂移。

export const TOKEN_GROUPS = [
  {
    id: "contract",
    label: "颜色契约（皮肤必选）",
    tokens: [
      { name: "--bg", type: "color", hint: "页面底色" },
      { name: "--paper", type: "color", hint: "纸面/卡片" },
      { name: "--surface", type: "color", hint: "浮层表面" },
      { name: "--ink", type: "color", hint: "正文字" },
      { name: "--muted", type: "color", hint: "次要文字" },
      { name: "--line", type: "color", hint: "描边/分隔" },
      { name: "--accent", type: "color", hint: "强调色" },
      { name: "--accent-weak", type: "color", hint: "强调弱底" },
      { name: "--selection", type: "color", hint: "选区" },
      { name: "--danger", type: "color", hint: "危险" },
      { name: "--danger-weak", type: "color", hint: "危险弱底" },
      { name: "--ok", type: "color", hint: "成功" },
      { name: "--ok-weak", type: "color", hint: "成功弱底" },
      { name: "--warn", type: "color", hint: "警示/荧光笔" },
      { name: "--warn-weak", type: "color", hint: "警示弱底" },
      { name: "--gold", type: "color", hint: "金/印" },
      { name: "--gold-weak", type: "color", hint: "金弱底" },
      { name: "--chrome", type: "color", hint: "深色镶边" },
      { name: "--reader-page", type: "color", hint: "阅读页面底" },
      { name: "--shadow-color", type: "color", hint: "阴影基色" },
    ],
  },
  {
    id: "shape",
    label: "L3 · 组件形态",
    tokens: [
      { name: "--btn-radius", type: "text", hint: "主按钮圆角" },
      { name: "--btn-primary-bg", type: "color", hint: "主按钮底" },
      { name: "--btn-primary-fg", type: "color", hint: "主按钮字" },
      { name: "--panel-radius", type: "text", hint: "对话框壳圆角" },
      { name: "--stage-veil", type: "text", hint: "纸台纱厚 %" },
      { name: "--ornament-line", type: "color", hint: "装饰件描边" },
    ],
  },
  {
    id: "layout",
    label: "L3 · 布局密度",
    tokens: [
      { name: "--shell-pad-inline", type: "text", hint: "廊道内边距" },
      { name: "--shell-pad-inline-narrow", type: "text", hint: "窄屏廊道" },
      { name: "--header-width", type: "text", hint: "顶栏宽" },
      { name: "--header-gap-bottom", type: "text", hint: "顶栏下距" },
      { name: "--stage-width", type: "text", hint: "纸台宽" },
      { name: "--stage-pad", type: "text", hint: "纸台内衬" },
      { name: "--stage-shadow", type: "text", hint: "纸台阴影" },
    ],
  },
  {
    id: "mat",
    label: "L3 · 氛围材质",
    tokens: [
      { name: "--mat-fiber", type: "color", hint: "纤维 1" },
      { name: "--mat-fiber-2", type: "color", hint: "纤维 2" },
      { name: "--mat-edge", type: "color", hint: "廊道压暗" },
      { name: "--mat-center", type: "color", hint: "堂心提亮" },
    ],
  },
];

/** 皮肤文件必选 token（导出校验用），与 _contract.css 一致 */
export const REQUIRED_TOKENS = TOKEN_GROUPS[0].tokens.map((t) => t.name);

/**
 * 点选解析表：iframe 里被点中的元素从内向外匹配第一条，
 * 面板即聚焦它"所辖"的 token。装饰层特殊：M3 走生图流程。
 */
export const SELECTOR_TOKEN_MAP = [
  { match: ".app-button", label: "主按钮", tokens: ["--btn-primary-bg", "--btn-primary-fg", "--btn-radius", "--accent"] },
  { match: ".decor-quote", label: "题字横幅（装饰）", tokens: ["--ornament-line", "--gold", "--paper"] },
  { match: ".decor-layer", label: "装饰图层（M3 生图位）", tokens: [], decorSlot: true },
  { match: ".home-paper-stage", label: "纸台", tokens: ["--stage-veil", "--stage-width", "--stage-pad", "--stage-shadow", "--paper"] },
  { match: ".app-shell-header", label: "顶栏", tokens: ["--header-width", "--header-gap-bottom", "--ink", "--paper"] },
  { match: "button, [role='button']", label: "普通按钮/控件", tokens: ["--accent", "--ink", "--paper", "--line"] },
  { match: "input, textarea, select", label: "输入控件", tokens: ["--paper", "--ink", "--line", "--muted"] },
  { match: "h1, h2, h3, h4", label: "标题文字", tokens: ["--ink"] },
  { match: "p, span, li", label: "正文/次要文字", tokens: ["--ink", "--muted"] },
  { match: "body", label: "全局氛围", tokens: ["--bg", "--paper", "--ink", "--mat-edge", "--mat-center"] },
];

/** 导出前 WCAG 对比度自检的关键色对（前景, 背景, 期望等级） */
export const CONTRAST_PAIRS = [
  { fg: "--ink", bg: "--paper", label: "正文/纸面", min: 7 },
  { fg: "--ink", bg: "--bg", label: "正文/底色", min: 4.5 },
  { fg: "--muted", bg: "--paper", label: "次要字/纸面", min: 4.5 },
  { fg: "--btn-primary-fg", bg: "--btn-primary-bg", label: "主按钮字/底", min: 4.5 },
  { fg: "--danger", bg: "--paper", label: "危险字/纸面", min: 3 },
];
