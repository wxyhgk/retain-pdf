import type { ReaderMode } from "./use-reader-session.js";
export type ReaderKeyAction = "next-page" | "prev-page" | "first-page" | "last-page" | "zoom-in" | "zoom-out" | "zoom-reset" | "mode-source" | "mode-compare" | "mode-translated" | "doc-dark";
export type ReaderKeyBinding = {
    action: ReaderKeyAction;
    /** 匹配 event.key；单字符（字母/符号）不区分大小写，多字符（方向键等）精确匹配 */
    keys: readonly string[];
    /** mode-* 动作对应的模式；sourceOnly 时仅 source 可用 */
    mode?: ReaderMode;
    /** 需要已加载页数（numPages > 0）才触发，否则不拦截默认行为 */
    requiresPages?: boolean;
};
export declare const READER_KEY_BINDINGS: readonly ReaderKeyBinding[];
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
export declare const READER_SHORTCUT_HELP: readonly ReaderShortcutHelpGroup[];
/** 按 event.key 命中第一个绑定；单字符键不区分大小写。 */
export declare function matchReaderKeyBinding(key: string): ReaderKeyBinding | null;
//# sourceMappingURL=reader-keyboard-map.d.ts.map