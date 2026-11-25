// 生成文件，不要手改。来源：contracts/ai-agents.v1.schema.json 的 endpoints。
// 重新生成：npm --prefix frontend/packages/api run generate:client
import { request } from "../request.js";
/** GET /api/v1/ai/agents */
export function listAiAgents(apiPrefix, _args = {}, options) {
    return request({ apiPrefix, method: "GET", path: `ai/agents`, options });
}
