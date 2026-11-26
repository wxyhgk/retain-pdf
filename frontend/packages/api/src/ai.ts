// ai — 阅读页提问（ACP）：列能用的 agent、问答记录。走生成的请求函数（契约 ai-agents.v1、ask-threads.v1）。
// 连 agent 是 WebSocket（GET /api/v1/ai/agents/:agent_id/acp），不经这里：web 宿主用 ACP SDK 直接连（features/reader/domain/ask-port.ts）。
import { listAiAgents as generatedListAiAgents } from "./generated/ai-agents.js";
import * as threads from "./generated/ask-threads.js";
import type { RequestOptions } from "./request.js";
import type { AgentsView } from "@retainpdf/contracts/ai-agents";
import type {
  AskThreadDeleteResultView,
  AskThreadListView,
  AskThreadView,
  CreateAskThreadInput,
  PatchAskThreadInput,
} from "@retainpdf/contracts/ask-threads";

export type { AgentsView, AskThreadDeleteResultView, AskThreadListView, AskThreadView, CreateAskThreadInput, PatchAskThreadInput };

/** GET /api/v1/ai/agents：自带的排第一，后面是本机 agent（装了没有、怎么装、为什么用不了）。 */
export function listAiAgents(apiPrefix?: string, options?: RequestOptions): Promise<AgentsView> {
  return generatedListAiAgents(apiPrefix, {}, options);
}

/** 这本书问过的地方（最近改过的在前，不带问答正文）。 */
export function listAskThreads(apiPrefix: string | undefined, documentId: string, options?: RequestOptions): Promise<AskThreadListView> {
  return threads.listAskThreads(apiPrefix, { document_id: documentId }, options);
}

/** 新的一次提问（一本书最多 500 次，超了 409 ask_thread_limit）。 */
export function createAskThread(apiPrefix: string | undefined, documentId: string, body: CreateAskThreadInput, options?: RequestOptions): Promise<AskThreadView> {
  return threads.createAskThread(apiPrefix, { document_id: documentId, body }, options);
}

/** 一次提问，带整段问答。 */
export function getAskThread(apiPrefix: string | undefined, documentId: string, threadId: string, options?: RequestOptions): Promise<AskThreadView> {
  return threads.getAskThread(apiPrefix, { document_id: documentId, thread_id: threadId }, options);
}

/** 换掉整段问答（每答完一轮写一次）、换 agent、记会话号。 */
export function updateAskThread(apiPrefix: string | undefined, documentId: string, threadId: string, body: PatchAskThreadInput, options?: RequestOptions): Promise<AskThreadView> {
  return threads.updateAskThread(apiPrefix, { document_id: documentId, thread_id: threadId, body }, options);
}

export function deleteAskThread(apiPrefix: string | undefined, documentId: string, threadId: string, options?: RequestOptions): Promise<AskThreadDeleteResultView> {
  return threads.deleteAskThread(apiPrefix, { document_id: documentId, thread_id: threadId }, options);
}

export * from "./ai-conversations.js";
