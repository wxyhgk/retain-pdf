import type { ReactNode } from "react";
import type { AiCitationLike } from "../../../external.js";
export type ReaderOperationsViewProps = {
    jobId: string;
    empty: boolean;
    citationsByMessageId: Record<string, AiCitationLike[]>;
    progressByMessageId: Record<string, string>;
    streamingAssistantId: string;
    isRunning: boolean;
    missingLlmKey: boolean;
    branchBusy: boolean;
    agentRequestBlocked?: boolean;
    agentOperationPanel?: ReactNode;
    onModeChange?: (mode: "reading" | "operations") => void;
    onJumpCitation?: (citation: AiCitationLike) => void;
    onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
};
export declare function ReaderOperationsView({ jobId, empty, citationsByMessageId, progressByMessageId, streamingAssistantId, isRunning, missingLlmKey, branchBusy, agentRequestBlocked, agentOperationPanel, onModeChange, onJumpCitation, onBranchFromAnswer, }: ReaderOperationsViewProps): import("react").JSX.Element;
//# sourceMappingURL=ReaderOperationsView.d.ts.map