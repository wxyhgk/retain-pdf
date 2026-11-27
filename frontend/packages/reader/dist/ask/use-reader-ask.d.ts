import { type ReactElement } from "react";
import type { ReaderAskPort } from "../contracts/ask.js";
import type { ReaderMenuContext, ReaderMenuItem } from "../extensions/types.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import type { RegionPdfDocument } from "../pdf/RegionCanvas.js";
import { type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import type { AskMark } from "./ReaderAskMarks.js";
export declare function useReaderAsk({ port, documentId, jobId, versionId, regions, metadata, bookmarks, hoveredItemId, resetKey, goToPage, pageCount, editBlock, jumpToBlock, pdfDocuments, currentPage, visibleMode, activePanel, }: {
    port: ReaderAskPort | null;
    documentId: string;
    jobId: string;
    versionId: string | null;
    regions: readonly ReaderRegion[];
    metadata: ReaderMetadata | null;
    bookmarks: readonly PdfOutlineNode[];
    /** 悬停框现在认出的块。 */
    hoveredItemId: () => string | null;
    resetKey: string;
    goToPage: (page: number, pane?: "source" | "translated") => void;
    pageCount: number;
    /** 改这一块的译文（这本书现在不能改是 null）。 */
    editBlock: ((itemId: string, draft?: string) => void) | null;
    jumpToBlock: (itemId: string, pane?: "source" | "translated") => void;
    /** 各栏读好的 PDF（截图按要的清晰度重新画）。 */
    pdfDocuments: {
        source: RegionPdfDocument | null;
        translated: RegionPdfDocument | null;
    };
    currentPage: () => number;
    visibleMode: "source" | "compare" | "translated";
    /** 阅读页右边停着的面板（Markdown）；停上了提问窗就不贴右边（右边只停一个）。 */
    activePanel?: string | null;
}): {
    marks: AskMark[];
    onMark: (mark: AskMark) => Promise<void>;
    menuItems: (context: ReaderMenuContext) => ReaderMenuItem[];
    panel: ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
    overlay: ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
    cropping: boolean;
    open: () => Promise<void>;
    toggle: () => void;
    showing: boolean;
    reserveRight: number;
    enabled: boolean;
};
//# sourceMappingURL=use-reader-ask.d.ts.map