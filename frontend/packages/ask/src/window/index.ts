// `@retainpdf/ask/window`：提问窗（React）。宿主懒加载这一块：`lazy(() => import("@retainpdf/ask/window"))`。
export { default, default as AskWindow, type AskWindowProps } from "./AskWindow.js";
// 标题栏的下拉（阅读页的对话菜单用它，和「···」一个样子）。
export { AskHeadMenu, type AskHeadMenuProps, type AskHeaderMenuItem } from "./head-menu.js";
