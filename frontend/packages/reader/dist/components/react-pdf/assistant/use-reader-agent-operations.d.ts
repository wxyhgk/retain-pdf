import { type AgentOperationView } from "@retainpdf/api/document-operations";
import { type AgentConfirmationMode } from "@retainpdf/api/agent-runtime-settings";
export type ReaderAgentOperationSignal = {
    operationId: string;
    conversationId?: string;
    confirmationMode?: AgentConfirmationMode;
    nonce: number;
};
export type ReaderAgentOperationEntry = {
    operation: AgentOperationView;
    pendingAction?: "run" | "cancel" | "commit" | "retry";
    error?: string;
};
export type ReaderAgentOperationPerformOptions = {
    acceptDuplicateRisk?: boolean;
};
export declare function shouldReplaceAgentOperation(current: AgentOperationView | undefined, next: AgentOperationView): boolean;
export declare function useReaderAgentOperations({ conversationId, enabled, discovering, signal, confirmationModeHint, onDocumentCommitted, }: {
    conversationId: string;
    enabled: boolean;
    discovering: boolean;
    signal: ReaderAgentOperationSignal | null;
    confirmationModeHint?: AgentConfirmationMode;
    onDocumentCommitted?: (input: {
        documentId: string;
        revision: string;
    }) => void;
}): {
    entries: ReaderAgentOperationEntry[];
    confirmationMode: AgentConfirmationMode;
    runtimeRestarting: boolean;
    runtimeCredentialConfigured: boolean;
    perform: (action: "run" | "cancel" | "commit" | "retry", operation: AgentOperationView, options?: ReaderAgentOperationPerformOptions) => Promise<void>;
    loadCandidate: (operation: AgentOperationView) => Promise<Blob>;
};
//# sourceMappingURL=use-reader-agent-operations.d.ts.map