import type { ReactNode } from "react";
import type { AiCitationLike } from "../../../external.js";
import type { ReaderAskStoreMessage } from "./reader-ask-tree.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import type { ReaderSelection } from "../../../shared/data/reader-regions.js";
export type ReaderAssistantSurfaceProps = {
    jobId: string;
    messages: readonly ReaderAskStoreMessage[];
    citationsByMessageId: Record<string, AiCitationLike[]>;
    progressByMessageId: Record<string, string>;
    streamingAssistantId: string;
    isRunning: boolean;
    missingLlmKey: boolean;
    branchBusy: boolean;
    agentRequestBlocked?: boolean;
    agentOperationPanel?: ReactNode;
    assistantMode?: ReaderAssistantMode;
    onAssistantModeChange?: (mode: ReaderAssistantMode) => void;
    onJumpCitation?: (citation: AiCitationLike) => void;
    onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
    selectionContext?: ReaderSelection | null;
    onClearSelectionContext?: () => void;
};
export declare function ReaderAssistantSurface({ jobId, messages, citationsByMessageId, progressByMessageId, streamingAssistantId, isRunning, missingLlmKey, branchBusy, agentRequestBlocked, agentOperationPanel, assistantMode, onAssistantModeChange, onJumpCitation, onBranchFromAnswer, selectionContext, onClearSelectionContext, }: ReaderAssistantSurfaceProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderAssistantSurface.d.ts.map