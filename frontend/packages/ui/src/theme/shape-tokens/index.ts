// 形状变量登记表（主题完全可自定义第 2 步）：按模块一个文件，各模块只改自己的文件。
// 字体（--font-sans / --font-display / --font-mono）在 styles/themes/_component-defaults.css，不在这张表。
import { BOOK_CARD_SHAPE_TOKENS } from "./book-card.js";
import { DETAILS_SHAPE_TOKENS } from "./details.js";
import { BUTTON_SHAPE_TOKENS } from "./button.js";
import { FORM_SHAPE_TOKENS } from "./form.js";
import { GLOBAL_SHAPE_TOKENS } from "./global.js";
import { HOME_CHROME_SHAPE_TOKENS } from "./home-chrome.js";
import { READER_SHAPE_TOKENS } from "./reader.js";
import { SURFACE_SHAPE_TOKENS } from "./surfaces.js";
import type { ShapeToken } from "./types.js";

export type { ShapeToken, ShapeTokenKind } from "./types.js";

/** 模块 → 变量名前缀。别的模块不许用这些前缀（测试里查）。 */
export const SHAPE_TOKEN_MODULES = [
  { id: "global", label: "全局旋钮", prefixes: ["--shape-"], tokens: GLOBAL_SHAPE_TOKENS },
  { id: "button", label: "按钮", prefixes: ["--btn-"], tokens: BUTTON_SHAPE_TOKENS },
  { id: "form", label: "表单和弹层", prefixes: ["--field-", "--seg-", "--menu-", "--sheet-", "--panel-"], tokens: FORM_SHAPE_TOKENS },
  { id: "home-chrome", label: "首页框架", prefixes: ["--topbar-", "--bottombar-", "--heading-", "--count-badge-", "--batchbar-", "--stage-"], tokens: HOME_CHROME_SHAPE_TOKENS },
  { id: "book-card", label: "书卡", prefixes: ["--card-", "--grid-", "--listrow-", "--collection-card-", "--shelf-"], tokens: BOOK_CARD_SHAPE_TOKENS },
  { id: "surfaces", label: "弹窗和浮层", prefixes: ["--dialog-", "--floating-", "--tooltip-", "--toast-", "--detail-"], tokens: SURFACE_SHAPE_TOKENS },
  { id: "reader", label: "阅读器", prefixes: ["--reader-chrome-", "--reader-hud-", "--reader-tab-", "--reader-float-", "--reader-sheet-"], tokens: READER_SHAPE_TOKENS },
  { id: "details", label: "小细节", prefixes: ["--selection-", "--scrollbar-", "--focus-", "--cursor-", "--check-"], tokens: DETAILS_SHAPE_TOKENS },
] as const satisfies readonly { id: string; label: string; prefixes: readonly string[]; tokens: ShapeToken[] }[];

export const ALL_SHAPE_TOKENS: ShapeToken[] = SHAPE_TOKEN_MODULES.flatMap((module) => module.tokens);
