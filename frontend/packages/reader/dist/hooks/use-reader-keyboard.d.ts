import type { ReaderMode } from "./use-reader-session.js";
export type ReaderKeyboardApi = {
    mode: ReaderMode;
    sourceOnly: boolean;
    setMode: (mode: ReaderMode) => void;
    userZoom: number;
    onZoomChange: (zoom: number) => void;
    currentPage: number;
    numPages: number;
    goToPage: (page: number) => void;
    /** 「深色文档」开关（D）；不给就不拦这个键。 */
    toggleDocDark?: () => void;
    enabled?: boolean;
};
/** 焦点落在阅读辅助面板（Markdown / AI / 批注 / 终端…）里时，全局快捷键一律不处理。
 *
 * 所有 dock 面板都经 ReaderPanelShell 渲染，外壳类名是 `.reader-notes-panel`。
 * Markdown 的块是 tabIndex=0 的 div、AI 回答区是普通可滚动容器 —— 不在
 * isEditableTarget 的白名单里，原来 ↓ / PgDn / Home / End 被这里拦下去翻 PDF，
 * 面板自己反而滚不动。面板内的 Esc 关闭由 ReaderPanelShell 自己监听，不受影响；
 * 块上的 Enter / 空格（跳到对应页）由面板自己的监听处理。
 */
export declare const READER_PANEL_FOCUS_SELECTOR = ".reader-notes-panel";
export declare function isReaderPanelTarget(target: EventTarget | null): boolean;
export declare function resolveReaderModeShortcut(key: string, sourceOnly: boolean): ReaderMode | null;
export declare function useReaderKeyboard(api: ReaderKeyboardApi): void;
//# sourceMappingURL=use-reader-keyboard.d.ts.map