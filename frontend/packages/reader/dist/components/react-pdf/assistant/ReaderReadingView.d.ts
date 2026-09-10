import type { ReactNode } from "react";
import type { AiCitationLike } from "../../../external.js";
import type { ReaderSelection } from "../../../shared/data/reader-regions.js";
export type ReaderReadingViewProps = {
    jobId: string;
    empty: boolean;
    citationsByMessageId: Record<string, AiCitationLike[]>;
    progressByMessageId: Record<string, string>;
    streamingAssistantId: string;
    isRunning: boolean;
    missingLlmKey: boolean;
    branchBusy: boolean;
    composerDisabled?: boolean;
    onModeChange?: (mode: "reading" | "operations") => void;
    onJumpCitation?: (citation: AiCitationLike) => void;
    onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
    selectionContext?: ReaderSelection | null;
    onClearSelectionContext?: () => void;
    footerExtra?: ReactNode;
};
export declare function ReaderReadingView({ jobId, empty, citationsByMessageId, progressByMessageId, streamingAssistantId, isRunning, missingLlmKey, branchBusy, composerDisabled, onModeChange, onJumpCitation, onBranchFromAnswer, selectionContext, onClearSelectionContext, footerExtra, }: ReaderReadingViewProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderReadingView.d.ts.map