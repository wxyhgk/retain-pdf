import { type ReactElement } from "react";
import { type PdfOutlineNode } from "../../pdf/pdf-outline.js";
export declare function ReaderBookmarkTree({ nodes, currentPage, onJumpPage, }: {
    nodes: readonly PdfOutlineNode[];
    currentPage: number;
    onJumpPage: (page: number) => void;
}): ReactElement;
//# sourceMappingURL=ReaderBookmarkTree.d.ts.map