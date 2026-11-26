// 生成文件，不要手改。来源：contracts/ask-conversations.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

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
  AskSettingsRecord,
  CloseAskConversationInput,
  CloseAskConversationView,
  CreateAskCompactionInput,
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
} from "@retainpdf/contracts/ask-conversations";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** POST /api/v1/ai/ask-conversations/main */
export function getMainAskConversation(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<AskConversationRecord> {
  return request<AskConversationRecord>({ apiPrefix, method: "POST", path: `ai/ask-conversations/main`, options });
}

/** GET /api/v1/ai/ask-conversations */
export function listAskConversations(
  apiPrefix: string | undefined,
  args: { query?: ListAskConversationsQuery } = {},
  options?: RequestOptions,
): Promise<AskConversationListView> {
  return request<AskConversationListView>({ apiPrefix, method: "GET", path: `ai/ask-conversations`, query: args.query, options });
}

/** POST /api/v1/ai/ask-conversations */
export function createAskSideConversation(
  apiPrefix: string | undefined,
  args: { body: CreateAskSideConversationInput },
  options?: RequestOptions,
): Promise<AskConversationRecord> {
  return request<AskConversationRecord>({ apiPrefix, method: "POST", path: `ai/ask-conversations`, body: args.body, options });
}

/** GET /api/v1/ai/ask-conversations/:conversation_id */
export function getAskConversation(
  apiPrefix: string | undefined,
  args: { conversation_id: string },
  options?: RequestOptions,
): Promise<AskConversationRecord> {
  return request<AskConversationRecord>({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}`, options });
}

/** PATCH /api/v1/ai/ask-conversations/:conversation_id */
export function updateAskConversation(
  apiPrefix: string | undefined,
  args: { conversation_id: string; body: PatchAskConversationInput },
  options?: RequestOptions,
): Promise<AskConversationRecord> {
  return request<AskConversationRecord>({ apiPrefix, method: "PATCH", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}`, body: args.body, options });
}

/** DELETE /api/v1/ai/ask-conversations/:conversation_id */
export function deleteAskConversation(
  apiPrefix: string | undefined,
  args: { conversation_id: string },
  options?: RequestOptions,
): Promise<AskConversationDeleteResultView> {
  return request<AskConversationDeleteResultView>({ apiPrefix, method: "DELETE", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}`, options });
}

/** POST /api/v1/ai/ask-conversations/:conversation_id/close */
export function closeAskConversation(
  apiPrefix: string | undefined,
  args: { conversation_id: string; body: CloseAskConversationInput },
  options?: RequestOptions,
): Promise<CloseAskConversationView> {
  return request<CloseAskConversationView>({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/close`, body: args.body, options });
}

/** GET /api/v1/ai/ask-conversations/:conversation_id/messages */
export function listAskConversationMessages(
  apiPrefix: string | undefined,
  args: { conversation_id: string; query?: ListAskMessagesQuery },
  options?: RequestOptions,
): Promise<AskMessagePageView> {
  return request<AskMessagePageView>({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/messages`, query: args.query, options });
}

/** POST /api/v1/ai/ask-conversations/:conversation_id/messages */
export function appendAskConversationMessages(
  apiPrefix: string | undefined,
  args: { conversation_id: string; body: AppendAskMessagesInput },
  options?: RequestOptions,
): Promise<AppendAskMessagesView> {
  return request<AppendAskMessagesView>({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/messages`, body: args.body, options });
}

/** POST /api/v1/ai/ask-conversations/:conversation_id/compactions */
export function createAskCompaction(
  apiPrefix: string | undefined,
  args: { conversation_id: string; body: CreateAskCompactionInput },
  options?: RequestOptions,
): Promise<CreateAskCompactionView> {
  return request<CreateAskCompactionView>({ apiPrefix, method: "POST", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/compactions`, body: args.body, options });
}

/** GET /api/v1/ai/ask-conversations/:conversation_id/compactions */
export function listAskCompactions(
  apiPrefix: string | undefined,
  args: { conversation_id: string },
  options?: RequestOptions,
): Promise<AskCompactionListView> {
  return request<AskCompactionListView>({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/compactions`, options });
}

/** GET /api/v1/ai/ask-conversations/:conversation_id/context */
export function getAskConversationContext(
  apiPrefix: string | undefined,
  args: { conversation_id: string; query?: AskContextQuery },
  options?: RequestOptions,
): Promise<AskContextView> {
  return request<AskContextView>({ apiPrefix, method: "GET", path: `ai/ask-conversations/${encodePathParam(args.conversation_id)}/context`, query: args.query, options });
}

/** GET /api/v1/ai/ask-settings */
export function getAskSettings(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<AskSettingsRecord> {
  return request<AskSettingsRecord>({ apiPrefix, method: "GET", path: `ai/ask-settings`, options });
}

/** PATCH /api/v1/ai/ask-settings */
export function updateAskSettings(
  apiPrefix: string | undefined,
  args: { body: PatchAskSettingsInput },
  options?: RequestOptions,
): Promise<AskSettingsRecord> {
  return request<AskSettingsRecord>({ apiPrefix, method: "PATCH", path: `ai/ask-settings`, body: args.body, options });
}

/** GET /api/v1/documents/:document_id/ask-messages */
export function listDocumentAskMessages(
  apiPrefix: string | undefined,
  args: { document_id: string },
  options?: RequestOptions,
): Promise<DocumentAskMessagesView> {
  return request<DocumentAskMessagesView>({ apiPrefix, method: "GET", path: `documents/${encodePathParam(args.document_id)}/ask-messages`, options });
}

/** GET /api/v1/ai/memories */
export function listAskMemories(
  apiPrefix: string | undefined,
  args: { query?: ListAskMemoriesQuery } = {},
  options?: RequestOptions,
): Promise<AskMemoryListView> {
  return request<AskMemoryListView>({ apiPrefix, method: "GET", path: `ai/memories`, query: args.query, options });
}

/** POST /api/v1/ai/memories */
export function createAskMemory(
  apiPrefix: string | undefined,
  args: { body: CreateAskMemoryInput },
  options?: RequestOptions,
): Promise<AskMemoryCreatedView> {
  return request<AskMemoryCreatedView>({ apiPrefix, method: "POST", path: `ai/memories`, body: args.body, options });
}

/** PATCH /api/v1/ai/memories/:memory_id */
export function updateAskMemory(
  apiPrefix: string | undefined,
  args: { memory_id: string; body: PatchAskMemoryInput },
  options?: RequestOptions,
): Promise<AskMemoryRecord> {
  return request<AskMemoryRecord>({ apiPrefix, method: "PATCH", path: `ai/memories/${encodePathParam(args.memory_id)}`, body: args.body, options });
}

/** DELETE /api/v1/ai/memories/:memory_id */
export function deleteAskMemory(
  apiPrefix: string | undefined,
  args: { memory_id: string },
  options?: RequestOptions,
): Promise<AskMemoryRecord> {
  return request<AskMemoryRecord>({ apiPrefix, method: "DELETE", path: `ai/memories/${encodePathParam(args.memory_id)}`, options });
}
