import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { AiCitationLike } from "../../../shared/ai/answer-enhance.js";
import type { AgentConfirmationMode } from "@retainpdf/api/agent-runtime-settings";
import type { ReaderAgentOperationSignal } from "./use-reader-agent-operations.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
export type ReaderChatMetadata = {
    citations?: AiCitationLike[];
    progress?: string;
    persisted?: boolean;
    status?: "running" | "complete" | "cancelled" | "error";
};
export type ReaderChatMessage = UIMessage<ReaderChatMetadata>;
type ReaderAnswerer = {
    ensureLoaded?: (jobId?: string) => Promise<unknown>;
    answer: (options: Record<string, unknown>) => Promise<{
        answer?: string;
        citations?: unknown[];
        persisted?: boolean;
        conversationId?: string;
        confirmationMode?: AgentConfirmationMode | "";
        operationRefs?: Array<string | {
            operation_id?: string;
        }>;
        confirmationRequests?: Array<{
            operation_id?: string;
        }>;
    }>;
};
export type ReaderChatRequest = {
    assistantMode?: ReaderAssistantMode;
    assistantMessageId?: string;
    parentId?: string;
    question?: string;
    regenerate?: boolean;
    userMessageId?: string;
    scope?: "document" | "selection" | "page";
    context?: Record<string, unknown> | null;
};
/**
 * Translate RetainPDF's small SSE contract into AI SDK UI message chunks.
 *
 * The backend remains framework-agnostic. It only needs to emit answer deltas,
 * optional tool progress, and a final answer/citation payload.
 */
export declare class RetainPdfChatTransport implements ChatTransport<ReaderChatMessage> {
    private readonly options;
    constructor(options: {
        jobId: string;
        getRemoteAnswerer: () => ReaderAnswerer | null;
        getLocalAnswerer?: () => ReaderAnswerer | null;
        getAssistantMode?: () => ReaderAssistantMode;
        onAgentOperationSignal?: (signal: Omit<ReaderAgentOperationSignal, "nonce">) => void;
        onConfirmationMode?: (mode: AgentConfirmationMode) => void;
    });
    sendMessages({ abortSignal, body, messages, trigger, }: Parameters<ChatTransport<ReaderChatMessage>["sendMessages"]>[0]): Promise<ReadableStream<UIMessageChunk>>;
    reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null>;
}
export declare function readerChatMessageText(message: ReaderChatMessage): string;
export {};
//# sourceMappingURL=retainpdf-chat-transport.d.ts.map