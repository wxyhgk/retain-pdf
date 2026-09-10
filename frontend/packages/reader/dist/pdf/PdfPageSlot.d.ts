import { type ReaderPaneId } from "./reader-dom-contract.js";
import { type ReaderRegionHighlight, type ReaderRegionSelection } from "../shared/data/reader-regions.js";
import type { LiveTranslationLayoutPage } from "@retainpdf/api/live-translation";
import type { LiveTranslationPageState } from "../shared/data/live-translation-state.js";
export declare const DEFAULT_ASPECT = 1.414;
export type PdfPageSlotProps = {
    pageNumber: number;
    width: number;
    devicePixelRatio: number;
    scrollRoot: HTMLElement | null;
    pane?: ReaderPaneId;
    /** 对照左右同页 max 高度 */
    syncedMinHeight?: number;
    onMetrics?: () => void;
    /** windowed rendering: aspect cache from pane to keep placeholder height correct */
    cachedAspect?: number;
    onAspectChange?: (pageNumber: number, aspect: number) => void;
    /** pane-level windowing sentinel registration (shared observer also handles windowing) */
    sentinelRef?: (el: HTMLDivElement | null) => void;
    regionHighlight?: ReaderRegionHighlight | null;
    regionTargets?: ReaderRegionHighlight[];
    onSelectRegion?: (selection: ReaderRegionSelection) => void;
    liveTranslationLayout?: LiveTranslationLayoutPage;
    liveTranslationPage?: LiveTranslationPageState;
    showLiveTranslation?: boolean;
};
declare function PdfPageSlotInner({ pageNumber, width, devicePixelRatio, scrollRoot, pane, syncedMinHeight, onMetrics, cachedAspect, onAspectChange, sentinelRef, regionHighlight, regionTargets, onSelectRegion, liveTranslationLayout, liveTranslationPage, showLiveTranslation, }: PdfPageSlotProps): import("react").JSX.Element;
export declare const PdfPageSlot: import("react").MemoExoticComponent<typeof PdfPageSlotInner>;
export {};
//# sourceMappingURL=PdfPageSlot.d.ts.map