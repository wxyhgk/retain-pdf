import { type PageScrollProgress } from "../pdf/scroll-to-page.js";
import type { ReaderPaneId } from "../pdf/reader-dom-contract.js";
import { type XrefIndex, type XrefTarget } from "../shared/content/reader-xrefs.js";
export declare const XREF_PREVIEW_DELAY_MS = 250;
export type XrefPreview = {
    target: XrefTarget;
    pane: ReaderPaneId;
    /** 引用那几个字在屏幕上的位置（预览挂在它旁边）。 */
    anchor: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    };
};
/** 前进后退的两个栈（纯函数，便于测试）：跳之前把当前位置压进「后退」，清空「前进」。 */
export type XrefHistory = {
    back: PageScrollProgress[];
    forward: PageScrollProgress[];
};
export declare function pushXrefHistory(history: XrefHistory, here: PageScrollProgress): XrefHistory;
/** 后退 / 前进一步：返回要去的位置和新的栈；那一边是空的返回 null。 */
export declare function stepXrefHistory(history: XrefHistory, here: PageScrollProgress, direction: "back" | "forward"): {
    to: PageScrollProgress;
    history: XrefHistory;
};
export declare function useReaderXrefs({ shellEl, index, primaryPane, follow, }: {
    shellEl: HTMLElement | null;
    index: XrefIndex;
    primaryPane: ReaderPaneId;
    /** 跳到这一块（阅读页的 jumpToAnchor）。 */
    follow: (target: XrefTarget, pane: ReaderPaneId) => void;
}): {
    preview: XrefPreview;
    closePreview: () => void;
    canGoBack: boolean;
    backPage: number;
    goBack: () => boolean;
};
//# sourceMappingURL=use-reader-xrefs.d.ts.map