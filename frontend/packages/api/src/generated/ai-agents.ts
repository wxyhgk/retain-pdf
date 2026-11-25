// 生成文件，不要手改。来源：contracts/ai-agents.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client

import type {
  AgentsView,
} from "@retainpdf/contracts/ai-agents";
import { encodePathParam, request, type RequestOptions } from "../request.js";

/** GET /api/v1/ai/agents */
export function listAiAgents(
  apiPrefix: string | undefined,
  _args: Record<string, never> = {},
  options?: RequestOptions,
): Promise<AgentsView> {
  return request<AgentsView>({ apiPrefix, method: "GET", path: `ai/agents`, options });
}
