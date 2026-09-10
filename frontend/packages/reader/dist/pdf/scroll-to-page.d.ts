import { type ReaderPaneId } from "./reader-dom-contract.js";
export type PageScrollProgress = {
    page: number;
    fraction: number;
};
/** 视口内「阅读线」相对滚动容器顶的偏移（与 measure/apply / HUD 当前页必须一致） */
export declare const READER_SCROLL_FOCUS_PX = 48;
/** Y coordinate of reading focus line in viewport coords */
export declare function readingFocusY(root: HTMLElement, readingOffsetPx?: number): number;
/**
 * Pick best page element under focus line from a list of [data-reader-page] elements.
 * Focus rule: last page with size>=8 whose top <= focusY+1; else first below / last above.
 */
export declare function pickPageAtFocus(pages: HTMLElement[], focusY: number): {
    el: HTMLElement;
    page: number;
    fraction: number;
} | null;
export declare function measurePageScrollProgress(root: HTMLElement | null | undefined, pane?: ReaderPaneId | null, readingOffsetPx?: number): PageScrollProgress | null;
export declare function applyPageScrollProgress(root: HTMLElement | null | undefined, progress: PageScrollProgress, behavior?: ScrollBehavior, pane?: ReaderPaneId | null, readingOffsetPx?: number): boolean;
export declare function scrollShellToPage(root: HTMLElement | null | undefined, pageNumber: number, behavior?: ScrollBehavior, pane?: ReaderPaneId | null): boolean;
/** @deprecated 兼容旧名 */
export declare function scrollPaneToPage(root: HTMLElement | null | undefined, pageNumber: number, behavior?: ScrollBehavior): boolean;
/**
 * 用锁定的 progress 恢复位置。
 * 布局未稳时重试；同一 progress 反复 apply 是幂等的（不会越滚越远）。
 */
export declare function alignShellToProgress(getRoot: () => HTMLElement | null | undefined, progress: PageScrollProgress, options?: {
    behavior?: ScrollBehavior;
    pane?: ReaderPaneId | null;
    delaysMs?: number[];
    onDone?: () => void;
}): () => void;
export declare function alignShellToPage(getRoot: () => HTMLElement | null | undefined, pageNumber: number, options?: {
    behavior?: ScrollBehavior;
    pane?: ReaderPaneId | null;
    delaysMs?: number[];
    onDone?: () => void;
}): () => void;
export declare function clampPageNumber(page: number, numPages: number): number;
export declare function cloneProgress(p: PageScrollProgress): PageScrollProgress;
//# sourceMappingURL=scroll-to-page.d.ts.map