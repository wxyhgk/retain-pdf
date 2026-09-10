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
export declare function fetchAgentRuntimeConfig({ apiPrefix, fetchImpl, }?: {
    apiPrefix?: string;
    fetchImpl?: typeof fetch;
}): Promise<AgentRuntimeConfigView>;
export declare function updateAgentRuntimeConfig(update: AgentRuntimeConfigUpdate, { apiPrefix, fetchImpl, }?: {
    apiPrefix?: string;
    fetchImpl?: typeof fetch;
}): Promise<AgentRuntimeConfigView>;
