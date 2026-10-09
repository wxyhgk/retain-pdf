// 会话列表与切换：历史拉取、粘性会话 hydrate、切换/删除/重命名。
// 只管理「会话维度」的副作用；消息/运行态由调用方注入的 setter 落地。

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  deleteConversation,
  getConversation,
  listConversations,
  patchConversation,
} from "@/platform/api/index.js";
import {
  loadConversationId,
  saveConversationId,
} from "../domain/home-ask-conversation-storage.js";
import { nodesFromDetail } from "../domain/home-ask-message-mapping.js";
import { recordToSession, type HomeAskSession } from "../domain/home-ask-session.js";
import type { HomeAskMessage } from "../domain/types.js";

type HomeAskSessionsDeps = {
  runningRef: { current: boolean };
  conversationIdRef: { current: string };
  messagesLength: number;
  /** 整棵树 + head 一起换掉:线程是从它们派生的。 */
  replaceThread: (nodes: HomeAskMessage[], headId: string) => void;
  setConversationId: Dispatch<SetStateAction<string>>;
  setAgentRuntime: Dispatch<SetStateAction<string>>;
};

export function useHomeAskSessions({
  runningRef,
  conversationIdRef,
  messagesLength,
  replaceThread,
  setConversationId,
  setAgentRuntime,
}: HomeAskSessionsDeps) {
  const [sessions, setSessions] = useState<HomeAskSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await listConversations({ limit: 80 });
      const list = (res.conversations || [])
        .map(recordToSession)
        .filter((s: HomeAskSession) => s.id);
      setSessions(list);
    } catch {
      // 列表失败不挡主流程
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // 启动时若有粘性 conversationId，尝试 hydrate（失败则当新对话）
  useEffect(() => {
    const id = loadConversationId();
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getConversation(id);
        if (cancelled) return;
        setConversationId(id);
        conversationIdRef.current = id;
        const thread = nodesFromDetail(detail);
        replaceThread(thread.nodes, thread.headId);
      } catch {
        if (!cancelled) {
          saveConversationId("");
          setConversationId("");
          conversationIdRef.current = "";
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationIdRef, setConversationId, replaceThread]);

  const switchSession = useCallback(async (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || runningRef.current || sessionBusy) return;
    if (next === conversationIdRef.current && messagesLength > 0) return;
    setSessionBusy(true);
    try {
      const detail = await getConversation(next);
      setConversationId(next);
      setAgentRuntime("");
      conversationIdRef.current = next;
      saveConversationId(next);
      const thread = nodesFromDetail(detail);
        replaceThread(thread.nodes, thread.headId);
    } catch {
      // 切失败保持现状
    } finally {
      setSessionBusy(false);
    }
  }, [conversationIdRef, messagesLength, runningRef, sessionBusy, setAgentRuntime, setConversationId, replaceThread]);

  const removeSession = useCallback(async (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || runningRef.current || sessionBusy) return;
    setSessionBusy(true);
    try {
      await deleteConversation(next);
      setSessions((prev) => prev.filter((s) => s.id !== next));
      if (conversationIdRef.current === next) {
        replaceThread([], "");
        setConversationId("");
        setAgentRuntime("");
        conversationIdRef.current = "";
        saveConversationId("");
      }
    } catch {
      /* ignore */
    } finally {
      setSessionBusy(false);
      void refreshSessions();
    }
  }, [conversationIdRef, refreshSessions, runningRef, sessionBusy, setAgentRuntime, setConversationId, replaceThread]);

  const renameSession = useCallback(async (id: string, title: string) => {
    const next = `${id || ""}`.trim();
    const nextTitle = `${title || ""}`.trim();
    if (!next || !nextTitle || runningRef.current || sessionBusy) return false;
    setSessionBusy(true);
    try {
      const updated = await patchConversation(next, { title: nextTitle });
      const finalTitle = `${updated?.title || nextTitle}`.trim() || nextTitle;
      setSessions((prev) => prev.map((s) => (
        s.id === next
          ? { ...s, title: finalTitle, updatedAt: `${updated?.updated_at || s.updatedAt}` }
          : s
      )));
      return true;
    } catch {
      return false;
    } finally {
      setSessionBusy(false);
    }
  }, [runningRef, sessionBusy]);

  return {
    sessions,
    sessionsLoading,
    sessionBusy,
    refreshSessions,
    switchSession,
    removeSession,
    renameSession,
  };
}
