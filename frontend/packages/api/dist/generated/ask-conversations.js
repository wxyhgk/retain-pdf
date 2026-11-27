// 生成文件，不要手改。来源：contracts/ask-conversations.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { encodePathParam, request } from "../request.js";
/** POST /api/v1/ai/ask-conversations/main */
export function getMainAskConversation(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/ask-conversations/main`, body: args.body, options });
}
/** GET /api/v1/ai/ask-conversations */
export function listAskConversations(apiPrefix, args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `ai/ask-conversations`, query: args.query, options });
}
/** POST /api/v1/ai/ask-conversations */
export function createAskSideConversation(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/ask-conversations`, body: args.body, options });
}
/** GET /api/v1/ai/ask-conversations/:conversation_id */
export function getAskConversation(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}`, options });
}
/** PATCH /api/v1/ai/ask-conversations/:conversation_id */
export function updateAskConversation(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}`, body: args.body, options });
}
/** DELETE /api/v1/ai/ask-conversations/:conversation_id */
export function deleteAskConversation(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}`, options });
}
/** POST /api/v1/ai/ask-conversations/:conversation_id/close */
export function closeAskConversation(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/close`, body: args.body, options });
}
/** GET /api/v1/ai/ask-conversations/:conversation_id/messages */
export function listAskConversationMessages(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/messages`, query: args.query, options });
}
/** POST /api/v1/ai/ask-conversations/:conversation_id/messages */
export function appendAskConversationMessages(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/messages`, body: args.body, options });
}
/** POST /api/v1/ai/ask-conversations/:conversation_id/messages/:message_id/supersede */
export function supersedeAskConversationMessage(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/messages/${encodePathParam(args.message_id)}/supersede`, options });
}
/** POST /api/v1/ai/ask-conversations/:conversation_id/compactions */
export function createAskCompaction(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/compactions`, body: args.body, options });
}
/** GET /api/v1/ai/ask-conversations/:conversation_id/compactions */
export function listAskCompactions(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/compactions`, options });
}
/** GET /api/v1/ai/ask-conversations/:conversation_id/context */
export function getAskConversationContext(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/context`, query: args.query, options });
}
/** GET /api/v1/ai/ask-settings */
export function getAskSettings(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `ai/ask-settings`, options });
}
/** PATCH /api/v1/ai/ask-settings */
export function updateAskSettings(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `ai/ask-settings`, body: args.body, options });
}
/** GET /api/v1/documents/:document_id/ask-messages */
export function listDocumentAskMessages(apiPrefix, args, options) {
    return request({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/ask-messages`, options });
}
/** GET /api/v1/ai/memories */
export function listAskMemories(apiPrefix, args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `ai/memories`, query: args.query, options });
}
/** POST /api/v1/ai/memories */
export function createAskMemory(apiPrefix, args, options) {
    return request({ apiPrefix, method: "POST", path: `ai/memories`, body: args.body, options });
}
/** PATCH /api/v1/ai/memories/:memory_id */
export function updateAskMemory(apiPrefix, args, options) {
    return request({ apiPrefix, method: "PATCH", path: `ai/memories/${encodePathParam(args.memory_id)}`, body: args.body, options });
}
/** DELETE /api/v1/ai/memories/:memory_id */
export function deleteAskMemory(apiPrefix, args, options) {
    return request({ apiPrefix, method: "DELETE", path: `ai/memories/${encodePathParam(args.memory_id)}`, options });
}
