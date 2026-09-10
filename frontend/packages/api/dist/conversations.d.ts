export type ConversationRecord = {
    conversation_id: string;
    title: string;
    document_id?: string | null;
    created_at: string;
    updated_at: string;
    message_count?: number;
    head_id?: string;
};
export type MessageRecord = {
    message_id: string;
    conversation_id: string;
    seq: number;
    role: "user" | "assistant" | string;
    content: string;
    citations_json?: string;
    tool_trace_json?: string;
    model?: string;
    created_at: string;
    parent_id?: string;
};
export type ConversationDetail = ConversationRecord & {
    messages: MessageRecord[];
};
export declare function createConversation(payload?: {
    title?: string;
    document_id?: string;
}, apiPrefix?: string): Promise<ConversationRecord>;
export declare function listConversations(query?: {
    limit?: number;
    offset?: number;
    document_id?: string;
}, apiPrefix?: string): Promise<{
    conversations: ConversationRecord[];
}>;
export declare function getConversation(conversationId: string, apiPrefix?: string): Promise<ConversationDetail>;
export declare function deleteConversation(conversationId: string, apiPrefix?: string): Promise<{
    deleted: boolean;
}>;
export declare function patchConversation(conversationId: string, payload: {
    head_id?: string;
    title?: string;
}, apiPrefix?: string): Promise<ConversationRecord>;
export declare function appendConversationMessage(conversationId: string, payload: {
    role: string;
    content: string;
    parent_id?: string;
    message_id?: string;
    citations_json?: string;
    tool_trace_json?: string;
    model?: string;
    set_head?: boolean;
}, apiPrefix?: string): Promise<MessageRecord>;
export declare function baseConversationTitle(title: string): string;
export declare function nextForkConversationTitle(sourceTitle: string, existingTitles?: string[]): string;
export declare function forkConversationFromPath(options: {
    documentId?: string;
    title?: string;
    path: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        citations?: unknown[];
        parentId?: string | null;
    }>;
}, apiPrefix?: string): Promise<{
    conversation: ConversationRecord;
    items: ReturnType<typeof messagesToBranchItems>;
}>;
export declare function messagesToBranchItems(messages: MessageRecord[]): Array<{
    parentId: string | null;
    message: {
        id: string;
        role: "user" | "assistant";
        content: string;
        citations?: unknown[];
        status?: {
            type: string;
            reason?: string;
        };
    };
}>;
