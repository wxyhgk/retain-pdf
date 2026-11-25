import type { AgentsView } from "@retainpdf/contracts/ai-agents";
import { type RequestOptions } from "../request.js";
/** GET /api/v1/ai/agents */
export declare function listAiAgents(apiPrefix: string | undefined, _args?: Record<string, never>, options?: RequestOptions): Promise<AgentsView>;
