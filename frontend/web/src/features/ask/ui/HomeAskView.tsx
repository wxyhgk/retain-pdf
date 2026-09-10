// 主页 AI 问答：Notion 式 —— 左历史侧栏（可折叠）+ 中空态居中 / 对话流

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { CREDENTIALS_CHANGED_EVENT } from "@retainpdf/reader/runtime/ai";
// hasModelApiKey 依赖 features/reader/domain 顶层注册的适配器，不可直连包。
import { hasModelApiKey } from "@/features/reader/domain.js";
import {
  fetchAgentRuntimeConfig,
  type AgentRuntimeConfigView,
} from "@/platform/api/index.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import { HomeAskComposer } from "./HomeAskComposer.js";
import { HomeAskSidebar } from "./HomeAskSidebar.js";
import { HomeAskThread, HOME_ASK_SUGGESTIONS } from "./HomeAskThread.js";
import { useHomeAskRuntime } from "./use-home-ask-runtime.js";
import type { HomeAskScope } from "../domain/types.js";
import { useAgentOperations } from "./operations/use-agent-operations.js";
import {
  activeAgentRuntimeMode,
  agentRuntimeModeLabel,
  resolveAgentRuntimeCredentialGate,
} from "../domain/agent-runtime-gate.js";

const SIDEBAR_COLLAPSED_KEY = "retainpdf.home.ai.sidebar-collapsed.v1";

function loadSidebarCollapsed(): boolean {
  try {
    return globalThis.localStorage?.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveSidebarCollapsed(collapsed: boolean) {
  try {
    globalThis.localStorage?.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function HomeAskView() {
  const services = useHomeServices();
  const {
    messages,
    isRunning,
    conversationId,
    sessions,
    sessionsLoading,
    sessionBusy,
    agentRuntime,
    operationSignals,
    send,
    stop,
    newSession,
    switchSession,
    removeSession,
    renameSession,
  } = useHomeAskRuntime();
  const [scopes, setScopes] = useState<HomeAskScope[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [runtimeConfig, setRuntimeConfig] = useState<AgentRuntimeConfigView | null>(null);
  const [runtimeConfigLoading, setRuntimeConfigLoading] = useState(true);
  const [runtimeConfigError, setRuntimeConfigError] = useState("");
  const confirmationMode = runtimeConfig?.agent_confirmation_mode || "explicit";
  const agentOperations = useAgentOperations(
    conversationId,
    isRunning,
    operationSignals,
    confirmationMode,
  );
  // 凭据保存后立刻重算门禁：订阅 credentials store + 自定义事件
  const [credTick, setCredTick] = useState(0);
  const credentialsSnap = useStoreSnapshot(services.ports.credentialsStatePort.store);
  const empty = messages.length === 0;

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    const bump = () => setCredTick((n) => n + 1);
    window.addEventListener("focus", bump);
    window.addEventListener("storage", bump);
    document.addEventListener("visibilitychange", bump);
    document.addEventListener(CREDENTIALS_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("storage", bump);
      document.removeEventListener("visibilitychange", bump);
      document.removeEventListener(CREDENTIALS_CHANGED_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let requestRevision = 0;
    const refresh = () => {
      const revision = ++requestRevision;
      setRuntimeConfigLoading(true);
      fetchAgentRuntimeConfig()
        .then((next) => {
          if (!active || revision !== requestRevision) return;
          setRuntimeConfig(next);
          setRuntimeConfigError("");
        })
        .catch((error) => {
          if (!active || revision !== requestRevision) return;
          setRuntimeConfigError(
            (error as Error)?.message || "无法读取 AI Agent 配置，请检查本机服务后重试。",
          );
        })
        .finally(() => {
          if (active && revision === requestRevision) setRuntimeConfigLoading(false);
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "hidden") refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    document.addEventListener(CREDENTIALS_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      requestRevision += 1;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      document.removeEventListener(CREDENTIALS_CHANGED_EVENT, refresh);
    };
  }, []);
  void credTick;
  void credentialsSnap;
  const credentialGate = resolveAgentRuntimeCredentialGate({
    config: runtimeConfig,
    loading: runtimeConfigLoading,
    error: runtimeConfigError,
    legacyModelKeyConfigured: hasModelApiKey(),
  });
  const displayedRuntime = agentRuntime || runtimeConfig?.active_runtime || "";

  return (
    <section
      id="home-ask-view"
      className={[
        "home-ask-view",
        empty ? "is-empty" : "is-chat",
        sidebarCollapsed ? "is-sidebar-collapsed" : "",
      ].filter(Boolean).join(" ")}
      aria-label="AI 问答"
      data-home-ask=""
    >
      <HomeAskSidebar
        sessions={sessions}
        activeId={conversationId}
        loading={sessionsLoading}
        busy={sessionBusy || isRunning}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onNew={newSession}
        onSelect={(id) => {
          void switchSession(id);
        }}
        onDelete={(id) => {
          void removeSession(id);
        }}
        onRename={(id, title) => renameSession(id, title)}
      />

      <div className="home-ask-main">
        {displayedRuntime ? (
          <div className="home-ask-runtime-badge" role="status">
            {agentRuntimeModeLabel(activeAgentRuntimeMode(displayedRuntime))}
          </div>
        ) : null}
        {empty ? (
          <div className="home-ask-hero">
            <div className="home-ask-empty-mascot" aria-hidden>
              <Sparkles size={22} strokeWidth={1.85} />
            </div>
            <h2 className="home-ask-empty-title">随时待命，有什么可以帮你？</h2>
            <HomeAskComposer
              isRunning={isRunning}
              credentialBlocked={credentialGate.blocked}
              credentialMessage={credentialGate.message}
              scopes={scopes}
              onScopesChange={setScopes}
              onSend={(q) => {
                void send(q, scopes);
              }}
              onStop={stop}
              variant="hero"
            />
            <div className="home-ask-suggestions" role="group" aria-label="推荐问题">
              {HOME_ASK_SUGGESTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.prompt}
                    type="button"
                    className="home-ask-suggestion"
                    disabled={credentialGate.blocked || isRunning}
                    onClick={() => {
                      if (credentialGate.blocked) return;
                      void send(item.prompt, scopes);
                    }}
                  >
                    <Icon size={14} strokeWidth={2} aria-hidden className="home-ask-suggestion-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="home-ask-scroll">
              <HomeAskThread
                messages={messages}
                isRunning={isRunning}
                operationsByRequestMessage={agentOperations.byRequestMessage}
                loadCandidate={agentOperations.loadCandidate}
                confirmationMode={confirmationMode}
                onOperationAction={(action, operation, options) => (
                  agentOperations.perform(action, operation, options)
                )}
              />
            </div>
            <HomeAskComposer
              isRunning={isRunning}
              credentialBlocked={credentialGate.blocked}
              credentialMessage={credentialGate.message}
              scopes={scopes}
              onScopesChange={setScopes}
              onSend={(q) => {
                void send(q, scopes);
              }}
              onStop={stop}
              variant="dock"
            />
          </>
        )}
      </div>
    </section>
  );
}
