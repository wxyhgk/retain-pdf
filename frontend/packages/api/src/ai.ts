// ai — 阅读页提问（ACP）：列能用的 agent。走生成的请求函数（契约 ai-agents.v1）。
// 连 agent 是 WebSocket（GET /api/v1/ai/agents/:agent_id/acp），不经这里：web 宿主用 ACP SDK 直接连（features/reader/domain/ask-port.ts）。
import { listAiAgents as generatedListAiAgents } from "./generated/ai-agents.js";
import type { RequestOptions } from "./request.js";
import type { AgentsView } from "@retainpdf/contracts/ai-agents";

export type { AgentsView };

/** GET /api/v1/ai/agents：自带的排第一，后面是本机 agent（装了没有、怎么起、为什么用不了）。 */
export function listAiAgents(apiPrefix?: string, options?: RequestOptions): Promise<AgentsView> {
  return generatedListAiAgents(apiPrefix, {}, options);
}
