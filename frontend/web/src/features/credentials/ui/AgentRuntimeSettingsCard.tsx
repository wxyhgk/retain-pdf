import { useEffect, useState } from "react";
import {
  fetchAgentRuntimeConfig,
  updateAgentRuntimeConfig,
  type AgentRuntimeConfigView,
  type AgentRuntimeMode,
} from "@/platform/api/index.js";
import { Bot, FlaskConical, Save } from "lucide-react";
import { DialogFooter } from "@retainpdf/ui";
import { FormStatusLine } from "@retainpdf/ui";
import {
  activeMode,
  announceRuntimeConfigChanged,
  delay,
  modeLabel,
  modeShortLabel,
  runtimeRestartPending,
} from "./agent-runtime-helpers.js";
import { AgentRuntimeConfirmationField } from "./AgentRuntimeConfirmationField.jsx";
import { AgentRuntimeFields } from "./AgentRuntimeFields.jsx";

export function AgentRuntimeSettingsCard() {
  const [config, setConfig] = useState<AgentRuntimeConfigView | null>(null);
  const [mode, setMode] = useState<AgentRuntimeMode>("python");
  const [confirmationMode, setConfirmationMode] = useState<
    AgentRuntimeConfigView["agent_confirmation_mode"]
  >("explicit");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-flash");
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
      setModel(next.llm_model || "deepseek-flash");
      setFxGatewayBaseUrl(next.fx_gateway_base_url || "");
      setFxModel(next.fx_model || "");
      setModelKey(next.llm_api_key || "");
      setGatewayKey(next.fx_gateway_api_key || "");
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
        setModel(next.llm_model || "deepseek-flash");
        setFxGatewayBaseUrl(next.fx_gateway_base_url || "");
        setFxModel(next.fx_model || "");
        setModelKey(next.llm_api_key || "");
        setGatewayKey(next.fx_gateway_api_key || "");
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
            setMessage(`${modeLabel(expected)}已启用，配置已保存在本机。`);
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
    setMessage("正在保存并检查运行环境…");
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
      setModelKey(next.llm_api_key ?? modelKey.trim());
      setGatewayKey(next.fx_gateway_api_key ?? gatewayKey.trim());
      announceRuntimeConfigChanged();
      if (runtimeRestartPending(next)) {
        setRestarting(true);
        setMessage("已保存，正在重启 Agent…");
        void waitForRuntime(mode);
      } else {
        setMessage("已保存在本机，可直接查看和修改 Key。");
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
  const statusState = { message, tone };

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

      <AgentRuntimeFields
        mode={mode}
        onModeChange={setMode}
        config={config}
        busy={busy}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        model={model}
        onModelChange={setModel}
        modelKey={modelKey}
        onModelKeyChange={setModelKey}
        fxGatewayBaseUrl={fxGatewayBaseUrl}
        onFxGatewayBaseUrlChange={setFxGatewayBaseUrl}
        fxModel={fxModel}
        onFxModelChange={setFxModel}
        gatewayKey={gatewayKey}
        onGatewayKeyChange={setGatewayKey}
      />

      <AgentRuntimeConfirmationField
        confirmationMode={confirmationMode}
        onConfirmationModeChange={setConfirmationMode}
        busy={busy}
      />

      <DialogFooter className="credential-agent-actions">
        <FormStatusLine status={message ? statusState : null} className="credential-agent-runtime-message" />
        <button
          type="button"
          className="app-button secondary credential-agent-save-button"
          onClick={() => void save()}
          disabled={busy}
        >
          <Save aria-hidden="true" />
          {saving ? "正在保存…" : restarting ? "重启中…" : "保存设置"}
        </button>
      </DialogFooter>
    </section>
  );
}
