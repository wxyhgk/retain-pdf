//! AI：阅读页提问的 agent（列表、ACP 桥）。逻辑在 providers 领域的 `acp`。

use crate::app::AppState;
use crate::routes::ai;

crate::endpoints! {
    state: AppState;
    owner: providers;
    /// 阅读页提问能用哪些 agent（自带模型、本机装的 ACP 官方登记表里的 agent）
    GET "/api/v1/ai/agents" => ai::list_agents, signed by(web);
    /// 阅读页提问的 ACP 桥（WebSocket，一条文字消息一条 JSON-RPC；浏览器用 `?api_key=` 认证）
    GET "/api/v1/ai/agents/:agent_id/acp" => ai::acp_socket, signed by(web);
}
