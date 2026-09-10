import { type ProtectedPdfFile } from "./useProtectedPdfFile.js";
import type { PageRowHeights } from "./usePageRowSync.js";
import { type ReaderPaneId } from "./reader-dom-contract.js";
import { type ReaderMetadata, type ReaderRegion, type ReaderRegionSelection } from "../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../shared/data/live-translation-state.js";
export type PdfDocumentPaneProps = {
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
    onLoadError?: (error: Error, pane: ReaderPaneId) => void;
    onNumPagesChange?: (numPages: number, pane: ReaderPaneId) => void;
    activeRegion?: ReaderRegion | null;
    regions?: ReaderRegion[];
    readerMetadata?: ReaderMetadata | null;
    onSelectRegion?: (selection: ReaderRegionSelection) => void;
    liveTranslation?: LiveTranslationState;
    /** Render live translation blocks in this pane, independent of source/translated identity. */
    showLiveTranslation?: boolean;
    /** Non-fatal live-translation wait state shown over the still-valid source canvas. */
    liveTranslationPendingLabel?: string;
};
export declare const PdfDocumentPane: import("react").NamedExoticComponent<PdfDocumentPaneProps & import("react").RefAttributes<HTMLElement>>;
//# sourceMappingURL=PdfDocumentPane.d.ts.map