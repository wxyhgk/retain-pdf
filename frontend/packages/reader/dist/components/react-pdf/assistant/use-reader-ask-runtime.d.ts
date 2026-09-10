import type { AgentConfirmationMode } from "@retainpdf/api/agent-runtime-settings";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import type { ReaderSelection } from "../../../shared/data/reader-regions.js";
export type { ReaderAskStoreMessage } from "./reader-ask-tree.js";
export type { ReaderAskSessionSummary } from "./use-reader-conversation.js";
export { loadReaderRequestSnapshot, saveReaderRequestSnapshot, } from "./reader-request-snapshots.js";
export type { ReaderRequestSnapshot } from "./reader-request-snapshots.js";
export declare function useReaderAskRuntime(options: {
    jobId: string;
    documentId?: string;
    enabled: boolean;
    selectionContext?: ReaderSelection | null;
    onDocumentCommitted?: (input: {
        documentId: string;
        revision: string;
    }) => void;
}): {
    citationsByMessageId: Record<string, import("../../../external.js").AiCitationLike[]>;
    progressByMessageId: Record<string, string>;
    contentByMessageId: Record<string, string>;
    streamingAssistantId: string;
    isRunning: boolean;
    messages: import("./reader-ask-tree.js").ReaderAskStoreMessage[];
    sessions: import("./use-reader-conversation.js").ReaderAskSessionSummary[];
    activeConversationId: string;
    sessionBusy: boolean;
    sessionError: string;
    submitQuestion: (questionInput: string) => Promise<void>;
    retryAnswer: (assistantMessageId: string) => Promise<void>;
    cancelAnswer: () => Promise<void>;
    newSession: () => Promise<void>;
    switchSession: (conversationId: string) => Promise<void>;
    removeSession: (conversationId: string) => Promise<void>;
    renameSession: (conversationId: string, title: string) => Promise<void>;
    branchFromAnswer: (assistantMessageId: string) => Promise<boolean>;
    agentOperations: {
        entries: import("./use-reader-agent-operations.js").ReaderAgentOperationEntry[];
        confirmationMode: AgentConfirmationMode;
        runtimeRestarting: boolean;
        runtimeCredentialConfigured: boolean;
        perform: (action: "run" | "cancel" | "commit" | "retry", operation: import("@retainpdf/api/document-operations").AgentOperationView, options?: import("./use-reader-agent-operations.js").ReaderAgentOperationPerformOptions) => Promise<void>;
        loadCandidate: (operation: import("@retainpdf/api/document-operations").AgentOperationView) => Promise<Blob>;
    };
    assistantMode: ReaderAssistantMode;
    setAssistantMode: import("react").Dispatch<import("react").SetStateAction<ReaderAssistantMode>>;
};
//# sourceMappingURL=use-reader-ask-runtime.d.ts.map