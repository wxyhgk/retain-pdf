// 阅读器键位的唯一真源：实现（use-reader-keyboard）按 READER_KEY_BINDINGS 分发，
// 说明浮层（ReaderShortcutsHelp）按 READER_SHORTCUT_HELP 渲染。
// j/↓/PageDown 下页 · k/↑/PageUp 上页 · Home/End 首末页
// +/- 缩放 · 0 重置模式默认缩放 · 1/2/3 原文/对照/译文

import type { ReaderMode } from "./use-reader-session.js";

export type ReaderKeyAction =
  | "next-page"
  | "prev-page"
  | "first-page"
  | "last-page"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | "mode-source"
  | "mode-compare"
  | "mode-translated";

export type ReaderKeyBinding = {
  action: ReaderKeyAction;
  /** 匹配 event.key；单字符（字母/符号）不区分大小写，多字符（方向键等）精确匹配 */
  keys: readonly string[];
  /** mode-* 动作对应的模式；sourceOnly 时仅 source 可用 */
  mode?: ReaderMode;
  /** 需要已加载页数（numPages > 0）才触发，否则不拦截默认行为 */
  requiresPages?: boolean;
};

export const READER_KEY_BINDINGS: readonly ReaderKeyBinding[] = [
  { action: "mode-source", keys: ["1"], mode: "source" },
  { action: "mode-compare", keys: ["2"], mode: "compare" },
  { action: "mode-translated", keys: ["3"], mode: "translated" },
  { action: "zoom-in", keys: ["+", "="] },
  { action: "zoom-out", keys: ["-", "_"] },
  { action: "zoom-reset", keys: ["0"] },
  { action: "next-page", keys: ["j", "ArrowDown", "PageDown"], requiresPages: true },
  { action: "prev-page", keys: ["k", "ArrowUp", "PageUp"], requiresPages: true },
  { action: "first-page", keys: ["Home"], requiresPages: true },
  { action: "last-page", keys: ["End"], requiresPages: true },
];

export type ReaderShortcutHelpItem = {
  /** 该条目覆盖的实现动作；供防漂移测试核对，纯鼠标提示为空 */
  actions: readonly ReaderKeyAction[];
  keys: string;
  desc: string;
};

export type ReaderShortcutHelpGroup = {
  title: string;
  items: readonly ReaderShortcutHelpItem[];
};

export const READER_SHORTCUT_HELP: readonly ReaderShortcutHelpGroup[] = [
  {
    title: "翻页",
    items: [
      { actions: ["next-page"], keys: "J · ↓ · PgDn", desc: "下一页" },
      { actions: ["prev-page"], keys: "K · ↑ · PgUp", desc: "上一页" },
      { actions: ["first-page", "last-page"], keys: "Home / End", desc: "首页 / 末页" },
      { actions: [], keys: "点底栏页码", desc: "输入页码跳转" },
    ],
  },
  {
    title: "缩放",
    items: [
      { actions: ["zoom-in", "zoom-out"], keys: "+ / −", desc: "放大 / 缩小" },
      { actions: ["zoom-reset"], keys: "0", desc: "重置为模式默认" },
      { actions: [], keys: "点百分比", desc: "重置为模式默认" },
    ],
  },
  {
    title: "搜索",
    items: [
      { actions: [], keys: "⌘F / Ctrl+F", desc: "在书里搜索（光标已在搜索框时再按，用浏览器自己的查找）" },
      { actions: [], keys: "Enter / Shift+Enter", desc: "下一处 / 上一处" },
      { actions: [], keys: "Esc", desc: "收起搜索" },
    ],
  },
  {
    title: "画笔",
    items: [
      { actions: [], keys: "P", desc: "进入 / 退出画笔（书页上右键也能选笔和颜色）" },
      { actions: [], keys: "Esc", desc: "退出画笔" },
      { actions: [], keys: "⌘Z / Ctrl+Z", desc: "画笔模式下撤销" },
      { actions: [], keys: "Shift+右键", desc: "浏览器自己的右键菜单" },
    ],
  },
  {
    title: "待处理",
    items: [
      { actions: [], keys: "N / Shift+N", desc: "跳到下一处 / 上一处要看一眼的段落（底栏「待处理」）" },
    ],
  },
  {
    title: "模式",
    items: [
      { actions: ["mode-source"], keys: "1", desc: "原文" },
      { actions: ["mode-compare"], keys: "2", desc: "对照" },
      { actions: ["mode-translated"], keys: "3", desc: "译文" },
    ],
  },
  {
    title: "改译文",
    items: [
      { actions: [], keys: "E", desc: "改鼠标停着的那一段" },
      { actions: [], keys: "Alt+↑ / Alt+↓", desc: "改上一段 / 下一段" },
      { actions: [], keys: "⌘Enter / Ctrl+Enter", desc: "保存" },
    ],
  },
];

/** 按 event.key 命中第一个绑定；单字符键不区分大小写。 */
export function matchReaderKeyBinding(key: string): ReaderKeyBinding | null {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  for (const binding of READER_KEY_BINDINGS) {
    const matched = binding.keys.some((candidate) =>
      candidate.length === 1 ? candidate === normalized : candidate === key,
    );
    if (matched) return binding;
  }
  return null;
}
