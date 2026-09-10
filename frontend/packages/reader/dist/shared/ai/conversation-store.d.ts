export type ConversationScopeKey = {
    jobId?: string;
    documentId?: string;
};
export declare function conversationStorageKey(scope?: ConversationScopeKey): string;
export declare function loadStoredConversationId(scope?: ConversationScopeKey): string;
export declare function saveStoredConversationId(scope: ConversationScopeKey, conversationId: string): void;
export declare function clearStoredConversationId(scope?: ConversationScopeKey): void;
//# sourceMappingURL=conversation-store.d.ts.map