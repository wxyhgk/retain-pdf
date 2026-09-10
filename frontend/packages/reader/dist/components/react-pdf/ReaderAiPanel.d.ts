import { type AiCitationLike } from "../../external.js";
import type { ReaderSelection } from "../../shared/data/reader-regions.js";
export type ReaderAiPanelProps = {
    open: boolean;
    jobId: string;
    documentId?: string;
    onClose: () => void;
    /** page_idx 为 0 基；由阅读器 goToPage(page_idx+1) */
    onJumpCitation: (citation: AiCitationLike) => void;
    onDocumentCommitted?: (input: {
        documentId: string;
        revision: string;
    }) => void;
    layout?: "floating" | "docked" | "workspace";
    side?: "left" | "right";
    selectionContext?: ReaderSelection | null;
    onClearSelectionContext?: () => void;
};
export declare function ReaderAiPanel({ open, jobId, documentId, onClose, onJumpCitation, onDocumentCommitted, layout, side, selectionContext, onClearSelectionContext, }: ReaderAiPanelProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderAiPanel.d.ts.map