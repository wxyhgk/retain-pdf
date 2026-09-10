import type { UIMessage } from "ai";
import type { ReaderAskStoreMessage } from "./reader-ask-tree.js";
import { RetainPdfChatTransport, type ReaderChatMessage } from "./retainpdf-chat-transport.js";
import type { AgentConfirmationMode } from "@retainpdf/api/agent-runtime-settings";
import type { ReaderAgentOperationSignal } from "./use-reader-agent-operations.js";
import type { ReaderAssistantMode } from "../../../shared/ai/ask-answerer.js";
type ReaderAnswerer = ConstructorParameters<typeof RetainPdfChatTransport>[0] extends {
    getRemoteAnswerer: () => infer ANSWERER;
} ? ANSWERER : never;
export declare function storeMessagesToChat(messages: readonly ReaderAskStoreMessage[]): ReaderChatMessage[];
export declare function chatMessageToStore(message: ReaderChatMessage): ReaderAskStoreMessage;
export declare function useReaderChat(options: {
    jobId: string;
    enabled: boolean;
    remoteAnswerer: ReaderAnswerer;
    localAnswerer: ReaderAnswerer;
    assistantMode: ReaderAssistantMode;
    onAgentOperationSignal?: (signal: Omit<ReaderAgentOperationSignal, "nonce">) => void;
    onConfirmationMode?: (mode: AgentConfirmationMode) => void;
}): import("@ai-sdk/react").UseChatHelpers<ReaderChatMessage>;
export declare function lastAssistantMessage(messages: readonly UIMessage[]): UIMessage | undefined;
export {};
//# sourceMappingURL=use-reader-chat.d.ts.map