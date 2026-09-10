import type { ReactElement } from "react";
import type { ProtectedPdfFile } from "../../pdf/useProtectedPdfFile.js";
import type { PageRowHeights } from "../../pdf/usePageRowSync.js";
import { type ReaderMetadata, type ReaderRegion, type ReaderRegionSelection } from "../../shared/data/reader-regions.js";
import type { LiveTranslationState } from "../../shared/data/live-translation-state.js";
export type ReaderCompareGridProps = {
    mode: string;
    bindShell: (node: HTMLDivElement | null) => void;
    shellEl: HTMLElement | null;
    userZoom: number;
    compareMode: boolean;
    /** 阅读区全宽（shell），用于 zoom% 相对整屏计算 */
    shellWidth: number;
    /** @deprecated 保留兼容，页宽不再用半栏 */
    compareColWidth?: number;
    rowHeights?: PageRowHeights;
    mountSource: boolean;
    mountTranslated: boolean;
    showSource: boolean;
    showTranslated: boolean;
    sourceOnly: boolean;
    sourceUrl: string;
    translatedUrl: string;
    sourceFile: ProtectedPdfFile | null;
    translatedFile: ProtectedPdfFile | null;
    onMetrics: () => void;
    onNumPagesChange: (pages: number, pane: "source" | "translated") => void;
    activeRegion?: ReaderRegion | null;
    regions?: ReaderRegion[];
    readerMetadata?: ReaderMetadata | null;
    onSelectRegion?: (selection: ReaderRegionSelection) => void;
    markdownSplit?: boolean;
    assistantSplit?: boolean;
    reversePanes?: boolean;
    liveTranslation?: LiveTranslationState;
    /** Running translation: stable source PDF on the left, source-backed live canvas on the right. */
    liveTranslationPair?: boolean;
};
export declare function resolveReaderGridPresentation({ mode, compareMode, showSource, showTranslated, markdownSplit, liveTranslationPair, }: Pick<ReaderCompareGridProps, "mode" | "compareMode" | "showSource" | "showTranslated"> & {
    markdownSplit: boolean;
    liveTranslationPair?: boolean;
}): {
    mode: string;
    compareMode: boolean;
    showSource: boolean;
    showTranslated: boolean;
};
export declare function resolveReaderPageWidthBasis(shellWidth: number, sidePanelSplit: boolean, viewportWidth?: number): number;
export declare function liveTranslationPendingCopy(state: LiveTranslationState | undefined): string;
export declare function ReaderCompareGrid(props: ReaderCompareGridProps): ReactElement;
//# sourceMappingURL=ReaderCompareGrid.d.ts.map