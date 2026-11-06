import { type ReaderPaneId } from "./reader-dom-contract.js";
import { type ReaderRegionHighlight } from "../shared/data/reader-regions.js";
import type { ReaderLiveTranslationLayoutPage as LiveTranslationLayoutPage } from "../contracts/live-translation.js";
import type { LiveTranslationPageState } from "../shared/data/live-translation-state.js";
export declare const DEFAULT_ASPECT = 1.414;
type PdfPageSlotProps = {
    pageNumber: number;
    width: number;
    devicePixelRatio: number;
    pane?: ReaderPaneId;
    /** pane-level windowing decides whether the page canvas should be mounted */
    active?: boolean;
    /** 眼前的页才挂文字层和实时译文框（PdfDocumentPane 的 TEXT_ROOT_MARGIN）；不给就挂（单测、没有 IntersectionObserver）。 */
    textLayer?: boolean;
    /** 对照左右同页 max 高度 */
    syncedMinHeight?: number;
    onMetrics?: () => void;
    /** windowed rendering: aspect cache from pane to keep placeholder height correct */
    cachedAspect?: number;
    onAspectChange?: (pageNumber: number, aspect: number) => void;
    /** pane-level windowing sentinel registration (the pane observer owns activeness) */
    sentinelRef?: (el: HTMLDivElement | null) => void;
    regionHighlight?: ReaderRegionHighlight | null;
    regionTargets?: ReaderRegionHighlight[];
    /**
     * 对照阅读时左右两栏共享的悬停块（itemId）。给了 onHoverRegion 就由外面管，
     * 鼠标在哪栏，两栏都画同一块的框；没给（单栏）就用本页自己的状态。
     */
    hoveredRegionId?: string | null;
    onHoverRegion?: (itemId: string | null) => void;
    liveTranslationLayout?: LiveTranslationLayoutPage;
    liveTranslationPage?: LiveTranslationPageState;
    showLiveTranslation?: boolean;
};
declare function PdfPageSlotInner({ pageNumber, width, devicePixelRatio, pane, active, textLayer, syncedMinHeight, onMetrics, cachedAspect, onAspectChange, sentinelRef, regionHighlight, regionTargets, hoveredRegionId, onHoverRegion, liveTranslationLayout, liveTranslationPage, showLiveTranslation, }: PdfPageSlotProps): import("react").JSX.Element;
export declare const PdfPageSlot: import("react").MemoExoticComponent<typeof PdfPageSlotInner>;
export {};
//# sourceMappingURL=PdfPageSlot.d.ts.map