import { useEffect, useState } from "react";
import {
  fetchAgentRuntimeConfig,
  updateAgentRuntimeConfig,
  type AgentRuntimeConfigView,
} from "@/platform/api/index.js";
import { Bot, FlaskConical, Info, Save } from "lucide-react";
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

// 前端只给 OpenAI 兼容这一种运行方式（2026-11-01 用户：其他的没有用）；保存时总是写成它。
// 后端还认 Markdown 检索问答、FX Gateway：如果现在配的是那两种，卡片里说一句，保存后改过来。
const MODE = "openai" as const;

export function AgentRuntimeSettingsCard() {
  const [config, setConfig] = useState<AgentRuntimeConfigView | null>(null);
  const [confirmationMode, setConfirmationMode] = useState<
    AgentRuntimeConfigView["agent_confirmation_mode"]
  >("explicit");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [model, setModel] = useState("deepseek-flash");
  const [modelKey, setModelKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"" | "valid" | "error">("");

  async function load({ syncForm = true } = {}) {
    const next = await fetchAgentRuntimeConfig();
    setConfig(next);
    if (syncForm) {
      setConfirmationMode(next.agent_confirmation_mode || "explicit");
      setBaseUrl(next.llm_base_url || "https://api.deepseek.com/v1");
      setModel(next.llm_model || "deepseek-flash");
      setModelKey(next.llm_api_key || "");
    }
    return next;
  }

  useEffect(() => {
    let active = true;
    fetchAgentRuntimeConfig()
      .then((next) => {
        if (!active) return;
        setConfig(next);
        setConfirmationMode(next.agent_confirmation_mode || "explicit");
        setBaseUrl(next.llm_base_url || "https://api.deepseek.com/v1");
        setModel(next.llm_model || "deepseek-flash");
        setModelKey(next.llm_api_key || "");
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

  async function waitForRuntime(expected: AgentRuntimeConfigView["configured_runtime"]) {
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
    if (!modelKey.trim() && !config?.llm_api_key_configured) {
      setMessage("请填写模型 API Key。");
      setTone("error");
      return;
    }
    setSaving(true);
    setMessage("正在保存并检查运行环境…");
    setTone("");
    try {
      const next = await updateAgentRuntimeConfig({
        expected_revision: config?.configured_revision,
        agent_runtime: MODE,
        agent_confirmation_mode: confirmationMode,
        llm_base_url: baseUrl.trim(),
        llm_model: model.trim(),
        ...(modelKey.trim() ? { llm_api_key: modelKey.trim() } : {}),
      });
      setConfig(next);
      setModelKey(next.llm_api_key ?? modelKey.trim());
      announceRuntimeConfigChanged();
      if (runtimeRestartPending(next)) {
        setRestarting(true);
        setMessage("已保存，正在重启 Agent…");
        void waitForRuntime(MODE);
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
  // 后端现在配的不是 OpenAI 兼容（以前在别处选过另外两种）：保存后才改过来。
  const otherMode = config && config.configured_runtime !== MODE ? config.configured_runtime : null;
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

      {otherMode ? (
        <p className="credential-agent-mode-note" role="note">
          <Info aria-hidden="true" />
          现在用的是「{modeLabel(otherMode)}」，保存后改用 OpenAI 兼容 Agent。
        </p>
      ) : null}

      <AgentRuntimeFields
        busy={busy}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        model={model}
        onModelChange={setModel}
        modelKey={modelKey}
        onModelKeyChange={setModelKey}
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
