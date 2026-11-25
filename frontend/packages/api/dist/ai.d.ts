import type { RequestOptions } from "./request.js";
import type { AgentsView } from "@retainpdf/contracts/ai-agents";
import type { AskThreadDeleteResultView, AskThreadListView, AskThreadView, CreateAskThreadInput, PatchAskThreadInput } from "@retainpdf/contracts/ask-threads";
export type { AgentsView, AskThreadDeleteResultView, AskThreadListView, AskThreadView, CreateAskThreadInput, PatchAskThreadInput };
/** GET /api/v1/ai/agents：自带的排第一，后面是本机 agent（装了没有、怎么装、为什么用不了）。 */
export declare function listAiAgents(apiPrefix?: string, options?: RequestOptions): Promise<AgentsView>;
/** 这本书问过的地方（最近改过的在前，不带问答正文）。 */
export declare function listAskThreads(apiPrefix: string | undefined, documentId: string, options?: RequestOptions): Promise<AskThreadListView>;
/** 新的一次提问（一本书最多 500 次，超了 409 ask_thread_limit）。 */
export declare function createAskThread(apiPrefix: string | undefined, documentId: string, body: CreateAskThreadInput, options?: RequestOptions): Promise<AskThreadView>;
/** 一次提问，带整段问答。 */
export declare function getAskThread(apiPrefix: string | undefined, documentId: string, threadId: string, options?: RequestOptions): Promise<AskThreadView>;
/** 换掉整段问答（每答完一轮写一次）、换 agent、记会话号。 */
export declare function updateAskThread(apiPrefix: string | undefined, documentId: string, threadId: string, body: PatchAskThreadInput, options?: RequestOptions): Promise<AskThreadView>;
export declare function deleteAskThread(apiPrefix: string | undefined, documentId: string, threadId: string, options?: RequestOptions): Promise<AskThreadDeleteResultView>;
