// Trang chủ AI vấn đáp：Notion Cái —— Thanh bên Lịch sử Trái（Có thể thu gọn）+ Trung tâm rỗng / Luồng hội thoại

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  CREDENTIALS_CHANGED_EVENT,
  hasModelApiKey,
} from "../../../../js/reader/ai/config.js";
import { useStoreSnapshot } from "../../../../shared/react/use-store.js";
import { useHomeServices } from "../../home-services-context.js";
import { HomeAskComposer } from "./HomeAskComposer.js";
import { HomeAskSidebar } from "./HomeAskSidebar.js";
import { HomeAskThread, HOME_ASK_SUGGESTIONS } from "./HomeAskThread.js";
import { useHomeAskRuntime } from "./use-home-ask-runtime.js";
import type { HomeAskScope } from "./types.js";

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
    send,
    stop,
    newSession,
    switchSession,
    removeSession,
    renameSession,
  } = useHomeAskRuntime();
  const [scopes, setScopes] = useState<HomeAskScope[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  // Tính toán lại quyền kiểm soát truy cập ngay khi thông tin đăng nhập được lưu：đặt credentials store + Sự kiện tùy chỉnh
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
  void credTick;
  void credentialsSnap;
  const missingLlmKey = !hasModelApiKey();

  return (
    <section
      id="home-ask-view"
      className={[
        "home-ask-view",
        empty ? "is-empty" : "is-chat",
        sidebarCollapsed ? "is-sidebar-collapsed" : "",
      ].filter(Boolean).join(" ")}
      aria-label="AI Hỏi đáp"
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
        {empty ? (
          <div className="home-ask-hero">
            <div className="home-ask-empty-mascot" aria-hidden>
              <Sparkles size={22} strokeWidth={1.85} />
            </div>
            <h2 className="home-ask-empty-title">Sẵn sàng giúp đỡ, tôi có thể giúp gì cho bạn?</h2>
            <HomeAskComposer
              isRunning={isRunning}
              missingLlmKey={missingLlmKey}
              scopes={scopes}
              onScopesChange={setScopes}
              onSend={(q) => {
                void send(q, scopes);
              }}
              onStop={stop}
              variant="hero"
            />
            <div className="home-ask-suggestions" role="group" aria-label="Câu hỏi gợi ý">
              {HOME_ASK_SUGGESTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.prompt}
                    type="button"
                    className="home-ask-suggestion"
                    disabled={missingLlmKey || isRunning}
                    onClick={() => {
                      if (missingLlmKey) return;
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
              <HomeAskThread messages={messages} isRunning={isRunning} />
            </div>
            <HomeAskComposer
              isRunning={isRunning}
              missingLlmKey={missingLlmKey}
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
