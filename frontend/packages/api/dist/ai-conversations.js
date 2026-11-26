// 阅读页提问的主对话、副对话、记忆（契约 ask-conversations.v1，2026-11-26）：走生成的请求函数，这里只把参数摆顺手。
// 用法见 docs/api/16-AI/02-主对话和记忆.md；从 ./ai 导出。
import * as generated from "./generated/ask-conversations.js";
/** 取或建当前的全局主对话（幂等）。 */
export function getMainAskConversation(apiPrefix, options) {
    return generated.getMainAskConversation(apiPrefix, {}, options);
}
export function listAskConversations(apiPrefix, query = {}, options) {
    return generated.listAskConversations(apiPrefix, { query }, options);
}
/** 开副对话（从主对话某条消息分出来）。 */
export function createAskSideConversation(apiPrefix, body, options) {
    return generated.createAskSideConversation(apiPrefix, { body }, options);
}
export function getAskConversation(apiPrefix, conversationId, options) {
    return generated.getAskConversation(apiPrefix, { conversation_id: conversationId }, options);
}
/** 改标题、归档主对话、再开副对话。 */
export function updateAskConversation(apiPrefix, conversationId, body, options) {
    return generated.updateAskConversation(apiPrefix, { conversation_id: conversationId, body }, options);
}
/** 删对话（开着的主对话 409 ask_main_conversation_open：先归档）。 */
export function deleteAskConversation(apiPrefix, conversationId, options) {
    return generated.deleteAskConversation(apiPrefix, { conversation_id: conversationId }, options);
}
/** 结束副对话：给 summary 照用，只给 summarize_with 由后端用模型写结论（最多等 180 秒）。 */
export function closeAskConversation(apiPrefix, conversationId, body, options) {
    return generated.closeAskConversation(apiPrefix, { conversation_id: conversationId, body }, options);
}
/** 消息分页：seq < before_seq 的最后 limit 条，按 seq 从小到大。 */
export function listAskConversationMessages(apiPrefix, conversationId, query = {}, options) {
    return generated.listAskConversationMessages(apiPrefix, { conversation_id: conversationId, query }, options);
}
/** 追加一轮（问和答一起，client_message_id 重试安全）。 */
export function appendAskConversationMessages(apiPrefix, conversationId, body, options) {
    return generated.appendAskConversationMessages(apiPrefix, { conversation_id: conversationId, body }, options);
}
/** 压缩：后端用设置里的模型把旧的几轮压成摘要。 */
export function createAskCompaction(apiPrefix, conversationId, connection, options) {
    return generated.createAskCompaction(apiPrefix, { conversation_id: conversationId, body: { connection } }, options);
}
export function listAskCompactions(apiPrefix, conversationId, options) {
    return generated.listAskCompactions(apiPrefix, { conversation_id: conversationId }, options);
}
/** 开新会话用的上下文：记忆 + 摘要 + 最近几轮，text 是拼好的一段字（给本机 agent）。 */
export function getAskConversationContext(apiPrefix, conversationId, query = {}, options) {
    return generated.getAskConversationContext(apiPrefix, { conversation_id: conversationId, query }, options);
}
export function getAskSettings(apiPrefix, options) {
    return generated.getAskSettings(apiPrefix, {}, options);
}
export function updateAskSettings(apiPrefix, body, options) {
    return generated.updateAskSettings(apiPrefix, { body }, options);
}
/** 这本书上问过的地方（画书页上的「?」）。 */
export function listDocumentAskMessages(apiPrefix, documentId, options) {
    return generated.listDocumentAskMessages(apiPrefix, { document_id: documentId }, options);
}
export function listAskMemories(apiPrefix, query = {}, options) {
    return generated.listAskMemories(apiPrefix, { query }, options);
}
export function createAskMemory(apiPrefix, body, options) {
    return generated.createAskMemory(apiPrefix, { body }, options);
}
export function updateAskMemory(apiPrefix, memoryId, body, options) {
    return generated.updateAskMemory(apiPrefix, { memory_id: memoryId, body }, options);
}
/** 删（撤销）一条；被它替代的旧条恢复。 */
export function deleteAskMemory(apiPrefix, memoryId, options) {
    return generated.deleteAskMemory(apiPrefix, { memory_id: memoryId }, options);
}
