import type { ReaderChatMessage } from "./retainpdf-chat-transport.js";
import type { ReaderConversationTreePort } from "./use-reader-conversation.js";
import type { ReaderChatRequest } from "./retainpdf-chat-transport.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
import { type ReaderSelection } from "../../../shared/data/reader-regions.js";
/** Narrow chat projection this hook drives. Adapted by the facade from the
 *  chat owner, so no raw React setter crosses this module boundary. */
export type ReaderReadingChatPort = {
    messages: readonly ReaderChatMessage[];
    status: string;
    error: Error | undefined;
    sendUserMessage: (message: {
        id: string;
        role: "user";
        parts: [{
            type: "text";
            text: string;
        }];
    }, request: {
        body: ReaderChatRequest;
    }) => Promise<void>;
    regenerateFrom: (request: {
        messageId: string;
        body: ReaderChatRequest;
    }) => Promise<void>;
    stopStream: () => Promise<void>;
    replaceVisible: (messages: readonly ReaderChatMessage[]) => void;
};
export declare function useReaderReadingRequest(options: {
    jobId: string;
    assistantMode: ReaderAssistantMode;
    selectionContext?: ReaderSelection | null;
    tree: ReaderConversationTreePort;
    chat: ReaderReadingChatPort;
    getScopeKey: () => string;
}): {
    isRunning: boolean;
    streamingAssistantId: string;
    submitQuestion: (questionInput: string) => Promise<void>;
    retryAnswer: (assistantMessageId: string) => Promise<void>;
    cancelAnswer: () => Promise<void>;
};
export type ReaderReadingRequest = ReturnType<typeof useReaderReadingRequest>;
//# sourceMappingURL=use-reader-reading-request.d.ts.map