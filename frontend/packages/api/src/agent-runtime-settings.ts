import {
  API_PREFIX,
  buildApiHeaders,
  buildApiUrl,
  unwrapEnvelope,
} from "./internal/runtime.js";

export type AgentRuntimeMode = "python" | "openai" | "fx";
export type AgentConfirmationMode = "explicit" | "green_light";
export type FxGatewayMode = "inherit_env" | "official_default" | "custom";

export interface AgentRuntimeConfigView {
  schema: "retainpdf_ai_runtime_config_view_v1";
  active_runtime: string;
  configured_runtime: AgentRuntimeMode;
  agent_confirmation_mode: AgentConfirmationMode;
  configured_revision: number;
  active_revision: number;
  restart_state: "active" | "pending";
  llm_base_url: string;
  llm_model: string;
  llm_api_key_configured: boolean;
  llm_api_key_masked: string;
  fx_gateway_base_url: string;
  fx_gateway_mode: FxGatewayMode;
  fx_gateway_effective_base_url: string;
  fx_gateway_effective_chat_url: string;
  fx_gateway_api_key_configured: boolean;
  fx_gateway_api_key_masked: string;
  fx_model: string;
  restart_required: boolean;
}

export interface AgentRuntimeConfigUpdate {
  expected_revision?: number;
  agent_runtime?: AgentRuntimeMode;
  agent_confirmation_mode?: AgentConfirmationMode;
  llm_base_url?: string;
  llm_model?: string;
  llm_api_key?: string;
  clear_llm_api_key?: boolean;
  fx_gateway_base_url?: string;
  fx_gateway_api_key?: string;
  clear_fx_gateway_api_key?: boolean;
  fx_model?: string;
}

async function responseError(response: Response): Promise<Error> {
  let message = "AI Agent 配置请求失败";
  try {
    const payload = await response.json();
    message = `${payload?.detail || payload?.message || message}`;
  } catch {
    // Keep the safe fallback; never include a request payload or credential.
  }
  return new Error(`${message} (${response.status})`);
}

export async function fetchAgentRuntimeConfig({
  apiPrefix = API_PREFIX,
  fetchImpl = fetch,
}: {
  apiPrefix?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<AgentRuntimeConfigView> {
  const response = await fetchImpl(buildApiUrl(apiPrefix, "ai/runtime-config"), {
    method: "GET",
    headers: buildApiHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  return unwrapEnvelope<AgentRuntimeConfigView>(await response.json());
}

export async function updateAgentRuntimeConfig(
  update: AgentRuntimeConfigUpdate,
  {
    apiPrefix = API_PREFIX,
    fetchImpl = fetch,
  }: {
    apiPrefix?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<AgentRuntimeConfigView> {
  const response = await fetchImpl(buildApiUrl(apiPrefix, "ai/runtime-config"), {
    method: "PUT",
    headers: buildApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(update),
  });
  if (!response.ok) throw await responseError(response);
  return unwrapEnvelope<AgentRuntimeConfigView>(await response.json());
}
