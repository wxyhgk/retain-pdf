import type { RequestOptions } from "./request.js";
import type { AppendAskMessagesInput, AppendAskMessagesView, AskCompactionListView, AskContextQuery, AskContextView, AskConversationDeleteResultView, AskConversationListView, AskConversationRecord, AskMemoryCreatedView, AskMemoryListView, AskMemoryRecord, AskMessagePageView, AskModelConnectionInput, AskSettingsRecord, CloseAskConversationInput, CloseAskConversationView, CreateAskCompactionView, CreateAskMemoryInput, CreateAskSideConversationInput, DocumentAskMessagesView, ListAskConversationsQuery, ListAskMemoriesQuery, ListAskMessagesQuery, PatchAskConversationInput, PatchAskMemoryInput, PatchAskSettingsInput } from "@retainpdf/contracts/ask-conversations";
export type * from "@retainpdf/contracts/ask-conversations";
type Prefix = string | undefined;
/** 取或建当前的全局主对话（幂等）。 */
export declare function getMainAskConversation(apiPrefix: Prefix, options?: RequestOptions): Promise<AskConversationRecord>;
export declare function listAskConversations(apiPrefix: Prefix, query?: ListAskConversationsQuery, options?: RequestOptions): Promise<AskConversationListView>;
/** 开副对话（从主对话某条消息分出来）。 */
export declare function createAskSideConversation(apiPrefix: Prefix, body: CreateAskSideConversationInput, options?: RequestOptions): Promise<AskConversationRecord>;
export declare function getAskConversation(apiPrefix: Prefix, conversationId: string, options?: RequestOptions): Promise<AskConversationRecord>;
/** 改标题、归档主对话、再开副对话。 */
export declare function updateAskConversation(apiPrefix: Prefix, conversationId: string, body: PatchAskConversationInput, options?: RequestOptions): Promise<AskConversationRecord>;
/** 删对话（开着的主对话 409 ask_main_conversation_open：先归档）。 */
export declare function deleteAskConversation(apiPrefix: Prefix, conversationId: string, options?: RequestOptions): Promise<AskConversationDeleteResultView>;
/** 结束副对话：给 summary 照用，只给 summarize_with 由后端用模型写结论（最多等 180 秒）。 */
export declare function closeAskConversation(apiPrefix: Prefix, conversationId: string, body: CloseAskConversationInput, options?: RequestOptions): Promise<CloseAskConversationView>;
/** 消息分页：seq < before_seq 的最后 limit 条，按 seq 从小到大。 */
export declare function listAskConversationMessages(apiPrefix: Prefix, conversationId: string, query?: ListAskMessagesQuery, options?: RequestOptions): Promise<AskMessagePageView>;
/** 追加一轮（问和答一起，client_message_id 重试安全）。 */
export declare function appendAskConversationMessages(apiPrefix: Prefix, conversationId: string, body: AppendAskMessagesInput, options?: RequestOptions): Promise<AppendAskMessagesView>;
/** 压缩：后端用设置里的模型把旧的几轮压成摘要。 */
export declare function createAskCompaction(apiPrefix: Prefix, conversationId: string, connection: AskModelConnectionInput, options?: RequestOptions): Promise<CreateAskCompactionView>;
export declare function listAskCompactions(apiPrefix: Prefix, conversationId: string, options?: RequestOptions): Promise<AskCompactionListView>;
/** 开新会话用的上下文：记忆 + 摘要 + 最近几轮，text 是拼好的一段字（给本机 agent）。 */
export declare function getAskConversationContext(apiPrefix: Prefix, conversationId: string, query?: AskContextQuery, options?: RequestOptions): Promise<AskContextView>;
export declare function getAskSettings(apiPrefix: Prefix, options?: RequestOptions): Promise<AskSettingsRecord>;
export declare function updateAskSettings(apiPrefix: Prefix, body: PatchAskSettingsInput, options?: RequestOptions): Promise<AskSettingsRecord>;
/** 这本书上问过的地方（画书页上的「?」）。 */
export declare function listDocumentAskMessages(apiPrefix: Prefix, documentId: string, options?: RequestOptions): Promise<DocumentAskMessagesView>;
export declare function listAskMemories(apiPrefix: Prefix, query?: ListAskMemoriesQuery, options?: RequestOptions): Promise<AskMemoryListView>;
export declare function createAskMemory(apiPrefix: Prefix, body: CreateAskMemoryInput, options?: RequestOptions): Promise<AskMemoryCreatedView>;
export declare function updateAskMemory(apiPrefix: Prefix, memoryId: string, body: PatchAskMemoryInput, options?: RequestOptions): Promise<AskMemoryRecord>;
/** 删（撤销）一条；被它替代的旧条恢复。 */
export declare function deleteAskMemory(apiPrefix: Prefix, memoryId: string, options?: RequestOptions): Promise<AskMemoryRecord>;
