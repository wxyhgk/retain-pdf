import { type ReactElement } from "react";
import type { ReaderAskPort } from "../contracts/ask.js";
import type { ReaderMenuContext, ReaderMenuItem } from "../extensions/types.js";
import type { PdfOutlineNode } from "../pdf/pdf-outline.js";
import { type ReaderMetadata, type ReaderRegion } from "../shared/data/reader-regions.js";
import type { AskMark } from "./ReaderAskMarks.js";
export declare function useReaderAsk({ port, documentId, jobId, versionId, regions, metadata, bookmarks, hoveredItemId, resetKey, goToPage, pageCount, }: {
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
}): {
    marks: AskMark[];
    onMark: (mark: AskMark) => Promise<void>;
    menuItems: (context: ReaderMenuContext) => ReaderMenuItem[];
    panel: ReactElement<unknown, string | import("react").JSXElementConstructor<any>>;
    open: () => Promise<void>;
    enabled: boolean;
};
//# sourceMappingURL=use-reader-ask.d.ts.map