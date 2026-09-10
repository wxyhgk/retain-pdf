import type { AgentConfirmationMode } from "./agent-runtime-settings.js";
import type { AgentOperationStatus } from "./document-operations.js";
export type { AgentConfirmationMode } from "./agent-runtime-settings.js";
export declare class AiAskError extends Error {
    status: number;
    constructor(message: string, status?: number);
}
export type AiAssistantMode = "auto" | "reading" | "operations";
export type AgentOperationRef = string | {
    operation_id: string;
    status?: string;
    current_attempt?: number;
    latest_event_seq?: number;
};
export type AgentToolEvent = {
    type: "agent_tool";
    runtime?: string;
    [key: string]: unknown;
};
export type AgentSessionEvent = {
    type: "agent_session";
    conversation_id: string;
    request_message_id?: string;
    agent_runtime: string;
    assistant_mode: AiAssistantMode;
    resolved_mode: "reading" | "operations";
    content_source: "structured" | "markdown" | "none" | "unscoped" | "unknown";
    capabilities?: {
        document_operations?: boolean;
        document_operation_confirmation_mode?: AgentConfirmationMode;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};
export type AgentOperationEvent = {
    type: "agent_operation";
    event_id?: string;
    operation_id: string;
    conversation_id?: string;
    request_message_id?: string;
    status?: string;
    current_attempt?: number;
    latest_event_seq?: number;
    [key: string]: unknown;
};
export type AgentConfirmationRequest = {
    schema: "retainpdf_agent_confirmation_v1";
    operation_id: string;
    action: "run" | "commit" | "retry";
    status: AgentOperationStatus;
    current_attempt: number;
    latest_event_seq: number;
    requires_risk_acceptance: boolean;
};
export type AgentConfirmationRequiredEvent = AgentConfirmationRequest & {
    type: "agent_confirmation_required";
};
export type AiAskStreamCallbacks = {
    onProgressEvent?: ((event: {
        type: "progress";
        stage: "routing" | "retrieval";
        message: string;
    }) => void) | null;
    onToolEvent?: ((event: any) => void) | null;
    onAgentToolEvent?: ((event: AgentToolEvent) => void) | null;
    onAgentOperationEvent?: ((event: AgentOperationEvent) => void) | null;
    onAgentConfirmationRequiredEvent?: ((event: AgentConfirmationRequiredEvent) => void) | null;
    onAgentSessionEvent?: ((event: AgentSessionEvent) => void) | null;
    onAnswerDelta?: ((full: string, chunk: string) => void) | null;
    onCompress?: ((event: any) => void) | null;
};
export declare function readAiAskStream(body: ReadableStream<Uint8Array>, { onProgressEvent, onToolEvent, onAgentToolEvent, onAgentOperationEvent, onAgentConfirmationRequiredEvent, onAgentSessionEvent, onAnswerDelta, onCompress, }?: AiAskStreamCallbacks): Promise<any>;
export declare function askLibraryAi({ question, documentId, jobId, conversationId, parentId, regenerate, userMessageId, assistantMessageId, onToolEvent, onProgressEvent, onAgentToolEvent, onAgentOperationEvent, onAgentConfirmationRequiredEvent, onAgentSessionEvent, onAnswerDelta, onCompress, signal, apiPrefix, fetchImpl, llmApiKey, llmBaseUrl, llmModel, confirmDocumentOperation, assistantMode, }?: {
    question?: string;
    documentId?: string;
    jobId?: string;
    conversationId?: string;
    parentId?: string;
    regenerate?: boolean;
    userMessageId?: string;
    assistantMessageId?: string;
    onToolEvent?: ((e: any) => void) | null;
    onProgressEvent?: ((e: {
        type: "progress";
        stage: "routing" | "retrieval";
        message: string;
    }) => void) | null;
    onAgentToolEvent?: ((e: AgentToolEvent) => void) | null;
    onAgentOperationEvent?: ((e: AgentOperationEvent) => void) | null;
    onAgentConfirmationRequiredEvent?: ((e: AgentConfirmationRequiredEvent) => void) | null;
    onAgentSessionEvent?: ((e: AgentSessionEvent) => void) | null;
    onAnswerDelta?: ((full: string, chunk: string) => void) | null;
    onCompress?: ((e: any) => void) | null;
    signal?: AbortSignal | null;
    apiPrefix?: string;
    fetchImpl?: typeof fetch;
    llmApiKey?: string;
    llmBaseUrl?: string;
    llmModel?: string;
    confirmDocumentOperation?: boolean;
    assistantMode?: AiAssistantMode;
}): Promise<any>;
