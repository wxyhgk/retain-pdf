import { type PdfOutlineNode } from "./pdf-outline.js";
import type { ReactNode } from "react";
import { type ProtectedPdfFile } from "./useProtectedPdfFile.js";
import type { PageRowHeights } from "./usePageRowSync.js";
import { type ReaderPaneId } from "./reader-dom-contract.js";
import { type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import { type LiveTranslationState } from "../shared/data/live-translation-state.js";
type PdfDocumentPaneProps = {
    pane: ReaderPaneId;
    url?: string;
    preloadedFile?: ProtectedPdfFile | null;
    userZoom?: number;
    visible?: boolean;
    emptyLabel?: string;
    scrollRoot?: HTMLElement | null;
    /**
     * 阅读区全宽（shell clientWidth）。
     * 页绘制宽 = pageWidthFromShell(此值, userZoom)，不随单栏/半栏变化。
     */
    pageWidthOverride?: number | null;
    /** 对照行高同步 */
    rowHeights?: PageRowHeights;
    onMetrics?: () => void;
    onLoadSuccess?: (info: {
        numPages: number;
        pane: ReaderPaneId;
    }) => void;
    /** PDF 自带的书签（读完才回调；没有书签是空数组）。不给就不读。 */
    onOutline?: (outline: PdfOutlineNode[], pane: ReaderPaneId) => void;
    onLoadError?: (error: Error, pane: ReaderPaneId) => void;
    onNumPagesChange?: (numPages: number, pane: ReaderPaneId) => void;
    activeRegion?: ReaderRegion | null;
    regions?: ReaderRegion[];
    readerMetadata?: ReaderMetadata | null;
    /** 对照阅读时两栏共享的悬停块（见 PdfPageSlot）。 */
    hoveredRegionId?: string | null;
    onHoverRegion?: (itemId: string | null) => void;
    liveTranslation?: LiveTranslationState;
    /** Render live translation blocks in this pane, independent of source/translated identity. */
    showLiveTranslation?: boolean;
    /** Non-fatal live-translation wait state shown over the still-valid source canvas. */
    liveTranslationPendingLabel?: string;
    /** 栏右上角动作（如源栏「译文」叠加开关）。 */
    paneAction?: ReactNode;
};
export declare const PdfDocumentPane: import("react").NamedExoticComponent<PdfDocumentPaneProps & import("react").RefAttributes<HTMLElement>>;
export {};
//# sourceMappingURL=PdfDocumentPane.d.ts.map