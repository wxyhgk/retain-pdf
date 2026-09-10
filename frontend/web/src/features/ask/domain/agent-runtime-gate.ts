export type AgentRuntimeCredentialConfig = {
  active_runtime?: string;
  configured_runtime?: "python" | "openai" | "fx";
  llm_api_key_configured?: boolean;
  fx_gateway_api_key_configured?: boolean;
  restart_state?: "active" | "pending";
  restart_required?: boolean;
  active_revision?: number;
  configured_revision?: number;
};

export type AgentRuntimeCredentialGate = {
  blocked: boolean;
  message: string;
  mode: AgentRuntimeMode;
};

export type AgentRuntimeMode = "python" | "openai" | "fx";

export function activeAgentRuntimeMode(runtime = ""): AgentRuntimeMode {
  const normalized = runtime.toLowerCase();
  if (normalized.includes("openai")) return "openai";
  return normalized.includes("fx") ? "fx" : "python";
}

export function agentRuntimeModeLabel(mode: AgentRuntimeMode): string {
  if (mode === "openai") return "OpenAI 兼容 Agent";
  return mode === "fx" ? "FX Gateway Agent" : "Markdown 检索问答";
}

export function resolveAgentRuntimeCredentialGate({
  config,
  loading,
  error,
  legacyModelKeyConfigured,
}: {
  config: AgentRuntimeCredentialConfig | null;
  loading: boolean;
  error?: string;
  legacyModelKeyConfigured: boolean;
}): AgentRuntimeCredentialGate {
  if (!config) {
    if (loading) {
      return {
        blocked: true,
        message: "正在读取 AI Agent 配置…",
        mode: "python",
      };
    }
    return {
      blocked: true,
      message: error || "无法读取 AI Agent 配置，请检查本机服务后重试。",
      mode: "python",
    };
  }

  const mode = activeAgentRuntimeMode(config.active_runtime);
  const revisionMismatch = (
    typeof config.active_revision === "number"
    && typeof config.configured_revision === "number"
    && config.active_revision !== config.configured_revision
  );
  if (
    config.restart_required
    || config.restart_state === "pending"
    || revisionMismatch
    || (config.configured_runtime && config.configured_runtime !== mode)
  ) {
    const target = agentRuntimeModeLabel(config.configured_runtime || "python");
    return {
      blocked: true,
      message: `AI 服务正在切换到${target}，请稍候…`,
      mode,
    };
  }

  if (mode === "fx") {
    return {
      blocked: !config.fx_gateway_api_key_configured,
      message: config.fx_gateway_api_key_configured
        ? ""
        : "请先在设置 → API 设置 → AI Agent 中填写 Gateway Key",
      mode,
    };
  }

  // Browser delivery keeps the model key in browser-local credential state
  // and sends it as a per-request override. Both Python retrieval and the
  // OpenAI-compatible runtime support that request contract, so the homepage
  // gate must accept it in either model-backed mode. FX remains separate and
  // continues to require its dedicated Gateway credential above.
  const modelKeyConfigured = Boolean(
    config.llm_api_key_configured || legacyModelKeyConfigured,
  );
  return {
    blocked: !modelKeyConfigured,
    message: modelKeyConfigured
      ? ""
      : "请先在设置 → API 设置 → AI Agent 中填写模型 API Key",
    mode,
  };
}
