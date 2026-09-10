import { type MessageState } from "@assistant-ui/react";
import type { AiCitationLike } from "../../../external.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import { type ReaderSelection } from "../../../shared/data/reader-regions.js";
export declare function assistantMessageText(message: Pick<MessageState, "content">): string;
export declare function ThinkingRow({ label }: {
    label: string;
}): import("react").JSX.Element;
export declare function UserMessageRow({ message }: {
    message: MessageState;
}): import("react").JSX.Element;
export type AssistantMessageRowProps = {
    jobId: string;
    message: MessageState;
    citations: AiCitationLike[];
    progress: string;
    streaming: boolean;
    branchBusy: boolean;
    onJumpCitation?: (citation: AiCitationLike) => void;
    onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
};
export declare function AssistantMessageRow({ jobId, message, citations, progress, streaming, branchBusy, onJumpCitation, onBranchFromAnswer, }: AssistantMessageRowProps): import("react").JSX.Element;
export declare function ThreadMessageList({ jobId, citationsByMessageId, progressByMessageId, streamingAssistantId, isRunning, branchBusy, onJumpCitation, onBranchFromAnswer, }: {
    jobId: string;
    citationsByMessageId: Record<string, AiCitationLike[]>;
    progressByMessageId: Record<string, string>;
    streamingAssistantId: string;
    isRunning: boolean;
    branchBusy: boolean;
    onJumpCitation?: (citation: AiCitationLike) => void;
    onBranchFromAnswer?: (assistantMessageId: string) => void | Promise<boolean | void>;
}): import("react").JSX.Element;
export declare function ModeSwitch({ mode, disabled, onChange, }: {
    mode: ReaderAssistantMode;
    disabled: boolean;
    onChange?: (mode: ReaderAssistantMode) => void;
}): import("react").JSX.Element;
export declare function SelectionBanner({ selectionContext, onClear, }: {
    selectionContext?: ReaderSelection | null;
    onClear?: () => void;
}): import("react").JSX.Element;
export declare function AssistantComposer({ isRunning, branchBusy, mode, onModeChange, selectionContext, onClearSelectionContext, }: {
    isRunning: boolean;
    branchBusy: boolean;
    mode: ReaderAssistantMode;
    onModeChange?: (mode: ReaderAssistantMode) => void;
    selectionContext?: ReaderSelection | null;
    onClearSelectionContext?: () => void;
}): import("react").JSX.Element;
export declare function LockedComposer(): import("react").JSX.Element;
//# sourceMappingURL=reader-assistant-primitives.d.ts.map