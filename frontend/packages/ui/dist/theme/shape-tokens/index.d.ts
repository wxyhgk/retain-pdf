import type { ShapeToken } from "./types.js";
export type { ShapeToken, ShapeTokenKind } from "./types.js";
/** 模块 → 变量名前缀。别的模块不许用这些前缀（测试里查）。 */
export declare const SHAPE_TOKEN_MODULES: readonly [{
    readonly id: "global";
    readonly label: "全局旋钮";
    readonly prefixes: readonly ["--shape-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "button";
    readonly label: "按钮";
    readonly prefixes: readonly ["--btn-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "form";
    readonly label: "表单和弹层";
    readonly prefixes: readonly ["--field-", "--seg-", "--menu-", "--sheet-", "--panel-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "home-chrome";
    readonly label: "首页框架";
    readonly prefixes: readonly ["--topbar-", "--bottombar-", "--heading-", "--count-badge-", "--batchbar-", "--stage-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "book-card";
    readonly label: "书卡";
    readonly prefixes: readonly ["--card-", "--grid-", "--listrow-", "--collection-card-", "--shelf-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "surfaces";
    readonly label: "弹窗和浮层";
    readonly prefixes: readonly ["--dialog-", "--floating-", "--tooltip-", "--toast-", "--detail-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "reader";
    readonly label: "阅读器";
    readonly prefixes: readonly ["--reader-chrome-", "--reader-hud-", "--reader-tab-", "--reader-float-", "--reader-sheet-"];
    readonly tokens: ShapeToken[];
}, {
    readonly id: "details";
    readonly label: "小细节";
    readonly prefixes: readonly ["--selection-", "--scrollbar-", "--focus-", "--cursor-", "--check-"];
    readonly tokens: ShapeToken[];
}];
export declare const ALL_SHAPE_TOKENS: ShapeToken[];
//# sourceMappingURL=index.d.ts.map