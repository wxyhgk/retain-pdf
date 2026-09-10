// 主页图书馆级 AI 问答：全库 / @ 文档 + 会话列表（侧栏历史）

import { useCallback, useEffect, useRef, useState } from "react";
import {
  askLibraryAi,
  AiAskError,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  patchConversation,
  type ConversationRecord,
} from "@/platform/api/index.js";
// resolveReaderAiConfig / sanitizeAssistantAnswer 必须经 features/reader/domain：
// 该模块顶层调用 setReaderAiConfigAdapters() 注册适配器，直连
// @retainpdf/reader/runtime/ai 会跳过注册，导致「永远认为没配 Key」且 typecheck 全绿。
import {
  resolveReaderAiConfig,
  sanitizeAssistantAnswer,
} from "@/features/reader/domain.js";
import { resolveCollectionDocuments } from "../domain/document-picker.js";
import { buildHomeAskModelRequestOverrides } from "../domain/home-ask-request-config.js";
import type { HomeAskCitation, HomeAskDocScope, HomeAskMessage, HomeAskScope } from "../domain/types.js";

const CONV_STORAGE_KEY = "retainpdf.home.ai.conversation.v1";

export type HomeAskSession = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  documentId?: string;
};

export type HomeAgentOperationSignal = {
  operationId: string;
  conversationId: string;
  revision: number;
  dedupeKey: string;
};

function loadConversationId(): string {
  try {
    return `${globalThis.localStorage?.getItem(CONV_STORAGE_KEY) || ""}`.trim();
  } catch {
    return "";
  }
}

function saveConversationId(id: string) {
  const next = `${id || ""}`.trim();
  try {
    if (!next) {
      globalThis.localStorage?.removeItem(CONV_STORAGE_KEY);
      return;
    }
    globalThis.localStorage?.setItem(CONV_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function describeToolEvent(event: unknown): string {
  const e = event as { tool?: string; name?: string } | null;
  const tool = `${e?.tool || e?.name || ""}`.trim();
  if (!tool) return "正在检索…";
  if (tool.includes("search")) return "正在全文检索…";
  if (tool.includes("read")) return "正在阅读相关段落…";
  if (tool.includes("list")) return "正在浏览文档库…";
  if (tool.includes("favorite")) return "正在查阅收藏…";
  return `正在调用 ${tool}…`;
}

function labelScope(s: HomeAskScope): string {
  if (s.kind === "collection") {
    const n = s.document_count != null ? `（${s.document_count} 篇）` : "";
    return `合集「${s.title}」${n}`;
  }
  return `文档「${s.title}」`;
}

function buildScopedQuestion(
  question: string,
  scopes: HomeAskScope[],
  resolvedDocs: HomeAskDocScope[] = [],
): string {
  const q = `${question || ""}`.trim();
  if (!q) return "";
  if (!scopes.length) return q;

  const hasCollection = scopes.some((s) => s.kind === "collection");
  if (!hasCollection && scopes.length === 1 && scopes[0].kind === "document") {
    return `（范围：文档「${scopes[0].title}」）${q}`;
  }

  const scopeLines = scopes.map((s, i) => `${i + 1}. ${labelScope(s)}`).join("\n");
  if (resolvedDocs.length > 0) {
    const docLines = resolvedDocs
      .slice(0, 40)
      .map((d, i) => `  ${i + 1}. ${d.title} (document_id=${d.id})`)
      .join("\n");
    const more = resolvedDocs.length > 40 ? `\n  …共 ${resolvedDocs.length} 篇` : "";
    return (
      `请仅在下列范围内检索与回答（不要使用范围外的文献）：\n`
      + `范围选择：\n${scopeLines}\n`
      + `包含文档：\n${docLines}${more}\n\n`
      + `问题：${q}`
    );
  }
  return `请在以下范围内检索并回答：\n${scopeLines}\n\n问题：${q}`;
}

/** 展开 scopes → 文档列表；单文档硬 scope 时返回 primary */
async function resolveScopesForAsk(scopes: HomeAskScope[]): Promise<{
  primaryDoc: HomeAskDocScope | null;
  resolvedDocs: HomeAskDocScope[];
}> {
  if (!scopes.length) {
    return { primaryDoc: null, resolvedDocs: [] };
  }

  const docs: HomeAskDocScope[] = [];
  const seen = new Set<string>();

  for (const s of scopes) {
    if (s.kind === "document") {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        docs.push(s);
      }
      continue;
    }
    try {
      const list = await resolveCollectionDocuments(s.id, 100);
      for (const d of list) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          docs.push(d);
        }
      }
    } catch {
      // 合集展开失败时仍靠 prompt 里的合集名提示模型
    }
  }

  // 仅一个文档（无论直接 @ 还是合集里只有一篇）→ 硬限定
  const primaryDoc = docs.length === 1 ? docs[0] : null;
  return { primaryDoc, resolvedDocs: docs };
}

function recordToSession(c: ConversationRecord): HomeAskSession {
  const title = `${c.title || ""}`.trim() || "未命名对话";
  return {
    id: `${c.conversation_id || ""}`.trim(),
    title,
    updatedAt: `${c.updated_at || c.created_at || ""}`,
    messageCount: Number(c.message_count) || 0,
    documentId: `${c.document_id || ""}`.trim() || undefined,
  };
}

function parseCitations(raw: unknown): HomeAskCitation[] {
  if (Array.isArray(raw)) return raw as HomeAskCitation[];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function messagesFromDetail(detail: {
  messages?: Array<{
    message_id?: string;
    role?: string;
    content?: string;
    citations_json?: string;
  }>;
}): HomeAskMessage[] {
  const list = Array.isArray(detail?.messages) ? detail.messages : [];
  return list
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      id: `${m.message_id || makeId("m")}`,
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: `${m.content || ""}`,
      citations: parseCitations(m.citations_json),
      status: "complete" as const,
    }));
}

export function useHomeAskRuntime() {
  const [messages, setMessages] = useState<HomeAskMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [conversationId, setConversationId] = useState(loadConversationId);
  const [sessions, setSessions] = useState<HomeAskSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [agentRuntime, setAgentRuntime] = useState("");
  const [operationSignals, setOperationSignals] = useState<HomeAgentOperationSignal[]>([]);
  const runningRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const operationSignalKeysRef = useRef(new Set<string>());
  const operationSignalRevisionRef = useRef(0);
  /** 当前流式 assistant 消息 id，停止时用于收尾文案 */
  const streamingAssistantIdRef = useRef("");
  conversationIdRef.current = conversationId;

  const enqueueOperationSignal = useCallback(({
    operationId,
    conversationId: signalConversationId,
    dedupeKey,
  }: {
    operationId: string;
    conversationId: string;
    dedupeKey: string;
  }) => {
    const normalizedOperationId = `${operationId || ""}`.trim();
    const normalizedConversationId = `${signalConversationId || ""}`.trim();
    const normalizedKey = `${dedupeKey || ""}`.trim();
    if (!normalizedOperationId || !normalizedConversationId || !normalizedKey) return;
    if (operationSignalKeysRef.current.has(normalizedKey)) return;
    operationSignalKeysRef.current.add(normalizedKey);
    operationSignalRevisionRef.current += 1;
    const next: HomeAgentOperationSignal = {
      operationId: normalizedOperationId,
      conversationId: normalizedConversationId,
      revision: operationSignalRevisionRef.current,
      dedupeKey: normalizedKey,
    };
    // A single Agent turn may create or touch multiple operations in one React
    // tick. Keep a small signal journal instead of a last-write-wins scalar.
    setOperationSignals((current) => [...current, next].slice(-64));
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<HomeAskMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await listConversations({ limit: 80 });
      const list = (res.conversations || [])
        .map(recordToSession)
        .filter((s) => s.id);
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
        setMessages(messagesFromDetail(detail));
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
  }, []);

  const stop = useCallback(() => {
    const ctrl = abortRef.current;
    if (!ctrl) return;
    try {
      ctrl.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const newSession = useCallback(() => {
    // 新对话时若正在生成，先中止
    if (runningRef.current) {
      try {
        abortRef.current?.abort();
      } catch {
        /* ignore */
      }
    }
    setMessages([]);
    setConversationId("");
    setAgentRuntime("");
    setOperationSignals([]);
    operationSignalKeysRef.current.clear();
    conversationIdRef.current = "";
    saveConversationId("");
  }, []);

  const switchSession = useCallback(async (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || runningRef.current || sessionBusy) return;
    if (next === conversationIdRef.current && messages.length > 0) return;
    setSessionBusy(true);
    try {
      const detail = await getConversation(next);
      setConversationId(next);
      setAgentRuntime("");
      conversationIdRef.current = next;
      saveConversationId(next);
      setMessages(messagesFromDetail(detail));
    } catch {
      // 切失败保持现状
    } finally {
      setSessionBusy(false);
    }
  }, [messages.length, sessionBusy]);

  const removeSession = useCallback(async (id: string) => {
    const next = `${id || ""}`.trim();
    if (!next || runningRef.current || sessionBusy) return;
    setSessionBusy(true);
    try {
      await deleteConversation(next);
      setSessions((prev) => prev.filter((s) => s.id !== next));
      if (conversationIdRef.current === next) {
        setMessages([]);
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
  }, [refreshSessions, sessionBusy]);

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
  }, [sessionBusy]);

  const send = useCallback(async (rawQuestion: string, scopes: HomeAskScope[] = []) => {
    const question = `${rawQuestion || ""}`.trim();
    if (!question || runningRef.current) return;

    // 运行配置及密钥以本机后端的 runtime-config 为权威。浏览器里的旧配置
    // 只作为本次请求的可选覆盖；为空时让后端使用安全保存的凭据。
    const config = resolveReaderAiConfig();
    const modelRequestOverrides = buildHomeAskModelRequestOverrides(config);

    const userId = makeId("u");
    const assistantId = makeId("a");
    const displayUser = scopes.length
      ? `${question}\n\n${scopes.map((s) => (s.kind === "collection" ? `@合集:${s.title}` : `@${s.title}`)).join(" ")}`
      : question;

    // 新请求前中止上一轮
    try {
      abortRef.current?.abort();
    } catch {
      /* ignore */
    }
    const abort = new AbortController();
    abortRef.current = abort;
    streamingAssistantIdRef.current = assistantId;

    runningRef.current = true;
    setIsRunning(true);
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: displayUser, status: "complete" },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        progress: scopes.some((s) => s.kind === "collection") ? "正在解析合集…" : "正在准备…",
        status: "streaming",
      },
    ]);

    try {
      const { primaryDoc, resolvedDocs } = await resolveScopesForAsk(scopes);
      if (abort.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (scopes.some((s) => s.kind === "collection") && resolvedDocs.length === 0) {
        const emptyCol = scopes.find((s) => s.kind === "collection");
        patchMessage(assistantId, {
          content: `合集「${emptyCol?.title || ""}」里还没有文档，请先往合集加入文献后再问。`,
          progress: "",
          status: "error",
          citations: [],
        });
        return;
      }

      // 首轮请求必须先拿到 durable conversation_id。过去依赖 /ai/ask 在
      // done 才回传自动创建的会话；若 Agent 已创建 operation、但浏览器在
      // done 前断线，前端连按哪个 conversation 恢复都不知道。
      let requestConversationId = conversationIdRef.current;
      if (!requestConversationId) {
        const created = await createConversation({
          title: question.replace(/\s+/g, " ").trim().slice(0, 80),
          document_id: primaryDoc?.id || "",
        });
        requestConversationId = `${created?.conversation_id || ""}`.trim();
        if (!requestConversationId) throw new Error("创建 AI 会话失败，请重试。");
        setConversationId(requestConversationId);
        conversationIdRef.current = requestConversationId;
        saveConversationId(requestConversationId);
      }

      const scopedQuestion = buildScopedQuestion(question, scopes, resolvedDocs);
      let answerStarted = false;
      const result = await askLibraryAi({
        question: scopedQuestion,
        documentId: primaryDoc?.id || "",
        jobId: primaryDoc?.job_id || "",
        conversationId: requestConversationId,
        userMessageId: userId,
        assistantMessageId: assistantId,
        ...modelRequestOverrides,
        signal: abort.signal,
        onToolEvent: (event) => {
          if (abort.signal.aborted || answerStarted) return;
          patchMessage(assistantId, {
            progress: describeToolEvent(event),
            status: "streaming",
          });
        },
        onAgentSessionEvent: (event) => {
          const runtime = `${event?.agent_runtime || event?.runtime || ""}`.trim();
          if (runtime) setAgentRuntime(runtime);
        },
        onAgentOperationEvent: (event) => {
          const operationId = `${event?.operation_id || ""}`.trim();
          if (!operationId) return;
          const attempt = Number(event?.current_attempt) || 0;
          const latestSeq = Number(event?.latest_event_seq) || 0;
          enqueueOperationSignal({
            operationId,
            conversationId: `${event?.conversation_id || requestConversationId}`.trim(),
            dedupeKey: `${event?.event_id || `${operationId}:state:${attempt}:${latestSeq}:${event?.status || ""}`}`,
          });
        },
        onAgentConfirmationRequiredEvent: (event) => {
          const operationId = `${event?.operation_id || ""}`.trim();
          if (!operationId) return;
          enqueueOperationSignal({
            operationId,
            conversationId: requestConversationId,
            dedupeKey: `${operationId}:${event?.action || "refresh"}:${Number(event?.current_attempt) || 0}`,
          });
        },
        onAnswerDelta: (fullText: string) => {
          if (abort.signal.aborted) return;
          answerStarted = true;
          const cleaned = sanitizeAssistantAnswer(fullText || "", []);
          const show = cleaned.trim() ? cleaned : `${fullText || ""}`;
          patchMessage(assistantId, {
            content: show,
            progress: "",
            status: "streaming",
          });
        },
      });

      if (abort.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const citations = (Array.isArray(result?.citations)
        ? result.citations
        : []) as HomeAskCitation[];
      const answer = sanitizeAssistantAnswer(
        `${result?.answer || ""}`.trim() || "没有找到可用回答。",
        citations,
      );
      const nextConv = `${result?.conversationId || ""}`.trim();
      const resultRuntime = `${result?.agentRuntime || ""}`.trim();
      if (resultRuntime) setAgentRuntime(resultRuntime);
      for (const ref of Array.isArray(result?.operationRefs) ? result.operationRefs : []) {
        const operationId = typeof ref === "string"
          ? ref.trim()
          : `${ref?.operation_id || ""}`.trim();
        if (!operationId) continue;
        const attempt = typeof ref === "string" ? 0 : Number(ref?.current_attempt) || 0;
        const latestSeq = typeof ref === "string" ? 0 : Number(ref?.latest_event_seq) || 0;
        enqueueOperationSignal({
          operationId,
          conversationId: requestConversationId,
          dedupeKey: `${operationId}:done:${attempt}:${latestSeq}`,
        });
      }
      // Non-streaming JSON responses do not pass through SSE callbacks.
      for (const request of Array.isArray(result?.confirmationRequests)
        ? result.confirmationRequests
        : []) {
        const operationId = `${request?.operation_id || ""}`.trim();
        if (!operationId) continue;
        enqueueOperationSignal({
          operationId,
          conversationId: requestConversationId,
          dedupeKey: `${operationId}:${request?.action || "refresh"}:${Number(request?.current_attempt) || 0}`,
        });
      }
      if (nextConv) {
        setConversationId(nextConv);
        conversationIdRef.current = nextConv;
        saveConversationId(nextConv);
      }
      patchMessage(assistantId, {
        content: answer,
        citations,
        progress: "",
        status: "complete",
      });
      void refreshSessions();
    } catch (error) {
      const aborted = (
        (error instanceof DOMException && error.name === "AbortError")
        || (error instanceof Error && (
          error.name === "AbortError"
          || /abort/i.test(error.message)
        ))
        || abort.signal.aborted
      );
      if (aborted) {
        // 保留已流式输出的正文，追加「已停止」
        setMessages((prev) => prev.map((m) => {
          if (m.id !== assistantId) return m;
          const partial = `${m.content || ""}`.trim();
          return {
            ...m,
            content: partial
              ? `${partial}\n\n_（已停止生成）_`
              : "_（已停止生成）_",
            progress: "",
            status: "complete" as const,
          };
        }));
      } else {
        const msg = error instanceof AiAskError
          ? error.message
          : error instanceof Error
            ? error.message
            : "生成回答失败，请重试。";
        patchMessage(assistantId, {
          content: msg,
          progress: "",
          status: "error",
          citations: [],
        });
      }
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
      }
      streamingAssistantIdRef.current = "";
      runningRef.current = false;
      setIsRunning(false);
    }
  }, [enqueueOperationSignal, patchMessage, refreshSessions]);

  return {
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
    refreshSessions,
    clearChat: newSession,
  };
}
