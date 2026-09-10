import { type AiCitationLike, type ConversationRecord } from "../../../external.js";
import { type ReaderAskStoreMessage, type ReaderAskTreeItem } from "./reader-ask-tree.js";
export type ReaderAskSessionSummary = {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
    active: boolean;
};
/** Minimal remote-answerer surface this shell needs (document/conversation ids). */
export type ReaderConversationRemotePort = {
    getDocumentId?: () => Promise<string>;
    getConversationId?: () => string;
    setConversationId?: (conversationId: string, documentId: string) => void;
    clearConversationId?: (documentId: string) => void;
};
/**
 * Typed stream commands owned by the chat hook. The conversation shell calls
 * these instead of receiving React setters, so stopping a stream never leaks
 * into durable operation handling.
 */
export type ReaderConversationStreamPort = {
    stopStream: () => Promise<void>;
    clearMessages: () => void;
    showMessages: (messages: readonly ReaderAskStoreMessage[]) => void;
};
/** Typed tree commands for the reading request hook (no React setters). */
export type ReaderConversationTreePort = {
    readItems: () => ReaderAskTreeItem[];
    readHeadId: () => string | null;
    appendExchange: (input: {
        parentId: string | null;
        userId: string;
        assistantId: string;
        question: string;
        progress: string;
    }) => void;
    appendRetryTurn: (input: {
        assistantId: string;
        branchParent: string | null;
    }) => void;
    markRunningCancelled: () => void;
    markRunningAsError: (message: string) => void;
    mergeChatMirror: (patches: ReadonlyMap<string, ReaderAskStoreMessage>) => void;
};
export type ReaderConversationSessionCommands = {
    refreshSessions: (documentId?: string, expectedSwitchToken?: number) => Promise<ConversationRecord[] | null>;
    adoptRemoteConversationId: () => void;
    newSession: () => Promise<void>;
    switchSession: (conversationId: string) => Promise<void>;
    removeSession: (conversationId: string) => Promise<void>;
    renameSession: (conversationId: string, title: string) => Promise<void>;
    branchFromAnswer: (assistantMessageId: string) => Promise<boolean>;
};
export declare function useReaderConversation(options: {
    jobId: string;
    documentId?: string;
    enabled: boolean;
    remoteAnswerer?: ReaderConversationRemotePort | null;
    stream?: ReaderConversationStreamPort;
}): {
    items: ReaderAskTreeItem[];
    headId: string;
    messages: ReaderAskStoreMessage[];
    citationsByMessageId: Record<string, AiCitationLike[]>;
    progressByMessageId: Record<string, string>;
    contentByMessageId: Record<string, string>;
    sessions: ReaderAskSessionSummary[];
    activeConversationId: string;
    sessionBusy: boolean;
    sessionError: string;
    resolveRequestScopeKey: () => string;
    tree: ReaderConversationTreePort;
    sessionCommands: ReaderConversationSessionCommands;
};
export type ReaderConversation = ReturnType<typeof useReaderConversation>;
//# sourceMappingURL=use-reader-conversation.d.ts.map