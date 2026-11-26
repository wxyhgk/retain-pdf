import type { AppendAskMessagesInput, AppendAskMessagesView, AskCompactionListView, AskContextQuery, AskContextView, AskConversationDeleteResultView, AskConversationListView, AskConversationRecord, AskMemoryCreatedView, AskMemoryListView, AskMemoryRecord, AskMessagePageView, AskSettingsRecord, CloseAskConversationInput, CloseAskConversationView, CreateAskCompactionInput, CreateAskCompactionView, CreateAskMemoryInput, CreateAskSideConversationInput, DocumentAskMessagesView, ListAskConversationsQuery, ListAskMemoriesQuery, ListAskMessagesQuery, PatchAskConversationInput, PatchAskMemoryInput, PatchAskSettingsInput } from "@retainpdf/contracts/ask-conversations";
import { type RequestOptions } from "../request.js";
/** POST /api/v1/ai/ask-conversations/main */
export declare function getMainAskConversation(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<AskConversationRecord>;
/** GET /api/v1/ai/ask-conversations */
export declare function listAskConversations(apiPrefix: string | undefined, args?: {
    query?: ListAskConversationsQuery;
}, options?: RequestOptions): Promise<AskConversationListView>;
/** POST /api/v1/ai/ask-conversations */
export declare function createAskSideConversation(apiPrefix: string | undefined, args: {
    body: CreateAskSideConversationInput;
}, options?: RequestOptions): Promise<AskConversationRecord>;
/** GET /api/v1/ai/ask-conversations/:conversation_id */
export declare function getAskConversation(apiPrefix: string | undefined, args: {
    conversation_id: string;
}, options?: RequestOptions): Promise<AskConversationRecord>;
/** PATCH /api/v1/ai/ask-conversations/:conversation_id */
export declare function updateAskConversation(apiPrefix: string | undefined, args: {
    conversation_id: string;
    body: PatchAskConversationInput;
}, options?: RequestOptions): Promise<AskConversationRecord>;
/** DELETE /api/v1/ai/ask-conversations/:conversation_id */
export declare function deleteAskConversation(apiPrefix: string | undefined, args: {
    conversation_id: string;
}, options?: RequestOptions): Promise<AskConversationDeleteResultView>;
/** POST /api/v1/ai/ask-conversations/:conversation_id/close */
export declare function closeAskConversation(apiPrefix: string | undefined, args: {
    conversation_id: string;
    body: CloseAskConversationInput;
}, options?: RequestOptions): Promise<CloseAskConversationView>;
/** GET /api/v1/ai/ask-conversations/:conversation_id/messages */
export declare function listAskConversationMessages(apiPrefix: string | undefined, args: {
    conversation_id: string;
    query?: ListAskMessagesQuery;
}, options?: RequestOptions): Promise<AskMessagePageView>;
/** POST /api/v1/ai/ask-conversations/:conversation_id/messages */
export declare function appendAskConversationMessages(apiPrefix: string | undefined, args: {
    conversation_id: string;
    body: AppendAskMessagesInput;
}, options?: RequestOptions): Promise<AppendAskMessagesView>;
/** POST /api/v1/ai/ask-conversations/:conversation_id/compactions */
export declare function createAskCompaction(apiPrefix: string | undefined, args: {
    conversation_id: string;
    body: CreateAskCompactionInput;
}, options?: RequestOptions): Promise<CreateAskCompactionView>;
/** GET /api/v1/ai/ask-conversations/:conversation_id/compactions */
export declare function listAskCompactions(apiPrefix: string | undefined, args: {
    conversation_id: string;
}, options?: RequestOptions): Promise<AskCompactionListView>;
/** GET /api/v1/ai/ask-conversations/:conversation_id/context */
export declare function getAskConversationContext(apiPrefix: string | undefined, args: {
    conversation_id: string;
    query?: AskContextQuery;
}, options?: RequestOptions): Promise<AskContextView>;
/** GET /api/v1/ai/ask-settings */
export declare function getAskSettings(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<AskSettingsRecord>;
/** PATCH /api/v1/ai/ask-settings */
export declare function updateAskSettings(apiPrefix: string | undefined, args: {
    body: PatchAskSettingsInput;
}, options?: RequestOptions): Promise<AskSettingsRecord>;
/** GET /api/v1/documents/:document_id/ask-messages */
export declare function listDocumentAskMessages(apiPrefix: string | undefined, args: {
    document_id: string;
}, options?: RequestOptions): Promise<DocumentAskMessagesView>;
/** GET /api/v1/ai/memories */
export declare function listAskMemories(apiPrefix: string | undefined, args?: {
    query?: ListAskMemoriesQuery;
}, options?: RequestOptions): Promise<AskMemoryListView>;
/** POST /api/v1/ai/memories */
export declare function createAskMemory(apiPrefix: string | undefined, args: {
    body: CreateAskMemoryInput;
}, options?: RequestOptions): Promise<AskMemoryCreatedView>;
/** PATCH /api/v1/ai/memories/:memory_id */
export declare function updateAskMemory(apiPrefix: string | undefined, args: {
    memory_id: string;
    body: PatchAskMemoryInput;
}, options?: RequestOptions): Promise<AskMemoryRecord>;
/** DELETE /api/v1/ai/memories/:memory_id */
export declare function deleteAskMemory(apiPrefix: string | undefined, args: {
    memory_id: string;
}, options?: RequestOptions): Promise<AskMemoryRecord>;
