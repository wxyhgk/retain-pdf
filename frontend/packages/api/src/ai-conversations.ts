// 阅读页提问的主对话、副对话、记忆（契约 ask-conversations.v1，2026-11-26）：走生成的请求函数，这里只把参数摆顺手。
// 用法见 docs/api/16-AI/02-主对话和记忆.md；从 ./ai 导出。
import * as generated from "./generated/ask-conversations.js";
import type { RequestOptions } from "./request.js";
import type {
  AppendAskMessagesInput,
  AppendAskMessagesView,
  AskCompactionListView,
  AskContextQuery,
  AskContextView,
  AskConversationDeleteResultView,
  AskConversationListView,
  AskConversationRecord,
  AskMemoryCreatedView,
  AskMemoryListView,
  AskMemoryRecord,
  AskMessagePageView,
  AskModelConnectionInput,
  AskSettingsRecord,
  CloseAskConversationInput,
  CloseAskConversationView,
  CreateAskCompactionView,
  CreateAskMemoryInput,
  CreateAskSideConversationInput,
  DocumentAskMessagesView,
  ListAskConversationsQuery,
  ListAskMemoriesQuery,
  ListAskMessagesQuery,
  PatchAskConversationInput,
  PatchAskMemoryInput,
  PatchAskSettingsInput,
  SupersedeAskMessagesView,
} from "@retainpdf/contracts/ask-conversations";

export type * from "@retainpdf/contracts/ask-conversations";

type Prefix = string | undefined;

/** 取或建主对话（幂等）：给了书是这本书开着的那条（2026-11-27 起按书分），不给是全局那条。 */
export function getMainAskConversation(apiPrefix: Prefix, documentId?: string | null, options?: RequestOptions): Promise<AskConversationRecord> {
  return generated.getMainAskConversation(apiPrefix, { body: documentId ? { document_id: documentId } : {} }, options);
}

export function listAskConversations(apiPrefix: Prefix, query: ListAskConversationsQuery = {}, options?: RequestOptions): Promise<AskConversationListView> {
  return generated.listAskConversations(apiPrefix, { query }, options);
}

/** 开副对话（从主对话某条消息分出来）。 */
export function createAskSideConversation(apiPrefix: Prefix, body: CreateAskSideConversationInput, options?: RequestOptions): Promise<AskConversationRecord> {
  return generated.createAskSideConversation(apiPrefix, { body }, options);
}

export function getAskConversation(apiPrefix: Prefix, conversationId: string, options?: RequestOptions): Promise<AskConversationRecord> {
  return generated.getAskConversation(apiPrefix, { conversation_id: conversationId }, options);
}

/** 改标题、归档主对话、再开副对话。 */
export function updateAskConversation(apiPrefix: Prefix, conversationId: string, body: PatchAskConversationInput, options?: RequestOptions): Promise<AskConversationRecord> {
  return generated.updateAskConversation(apiPrefix, { conversation_id: conversationId, body }, options);
}

/** 删对话（开着的主对话 409 ask_main_conversation_open：先归档）。 */
export function deleteAskConversation(apiPrefix: Prefix, conversationId: string, options?: RequestOptions): Promise<AskConversationDeleteResultView> {
  return generated.deleteAskConversation(apiPrefix, { conversation_id: conversationId }, options);
}

/** 结束副对话：给 summary 照用，只给 summarize_with 由后端用模型写结论（最多等 180 秒）。 */
export function closeAskConversation(apiPrefix: Prefix, conversationId: string, body: CloseAskConversationInput, options?: RequestOptions): Promise<CloseAskConversationView> {
  return generated.closeAskConversation(apiPrefix, { conversation_id: conversationId, body }, options);
}

/** 消息分页：seq < before_seq 的最后 limit 条，按 seq 从小到大。 */
export function listAskConversationMessages(apiPrefix: Prefix, conversationId: string, query: ListAskMessagesQuery = {}, options?: RequestOptions): Promise<AskMessagePageView> {
  return generated.listAskConversationMessages(apiPrefix, { conversation_id: conversationId, query }, options);
}

/** 追加一轮（问和答一起，client_message_id 重试安全）。 */
export function appendAskConversationMessages(apiPrefix: Prefix, conversationId: string, body: AppendAskMessagesInput, options?: RequestOptions): Promise<AppendAskMessagesView> {
  return generated.appendAskConversationMessages(apiPrefix, { conversation_id: conversationId, body }, options);
}

/** 改一条已发出的问（或重新回答）：这条问和它之后的作废，之后用改后的问重问、追加时带 edited_from。 */
export function supersedeAskConversationMessage(apiPrefix: Prefix, conversationId: string, messageId: string, options?: RequestOptions): Promise<SupersedeAskMessagesView> {
  return generated.supersedeAskConversationMessage(apiPrefix, { conversation_id: conversationId, message_id: messageId }, options);
}

/** 压缩：后端用设置里的模型把旧的几轮压成摘要。 */
export function createAskCompaction(apiPrefix: Prefix, conversationId: string, connection: AskModelConnectionInput, options?: RequestOptions): Promise<CreateAskCompactionView> {
  return generated.createAskCompaction(apiPrefix, { conversation_id: conversationId, body: { connection } }, options);
}

export function listAskCompactions(apiPrefix: Prefix, conversationId: string, options?: RequestOptions): Promise<AskCompactionListView> {
  return generated.listAskCompactions(apiPrefix, { conversation_id: conversationId }, options);
}

/** 开新会话用的上下文：记忆 + 摘要 + 最近几轮，text 是拼好的一段字（给本机 agent）。 */
export function getAskConversationContext(apiPrefix: Prefix, conversationId: string, query: AskContextQuery = {}, options?: RequestOptions): Promise<AskContextView> {
  return generated.getAskConversationContext(apiPrefix, { conversation_id: conversationId, query }, options);
}

export function getAskSettings(apiPrefix: Prefix, options?: RequestOptions): Promise<AskSettingsRecord> {
  return generated.getAskSettings(apiPrefix, {}, options);
}

export function updateAskSettings(apiPrefix: Prefix, body: PatchAskSettingsInput, options?: RequestOptions): Promise<AskSettingsRecord> {
  return generated.updateAskSettings(apiPrefix, { body }, options);
}

/** 这本书上问过的地方（画书页上的「?」）。 */
export function listDocumentAskMessages(apiPrefix: Prefix, documentId: string, options?: RequestOptions): Promise<DocumentAskMessagesView> {
  return generated.listDocumentAskMessages(apiPrefix, { document_id: documentId }, options);
}

export function listAskMemories(apiPrefix: Prefix, query: ListAskMemoriesQuery = {}, options?: RequestOptions): Promise<AskMemoryListView> {
  return generated.listAskMemories(apiPrefix, { query }, options);
}

export function createAskMemory(apiPrefix: Prefix, body: CreateAskMemoryInput, options?: RequestOptions): Promise<AskMemoryCreatedView> {
  return generated.createAskMemory(apiPrefix, { body }, options);
}

export function updateAskMemory(apiPrefix: Prefix, memoryId: string, body: PatchAskMemoryInput, options?: RequestOptions): Promise<AskMemoryRecord> {
  return generated.updateAskMemory(apiPrefix, { memory_id: memoryId, body }, options);
}

/** 删（撤销）一条；被它替代的旧条恢复。 */
export function deleteAskMemory(apiPrefix: Prefix, memoryId: string, options?: RequestOptions): Promise<AskMemoryRecord> {
  return generated.deleteAskMemory(apiPrefix, { memory_id: memoryId }, options);
}
