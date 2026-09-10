import { useEffect, useState } from "react";
import {
  fetchAgentRuntimeConfig,
  updateAgentRuntimeConfig,
  type AgentRuntimeConfigView,
  type AgentRuntimeMode,
} from "@/platform/api/index.js";
// 直接取 @retainpdf/reader 的真值，不经 @/shared/reader/host/ai —— 后者会
// import 回 credentials 功能，形成 index -> ui -> host -> index 的循环，
// 循环下 defaultCredentialsStatePort 在模块初始化期为 undefined。
import { CREDENTIALS_CHANGED_EVENT } from "@retainpdf/reader/runtime/ai";
import { Bot, Check, FlaskConical, Save, ShieldCheck, Zap } from "lucide-react";
import { SecretInput } from "./SecretInput.js";

function activeMode(runtime = ""): AgentRuntimeMode | null {
  const normalized = runtime.toLowerCase();
  if (normalized.includes("openai")) return "openai";
  if (normalized.includes("fx")) return "fx";
  if (
    normalized.includes("python")
    || normalized.includes("markdown")
    || normalized.includes("retrieval")
  ) return "python";
  return null;
}

function modeLabel(mode: AgentRuntimeMode) {
  if (mode === "openai") return "OpenAI 兼容 Agent";
  return mode === "fx" ? "FX Gateway Agent" : "Markdown 检索问答";
}

function modeShortLabel(mode: AgentRuntimeMode | null) {
  if (mode === "openai") return "OpenAI";
  if (mode === "fx") return "FX";
  if (mode === "python") return "Markdown";
  return "不可用";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function announceRuntimeConfigChanged() {
  document.dispatchEvent(new CustomEvent(CREDENTIALS_CHANGED_EVENT));
}

function runtimeRestartPending(config: AgentRuntimeConfigView) {
  return (
    config.restart_required
    || config.restart_state === "pending"
    || config.active_revision !== config.configured_revision
  );
}

export function AgentRuntimeSettingsCard() {
  const [config, setConfig] = useState<AgentRuntimeConfigView | null>(null);
  const [mode, setMode] = useState<AgentRuntimeMode>("python");
  const [confirmationMode, setConfirmationMode] = useState<
    AgentRuntimeConfigView["agent_confirmation_mode"]
  >("explicit");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [fxGatewayBaseUrl, setFxGatewayBaseUrl] = useState("");
  const [fxModel, setFxModel] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [gatewayKey, setGatewayKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"" | "valid" | "error">("");

  async function load({ syncForm = true } = {}) {
    const next = await fetchAgentRuntimeConfig();
    setConfig(next);
    if (syncForm) {
      setMode(next.configured_runtime || activeMode(next.active_runtime) || "python");
      setConfirmationMode(next.agent_confirmation_mode || "explicit");
      setBaseUrl(next.llm_base_url || "https://api.deepseek.com/v1");
      setModel(next.llm_model || "deepseek-v4-flash");
      setFxGatewayBaseUrl(next.fx_gateway_base_url || "");
      setFxModel(next.fx_model || "");
    }
    return next;
  }

  useEffect(() => {
    let active = true;
    fetchAgentRuntimeConfig()
      .then((next) => {
        if (!active) return;
        setConfig(next);
        setMode(next.configured_runtime || activeMode(next.active_runtime) || "python");
        setConfirmationMode(next.agent_confirmation_mode || "explicit");
        setBaseUrl(next.llm_base_url || "https://api.deepseek.com/v1");
        setModel(next.llm_model || "deepseek-v4-flash");
        setFxGatewayBaseUrl(next.fx_gateway_base_url || "");
        setFxModel(next.fx_model || "");
        if (runtimeRestartPending(next)) {
          setRestarting(true);
          setMessage("正在重启 Agent…");
          void waitForRuntime(next.configured_runtime);
        }
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error?.message || "无法读取 AI Agent 配置");
        setTone("error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function waitForRuntime(expected: AgentRuntimeMode) {
    try {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await delay(500);
        try {
          const next = await load({ syncForm: false });
          if (
            activeMode(next.active_runtime) === expected
            && !runtimeRestartPending(next)
          ) {
            setMessage(`${modeLabel(expected)}已启用，密钥仅保存在本机后端。`);
            setTone("valid");
            announceRuntimeConfigChanged();
            return;
          }
        } catch {
          // Expected while the supervised AI child is restarting.
        }
      }
      setMessage("配置已保存，AI 服务仍在重启；稍后重新打开设置即可确认。");
      setTone("");
      announceRuntimeConfigChanged();
    } finally {
      setRestarting(false);
    }
  }

  async function save() {
    if (mode !== "fx" && !modelKey.trim() && !config?.llm_api_key_configured) {
      setMessage(`${modeLabel(mode)}模式需要模型 API Key。`);
      setTone("error");
      return;
    }
    if (
      mode === "fx"
      && !gatewayKey.trim()
      && !config?.fx_gateway_api_key_configured
    ) {
      setMessage("FX Agent 模式需要 Gateway Key。");
      setTone("error");
      return;
    }
    setSaving(true);
    setMessage("正在安全保存并检查运行环境…");
    setTone("");
    try {
      const next = await updateAgentRuntimeConfig({
        expected_revision: config?.configured_revision,
        agent_runtime: mode,
        agent_confirmation_mode: confirmationMode,
        llm_base_url: baseUrl.trim(),
        llm_model: model.trim(),
        fx_gateway_base_url: fxGatewayBaseUrl.trim(),
        fx_model: fxModel.trim(),
        ...(modelKey.trim() ? { llm_api_key: modelKey.trim() } : {}),
        ...(gatewayKey.trim()
          ? { fx_gateway_api_key: gatewayKey.trim() }
          : {}),
      });
      setConfig(next);
      setModelKey("");
      setGatewayKey("");
      announceRuntimeConfigChanged();
      if (runtimeRestartPending(next)) {
        setRestarting(true);
        setMessage("已保存，正在重启 Agent…");
        void waitForRuntime(mode);
      } else {
        setMessage("已安全保存，浏览器未保留密钥。");
        setTone("valid");
      }
    } catch (error) {
      const errorMessage = (error as Error)?.message || "保存失败";
      if (errorMessage.includes("(409)")) {
        try {
          await load({ syncForm: false });
        } catch {
          // Keep the user's draft even when refreshing the revision fails.
        }
        setMessage("配置已在其他窗口更新。当前输入已保留，请确认后重新保存。");
      } else {
        setMessage(errorMessage);
      }
      setTone("error");
    } finally {
      setSaving(false);
    }
  }

  const currentMode = activeMode(config?.active_runtime || "");
  const busy = loading || saving || restarting;
  const statusClass = [
    "credential-agent-runtime-message",
    tone === "valid" ? "is-valid" : "",
    tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <section className="credential-card credential-agent-card">
      <div className="credential-card-head credential-card-head-rich credential-agent-head">
        <span className="credential-card-icon" aria-hidden="true"><Bot /></span>
        <div className="credential-card-copy">
          <h3 className="credential-agent-title">
            AI Agent
            <span className="credential-agent-beta" title="测试阶段">
              <FlaskConical aria-hidden="true" />
              Beta
            </span>
          </h3>
        </div>
        <span
          className="credential-agent-runtime-badge"
          title={currentMode ? `当前运行：${modeLabel(currentMode)}` : "当前运行状态不可用"}
          aria-live="polite"
        >
          <span className="credential-agent-runtime-dot" aria-hidden="true" />
          {loading ? "读取中" : restarting ? "切换中" : modeShortLabel(currentMode)}
        </span>
      </div>

      <div className="credential-agent-grid">
        <label className="credential-agent-mode-field">
          <span className="developer-label">运行模式</span>
          <select
            aria-label="AI Agent 运行模式"
            value={mode}
            onChange={(event) => setMode(event.target.value as AgentRuntimeMode)}
            disabled={busy}
          >
            <option value="python">Markdown 检索问答</option>
            <option value="openai">OpenAI 兼容 Agent</option>
            <option value="fx">FX Gateway Agent</option>
          </select>
        </label>

        {mode !== "fx" ? (
          <>
            <label className="credential-agent-url-field">
              <span className="developer-label">模型 API URL</span>
              <input
                aria-label="模型 API URL"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="credential-agent-model-field">
              <span className="developer-label">模型</span>
              <input
                aria-label="AI 模型"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="credential-agent-key-field">
              <span className="developer-label">模型 API Key</span>
              <SecretInput
                aria-label="模型 API Key"
                secretLabel="模型 API Key"
                autoComplete="new-password"
                value={modelKey}
                placeholder={
                  config?.llm_api_key_configured
                    ? `已保存 ${config.llm_api_key_masked}`
                    : "输入后将安全保存"
                }
                onChange={(event) => setModelKey(event.target.value)}
                disabled={busy}
              />
            </label>
          </>
        ) : (
          <>
            <label className="credential-agent-url-field">
              <span className="developer-label">FX Gateway URL（可选）</span>
              <input
                aria-label="FX Gateway URL"
                type="url"
                value={fxGatewayBaseUrl}
                placeholder="http://127.0.0.1:端口"
                onChange={(event) => setFxGatewayBaseUrl(event.target.value)}
                disabled={busy}
              />
            </label>
            <p className="credential-agent-fx-url-note">
              仅支持本机 HTTP + 端口；远程地址请使用 OpenAI 模式。留空使用官方 Gateway。
            </p>
            <label className="credential-agent-model-field">
              <span className="developer-label">FX 模型（可选）</span>
              <input
                aria-label="FX 模型"
                value={fxModel}
                placeholder="使用 Gateway 默认模型"
                onChange={(event) => setFxModel(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="credential-agent-key-field">
              <span className="developer-label">Gateway Key</span>
              <SecretInput
                aria-label="FX Gateway Key"
                secretLabel="FX Gateway Key"
                autoComplete="new-password"
                value={gatewayKey}
                placeholder={
                  config?.fx_gateway_api_key_configured
                    ? `已保存 ${config.fx_gateway_api_key_masked}`
                    : "输入后将安全保存"
                }
                onChange={(event) => setGatewayKey(event.target.value)}
                disabled={busy}
              />
            </label>
          </>
        )}
      </div>

      <fieldset className="credential-agent-confirmation">
        <legend>
          操作确认
          <span>全局设置</span>
        </legend>
        <div className="credential-agent-confirmation-options" role="radiogroup" aria-label="Agent 操作确认方式">
          <button
            type="button"
            role="radio"
            aria-checked={confirmationMode === "explicit"}
            className={confirmationMode === "explicit" ? "is-selected" : ""}
            onClick={() => setConfirmationMode("explicit")}
            disabled={busy}
          >
            <ShieldCheck aria-hidden="true" />
            <span>需要确认</span>
            {confirmationMode === "explicit" ? <Check className="credential-agent-confirmation-check" aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={confirmationMode === "green_light"}
            className={confirmationMode === "green_light" ? "is-selected" : ""}
            onClick={() => setConfirmationMode("green_light")}
            disabled={busy}
          >
            <Zap aria-hidden="true" />
            <span>绿灯模式</span>
            {confirmationMode === "green_light" ? <Check className="credential-agent-confirmation-check" aria-hidden="true" /> : null}
          </button>
        </div>
        {confirmationMode === "green_light" ? (
          <p>
            AI 可直接执行并应用受支持的 PDF 操作，无需逐步确认；不允许执行 shell 或任意系统命令。
          </p>
        ) : null}
      </fieldset>

      <div className="credential-agent-actions">
        <span className={statusClass} role="status" aria-live="polite">{message}</span>
        <button
          type="button"
          className="app-button secondary credential-agent-save-button"
          onClick={() => void save()}
          disabled={busy}
        >
          <Save aria-hidden="true" />
          {saving ? "正在保存…" : restarting ? "重启中…" : "保存设置"}
        </button>
      </div>
    </section>
  );
}
