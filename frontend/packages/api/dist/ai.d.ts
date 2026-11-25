import type { RequestOptions } from "./request.js";
import type { AgentsView } from "@retainpdf/contracts/ai-agents";
export type { AgentsView };
/** GET /api/v1/ai/agents：自带的排第一，后面是本机 agent（装了没有、怎么起、为什么用不了）。 */
export declare function listAiAgents(apiPrefix?: string, options?: RequestOptions): Promise<AgentsView>;
