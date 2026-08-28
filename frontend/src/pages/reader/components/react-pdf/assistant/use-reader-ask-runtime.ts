// assistant-ui ExternalStore: tách progress/body + cây nhánh message + snapshot cục bộ.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExportedMessageRepository,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { describeToolEvent } from "../../../legacy/ai/answer-view.js";
import {
  armReaderAiClickShield,
  clearThreadBranchSnapshot,
  createReaderAskAnswerer,
  createReaderMarkdownAnswerer,
  defaultReaderDataPort,
  deleteConversation,
  forkConversationFromPath,
  getConversation,
  listConversations,
  loadStoredConversationId,
  loadThreadBranchSnapshot,
  lockReaderAiNavigation,
  messagesToBranchItems,
  nextForkConversationTitle,
  patchConversation,
  sanitizeAssistantAnswer,
  saveThreadBranchSnapshot,
  type AiCitationLike,
  type ConversationRecord,
  type ThreadBranchItem,
  type ThreadBranchMessage,
  type ThreadBranchSnapshot,
} from "../../../external.js";

export type ReaderAskStoreMessage = ThreadBranchMessage & {
  citations?: AiCitationLike[];
  status?: ThreadMessageLike["status"];
};

type TreeItem = {
  parentId: string | null;
  message: ReaderAskStoreMessage;
};

const SUGGESTIONS = [
  { prompt: "What are the main conclusions of this paper?" },
  { prompt: "What methods or models did the authors use?" },
  { prompt: "What key results or data are reported?" },
];

function textFromAppend(message: AppendMessage): string {
  const content = message.content as unknown;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (part && typeof part === "object" && (part as { type?: string }).type === "text") {
        return `${(part as { text?: string }).text || ""}`;
      }
      return "";
    })
    .join("")
    .trim();
}

function toThreadMessageLike(message: ReaderAskStoreMessage): ThreadMessageLike {
  // Lưu ý: fromThreadMessageLike sẽ bỏ text part có trim rỗng;
  // dùng dấu chấm nhìn thấy được làm placeholder streaming để tránh content=[] khiến bubble không mount Parts.
  const raw = message.content;
  const isAssistant = message.role === "assistant";
  const content = raw.trim()
    ? raw
    : isAssistant && message.status?.type === "running"
      ? "…"
      : raw;
  // assistant-ui fromBranchableArray: status chỉ được xuất hiện trên assistant, nếu không sẽ lỗi:
  // Uncaught Error: status is only supported for assistant messages
  return {
    id: message.id,
    role: message.role,
    content: [{ type: "text", text: content || "" }],
    ...(isAssistant && message.status ? { status: message.status } : {}),
    metadata: {
      custom: {
        citations: message.citations || [],
        progress: message.progress || "",
        storeId: message.id,
      },
    },
  };
}

function shouldFallbackToLocal(error: unknown): boolean {
  const status = Number((error as { status?: number })?.status) || 0;
  const msg = `${(error as Error)?.message || ""}`;
  return status === 502 || /\b502\b/.test(msg);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCitations(raw: unknown): AiCitationLike[] {
  if (!Array.isArray(raw)) return [];
  const out: AiCitationLike[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as AiCitationLike;
    const blockId = `${c.block_id || ""}`.trim();
    if (!blockId) continue;
    let pageIdx: number | undefined;
    const rawPage = c.page_idx ?? c.page;
    if (rawPage !== undefined && rawPage !== null && `${rawPage}`.trim() !== "") {
      const n = Number(rawPage);
      if (Number.isFinite(n) && n >= 0) pageIdx = Math.floor(n);
    }
    if (pageIdx === undefined) {
      const m = blockId.match(/(?:^|[^0-9])p0*([1-9]\d*)(?:-|_|\b)/i);
      if (m) pageIdx = Math.max(0, Number(m[1]) - 1);
    }
    out.push({
      ...c,
      block_id: blockId,
      ref: c.ref,
      page_idx: pageIdx,
      job_id: `${c.job_id || ""}`.trim(),
      document_id: `${c.document_id || ""}`.trim(),
      snippet: `${c.snippet || ""}`.trim(),
    });
  }
  return out;
}

function snapshotFromTree(
  items: readonly TreeItem[],
  headId: string | null,
): ThreadBranchSnapshot {
  return {
    version: 1,
    headId,
    items: items.map((item) => ({
      parentId: item.parentId,
      message: {
        id: item.message.id,
        role: item.message.role,
        content: item.message.content,
        ...(item.message.progress ? { progress: item.message.progress } : {}),
        ...(item.message.citations?.length
          ? { citations: item.message.citations }
          : {}),
        ...(item.message.status
          ? {
            status: {
              type: item.message.status.type,
              ...("reason" in item.message.status && item.message.status.reason
                ? { reason: `${item.message.status.reason}` }
                : {}),
            },
          }
          : {}),
      },
    })) as ThreadBranchItem[],
  };
}

function treeFromSnapshot(snapshot: ThreadBranchSnapshot): {
  items: TreeItem[];
  headId: string | null;
} {
  const items: TreeItem[] = snapshot.items.map((item) => ({
    parentId: item.parentId,
    message: {
      ...item.message,
      citations: (item.message.citations || []) as AiCitationLike[],
      status: item.message.status as ReaderAskStoreMessage["status"],
    },
  }));
  return { items, headId: snapshot.headId };
}

function visibleMessages(
  items: readonly TreeItem[],
  headId: string | null,
): ReaderAskStoreMessage[] {
  if (!items.length) return [];
  const byId = new Map(items.map((i) => [i.message.id, i]));
  const head = (headId && byId.get(headId)) || items[items.length - 1];
  if (!head) return [];
  const chain: ReaderAskStoreMessage[] = [];
  let cur: TreeItem | undefined = head;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.message.id)) {
    guard.add(cur.message.id);
    chain.push(cur.message);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}

function findMessage(
  items: readonly TreeItem[],
  id: string | null | undefined,
): ReaderAskStoreMessage | null {
  if (!id) return null;
  return items.find((i) => i.message.id === id)?.message ?? null;
}

/** Lần theo parent từ message bất kỳ về root để lấy chuỗi TreeItem trên path (root -> leaf). */
function pathItemsToMessage(
  items: readonly TreeItem[],
  targetId: string,
): TreeItem[] {
  const byId = new Map(items.map((i) => [i.message.id, i]));
  let cur = byId.get(targetId);
  if (!cur) return [];
  const chain: TreeItem[] = [];
  const guard = new Set<string>();
  while (cur && !guard.has(cur.message.id)) {
    guard.add(cur.message.id);
    chain.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}

/**
 * Path used for branching: prefer the parent chain; when the chain is broken
 * or parent is missing, fall back to the visible path up to the target answer.
 * Avoid forking only a partial chain, which would make the branch look unlike a
 * new conversation or lose its context.
 */
function pathForBranch(
  items: readonly TreeItem[],
  targetId: string,
  headId: string | null,
): TreeItem[] {
  const tid = `${targetId || ""}`.trim();
  if (!tid || !items.length) return [];

  // aui sometimes uses its own id; prefer an exact match, then current head / latest assistant.
  let resolvedId = tid;
  if (!items.some((i) => i.message.id === resolvedId)) {
    if (headId && items.some((i) => i.message.id === headId)) {
      resolvedId = headId;
    } else {
      const lastAssist = [...items].reverse().find((i) => i.message.role === "assistant");
      if (lastAssist) resolvedId = lastAssist.message.id;
    }
  }

  let path = pathItemsToMessage(items, resolvedId);
  // Complete parent chain: at least user + assistant.
  if (path.length >= 2 && path[path.length - 1].message.role === "assistant") {
    return path;
  }
  if (path.length === 1 && path[0].message.role === "user") {
    path = [];
  }

  // Fallback: follow the current visible linear order from root to target, inclusive.
  const visible = visibleMessages(items, headId || resolvedId);
  let idx = visible.findIndex((m) => m.id === resolvedId);
  if (idx < 0) {
    // Last fallback: the whole visible path, with head as the leaf.
    idx = visible.length - 1;
  }
  if (idx < 0) return path;
  const byId = new Map(items.map((i) => [i.message.id, i]));
  const linear: TreeItem[] = [];
  for (let i = 0; i <= idx; i += 1) {
    const row = byId.get(visible[i].id);
    if (row) linear.push(row);
  }
  // Ensure the path ends with an assistant message.
  while (linear.length && linear[linear.length - 1].message.role !== "assistant") {
    linear.pop();
  }
  return linear.length ? linear : path;
}

function treeItemsFromBranchItems(
  branchItems: ReturnType<typeof messagesToBranchItems>,
): TreeItem[] {
  return branchItems.map((item) => ({
    parentId: item.parentId,
    message: {
      ...item.message,
      citations: (item.message.citations || []) as AiCitationLike[],
      status: item.message.status as ReaderAskStoreMessage["status"],
    },
  }));
}

export type ReaderAskSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  active: boolean;
};

export function useReaderAskRuntime(options: {
  jobId: string;
  enabled: boolean;
}) {
  const { jobId, enabled } = options;
  const [items, setItems] = useState<TreeItem[]>([]);
  const [headId, setHeadId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sessions, setSessions] = useState<ConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const runningRef = useRef(false);
  // Cancellation handle for one runAssistant call: onCancel, switching sessions,
  // new sessions, and rapid sends all abort through this.
  // The P0-2/3/4 audit issues shared this missing root cause: stop did not
  // interrupt streams, completed streams revived canceled messages, and stale
  // streams wrote conversation stickiness back. This controller removes that.
  const runAbortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  const headIdRef = useRef(headId);
  const activeConversationIdRef = useRef(activeConversationId);
  const streamRafRef = useRef<number | null>(null);
  const pendingContentRef = useRef("");
  const streamAssistantIdRef = useRef("");
  /** Streaming content bypass, independent of aui Parts/status, so tokens render as they arrive. */
  const streamContentRef = useRef<Record<string, string>>({});
  const [streamEpoch, setStreamEpoch] = useState(0);
  const [streamingAssistantId, setStreamingAssistantId] = useState("");
  const answerStartedRef = useRef(false);
  const persistReadyRef = useRef(false);
  const lastJobRef = useRef("");
  const documentIdRef = useRef("");
  const switchTokenRef = useRef(0);

  itemsRef.current = items;
  headIdRef.current = headId;
  activeConversationIdRef.current = activeConversationId;

  const remoteAnswerer = useMemo(() => {
    if (!enabled || !jobId) return null;
    return createReaderAskAnswerer({ jobId });
  }, [enabled, jobId]);

  const refreshSessions = useCallback(async (documentId = "") => {
    const doc = `${documentId || documentIdRef.current || ""}`.trim();
    if (!doc) {
      setSessions([]);
      return;
    }
    try {
      const res = await listConversations({ document_id: doc, limit: 50 });
      setSessions(res.conversations || []);
    } catch {
      // List failures should not block the main flow.
    }
  }, []);

  const applyConversationTree = useCallback((
    branchItems: ReturnType<typeof messagesToBranchItems>,
    head?: string | null,
  ) => {
    const tree = treeItemsFromBranchItems(branchItems);
    setItems(tree);
    setHeadId(
      `${head || ""}`.trim()
      || tree[tree.length - 1]?.message.id
      || null,
    );
  }, []);

  // Job changes / panel opening: load the session list and hydrate the message tree.
  // Note: the effect also runs with enabled=false when the panel closes. Do not
  // return only from lastJobRef on enabled flips, or opening the panel will never
  // refreshSessions and users will only see the list after creating a new chat.
  useEffect(() => {
    if (!jobId) {
      setItems([]);
      setHeadId(null);
      setSessions([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      lastJobRef.current = "";
      documentIdRef.current = "";
      persistReadyRef.current = false;
      return;
    }

    const jobChanged = lastJobRef.current !== jobId;
    if (jobChanged) {
      lastJobRef.current = jobId;
      persistReadyRef.current = false;
      runningRef.current = false;
      setIsRunning(false);
      setItems([]);
      setHeadId(null);
      setSessions([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      documentIdRef.current = "";
    }

    // Panel is closed: only remember the job and wait for enabled before loading.
    if (!enabled || !remoteAnswerer) return;

    let cancelled = false;
    void (async () => {
      // 1) Resolve document_id, used to filter the list by document.
      let docId = `${documentIdRef.current || ""}`.trim();
      if (!docId) {
        try {
          docId = `${(await remoteAnswerer.getDocumentId?.()) || ""}`.trim();
        } catch {
          docId = "";
        }
        if (docId) documentIdRef.current = docId;
      }

      // 2) Always refresh the session list when opening the panel or changing jobs.
      if (!cancelled && docId) {
        await refreshSessions(docId);
      }

      // 3) Message tree: hydrate after a job change or while the current tree is empty.
      const needHydrate = jobChanged || !itemsRef.current.length;
      if (!needHydrate || cancelled) {
        if (!cancelled) persistReadyRef.current = true;
        return;
      }

      const convId =
        loadStoredConversationId({ jobId, documentId: docId })
        || `${remoteAnswerer.getConversationId?.() || ""}`.trim();

      if (convId) {
        setActiveConversationId(convId);
        activeConversationIdRef.current = convId;
        remoteAnswerer.setConversationId?.(convId, docId);
        try {
          const detail = await getConversation(convId);
          if (cancelled) return;
          const branchItems = messagesToBranchItems(detail.messages || []);
          if (branchItems.length) {
            applyConversationTree(branchItems, detail.head_id);
            requestAnimationFrame(() => {
              if (!cancelled) persistReadyRef.current = true;
            });
            return;
          }
        } catch {
          // Network/404: fall back to the local snapshot.
        }
      }

      // No sticky session: if the list already has chats, attach the latest one for easy switching.
      if (!cancelled && docId) {
        try {
          const listed = await listConversations({ document_id: docId, limit: 50 });
          if (cancelled) return;
          const rows = listed.conversations || [];
          setSessions(rows);
          const latest = rows[0];
          if (latest?.conversation_id) {
            const latestId = latest.conversation_id;
            setActiveConversationId(latestId);
            activeConversationIdRef.current = latestId;
            remoteAnswerer.setConversationId?.(latestId, docId);
            try {
              const detail = await getConversation(latestId);
              if (cancelled) return;
              applyConversationTree(
                messagesToBranchItems(detail.messages || []),
                detail.head_id,
              );
              requestAnimationFrame(() => {
                if (!cancelled) persistReadyRef.current = true;
              });
              return;
            } catch {
              // fall through to snapshot
            }
          }
        } catch {
          // ignore list failure
        }
      }

      if (cancelled) return;
      const saved = loadThreadBranchSnapshot(jobId, convId);
      if (saved?.items.length) {
        const tree = treeFromSnapshot(saved);
        setItems(tree.items);
        setHeadId(tree.headId);
      } else {
        setItems([]);
        setHeadId(null);
      }
      requestAnimationFrame(() => {
        if (!cancelled) persistReadyRef.current = true;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, enabled, remoteAnswerer, refreshSessions, applyConversationTree]);

  // Debounced persistence of the full tree, isolated by session.
  useEffect(() => {
    if (!jobId || !persistReadyRef.current) return;
    const convId = activeConversationId;
    const timer = window.setTimeout(() => {
      if (!items.length) {
        clearThreadBranchSnapshot(jobId, convId);
        return;
      }
      saveThreadBranchSnapshot(jobId, snapshotFromTree(items, headId), convId);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [jobId, items, headId, activeConversationId]);

  const localAnswerer = useMemo(() => {
    if (!enabled || !jobId) return null;
    return createReaderMarkdownAnswerer({
      loadMarkdownPayload: defaultReaderDataPort.loadMarkdownPayload,
    });
  }, [enabled, jobId]);

  const messages = useMemo(
    () => visibleMessages(items, headId),
    [items, headId],
  );

  const citationsByMessageId = useMemo(() => {
    const map: Record<string, AiCitationLike[]> = {};
    for (const item of items) {
      const m = item.message;
      if (m.role === "assistant" && m.citations?.length) {
        map[m.id] = m.citations as AiCitationLike[];
      }
    }
    return map;
  }, [items]);

  const progressByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.role === "assistant" && m.progress) {
        map[m.id] = m.progress;
      }
    }
    return map;
  }, [items]);

  /** Streaming content bypass: store plus active streamContent, with streamEpoch forcing refresh. */
  const contentByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.content) map[m.id] = m.content;
    }
    // Override with the latest streaming buffer, which may be half a frame ahead of items.
    for (const [id, text] of Object.entries(streamContentRef.current)) {
      if (text) map[id] = text;
    }
    void streamEpoch;
    return map;
  }, [items, streamEpoch]);

  const messageRepository = useMemo(
    () =>
      ExportedMessageRepository.fromBranchableArray(
        items.map((item) => ({
          message: toThreadMessageLike(item.message),
          parentId: item.parentId,
        })),
        { headId },
      ),
    [items, headId],
  );

  const patchAssistant = useCallback((
    assistantId: string,
    patch: Partial<ReaderAskStoreMessage>,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.message.id === assistantId
          ? { ...item, message: { ...item.message, ...patch } }
          : item,
      ),
    );
  }, []);

  // Throttle streaming cleanup: move sanitize from every token to once per frame
  // inside the rAF flush. Long answers no longer run five regexes over the full
  // text repeatedly (audit P1-7 O(n²)). Semantics stay the same: when cleaning
  // produces empty text, fall back to raw text so incremental output remains visible.
  const sanitizeStreamText = useCallback((raw: string) => {
    const cleaned = sanitizeAssistantAnswer(raw || "", []);
    return cleaned.trim() ? cleaned : `${raw || ""}`;
  }, []);

  const scheduleAnswerText = useCallback((assistantId: string, text: string) => {
    const next = `${text || ""}`;
    pendingContentRef.current = next;
    answerStartedRef.current = true;
    streamAssistantIdRef.current = assistantId;

    // First packet: render synchronously through the bypass and store, avoiding rAF/aui status wait.
    const cur = itemsRef.current.find((i) => i.message.id === assistantId);
    if (!cur?.message.content?.trim()) {
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      const shown = sanitizeStreamText(next);
      streamContentRef.current[assistantId] = shown;
      setStreamEpoch((n) => n + 1);
      patchAssistant(assistantId, {
        content: shown,
        progress: "",
        status: { type: "running" },
      });
      return;
    }

    // Later packets: flush the bypass at most once per frame and update the store to avoid losing text when switching messages.
    if (streamRafRef.current != null) return;
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null;
      // Stale guard: after cancel or rapid sends, pendingContentRef belongs to a
      // new stream. Old rAF callbacks must not write it into the old bubble
      // (audit P0-3 stream crossover).
      if (streamAssistantIdRef.current !== assistantId) return;
      const latest = sanitizeStreamText(pendingContentRef.current);
      streamContentRef.current[assistantId] = latest;
      setStreamEpoch((n) => n + 1);
      patchAssistant(assistantId, {
        content: latest,
        progress: "",
        status: { type: "running" },
      });
    });
  }, [patchAssistant, sanitizeStreamText]);

  // Abort in-flight requests on unmount, closing the floating panel, or leaving the page.
  useEffect(() => () => {
    runAbortRef.current?.abort();
    runAbortRef.current = null;
  }, []);

  const runAssistant = useCallback(async (
    assistantId: string,
    question: string,
    opts: {
      parentId?: string | null;
      userMessageId?: string;
      regenerate?: boolean;
    } = {},
  ) => {
    if (!remoteAnswerer && !localAnswerer) {
      patchAssistant(assistantId, {
        content: "Hỏi đáp tạm không khả dụng: vui lòng xác nhận reader tác vụ đã được mở.",
        progress: "",
        status: { type: "incomplete", reason: "error" },
      });
      return;
    }

    // Rapid-send guard: abort the previous in-flight request before opening a new controller.
    runAbortRef.current?.abort();
    const controller = new AbortController();
    runAbortRef.current = controller;

    runningRef.current = true;
    answerStartedRef.current = false;
    pendingContentRef.current = "";
    streamAssistantIdRef.current = assistantId;
    streamContentRef.current[assistantId] = "";
    setStreamingAssistantId(assistantId);
    setStreamEpoch((n) => n + 1);
    setIsRunning(true);
    // Running placeholder so the UI takes the streaming path.
    patchAssistant(assistantId, {
      content: "",
      progress: "Đang truy xuất tài liệu...",
      status: { type: "running" },
    });

    try {
      await remoteAnswerer?.ensureLoaded?.(jobId);
      let usedFallback = false;
      let result: { answer?: string; citations?: unknown[] };
      try {
        result = await remoteAnswerer!.answer({
          question,
          scope: "document",
          parentId: opts.parentId || "",
          regenerate: Boolean(opts.regenerate),
          userMessageId: opts.userMessageId || "",
          assistantMessageId: assistantId,
          onToolEvent: (event) => {
            const line = describeToolEvent(event);
            if (!line || answerStartedRef.current) return;
            patchAssistant(assistantId, {
              progress: line,
              status: { type: "running" },
            });
          },
          onAnswerDelta: (fullText: string) => {
            if (controller.signal.aborted) return;
            // Queue the raw text directly; cleanup happens in scheduleAnswerText's frame-level flush.
            // Sanitizing the full text on every token is O(n²), audit P1-7.
            if (fullText) scheduleAnswerText(assistantId, fullText);
          },
          signal: controller.signal,
        });
      } catch (error) {
        // User-initiated cancel: no fallback or error; onCancel has already fixed the bubble state.
        if (controller.signal.aborted) return;
        if (!localAnswerer || !shouldFallbackToLocal(error)) throw error;
        usedFallback = true;
        if (!answerStartedRef.current) {
          patchAssistant(assistantId, {
            progress: "Dịch vụ trực tuyến tạm không khả dụng, chuyển sang truy xuất cục bộ...",
            status: { type: "running" },
          });
        }
        await localAnswerer.ensureLoaded?.(jobId);
        result = await localAnswerer.answer({ question, scope: "document" });
      }

      // Final gate before completion: canceled runs must not overwrite the "Đã hủy" bubble with a full answer.
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      const citations = normalizeCitations(result?.citations);
      let answer = sanitizeAssistantAnswer(
        `${result?.answer || pendingContentRef.current || ""}`.trim() || "Không tìm thấy câu trả lời khả dụng.",
        citations,
      );
      if (usedFallback) {
        answer = `${answer}\n\n_Dịch vụ trực tuyến tạm không khả dụng; nội dung trên đến từ truy xuất tài liệu cục bộ._`;
      }
      if ((result as { persisted?: boolean })?.persisted === false) {
        // Audit C2: writeback failure is no longer silent; users at least know to copy and save.
        answer = `${answer}\n\n_Lượt trả lời này không ghi được vào lịch sử (lưu trữ tạm không khả dụng), có thể mất sau khi refresh._`;
      }
      delete streamContentRef.current[assistantId];
      streamAssistantIdRef.current = "";
      setStreamingAssistantId("");
      setStreamEpoch((n) => n + 1);
      patchAssistant(assistantId, {
        content: answer,
        progress: "",
        citations,
        status: { type: "complete", reason: "stop" },
      });
    } catch (error) {
      // AbortError from user-initiated cancel is not a failure; onCancel has fixed the bubble state.
      if (controller.signal.aborted) return;
      if (streamRafRef.current != null) {
        cancelAnimationFrame(streamRafRef.current);
        streamRafRef.current = null;
      }
      delete streamContentRef.current[assistantId];
      streamAssistantIdRef.current = "";
      setStreamingAssistantId("");
      setStreamEpoch((n) => n + 1);
      const msg = error instanceof Error ? error.message : "Tạo câu trả lời thất bại, vui lòng thử lại.";
      patchAssistant(assistantId, {
        content: msg,
        progress: "",
        citations: [],
        status: { type: "incomplete", reason: "error" },
      });
    } finally {
      // Only the still-current run can reset global flags; an old run's finally must not step on a new run.
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
        runningRef.current = false;
        setIsRunning(false);
      }
    }
  }, [jobId, localAnswerer, patchAssistant, remoteAnswerer, scheduleAnswerText]);

  const onNew = useCallback(async (message: AppendMessage) => {
    if (runningRef.current) return;
    const question = textFromAppend(message);
    if (!question) return;

    // Prefer append's own parentId: when branching from an answer, parent is that assistant id.
    const parentId = message.parentId ?? headIdRef.current;
    const userId = makeId("u");
    const assistantId = makeId("a");

    setItems((prev) => [
      ...prev,
      { parentId, message: { id: userId, role: "user", content: question } },
      {
        parentId: userId,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
          progress: "Đang truy xuất tài liệu...",
          status: { type: "running" },
          citations: [],
        },
      },
    ]);
    setHeadId(assistantId);
    await runAssistant(assistantId, question, {
      parentId,
      userMessageId: userId,
      regenerate: false,
    });
  }, [runAssistant]);

  /** Regenerate: parentId is the parent of the replaced assistant message, usually the user message. */
  const onReload = useCallback(async (parentId: string | null) => {
    if (runningRef.current) return;
    const tree = itemsRef.current;
    const parent = parentId ? findMessage(tree, parentId) : null;
    let question = "";
    let userId = parentId;
    if (parent?.role === "user") {
      question = parent.content.trim();
    } else {
      // Fallback: find the latest user message along the visible path.
      const path = visibleMessages(tree, parentId ?? headIdRef.current);
      for (let i = path.length - 1; i >= 0; i -= 1) {
        if (path[i].role === "user") {
          question = path[i].content.trim();
          userId = path[i].id;
          break;
        }
      }
    }
    if (!question) return;

    const assistantId = makeId("a");
    const branchParent = userId || parentId;
    setItems((prev) => [
      ...prev,
      {
        parentId: branchParent,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
          progress: "Đang tạo lại...",
          status: { type: "running" },
          citations: [],
        },
      },
    ]);
    setHeadId(assistantId);
    await runAssistant(assistantId, question, {
      parentId: branchParent,
      regenerate: true,
    });
  }, [runAssistant]);

  /** Edit a user message: create a sibling user branch under parentId and rerun. */
  const onEdit = useCallback(async (message: AppendMessage) => {
    if (runningRef.current) return;
    const question = textFromAppend(message);
    if (!question) return;

    const parentId = message.parentId ?? null;
    const userId = makeId("u");
    const assistantId = makeId("a");

    setItems((prev) => [
      ...prev,
      { parentId, message: { id: userId, role: "user", content: question } },
      {
        parentId: userId,
        message: {
          id: assistantId,
          role: "assistant",
          content: "",
          progress: "Đang truy xuất tài liệu...",
          status: { type: "running" },
          citations: [],
        },
      },
    ]);
    setHeadId(assistantId);
    await runAssistant(assistantId, question, {
      parentId,
      userMessageId: userId,
      regenerate: false,
    });
  }, [runAssistant]);

  const onCancel = useCallback(async () => {
    // Real cancel: stop SSE to save network/tokens and clear pending rAF so it cannot set status back to running.
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    if (streamRafRef.current != null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamAssistantIdRef.current = "";
    setStreamingAssistantId("");
    setStreamEpoch((n) => n + 1);
    runningRef.current = false;
    setIsRunning(false);
    setItems((prev) =>
      prev.map((item) =>
        item.message.status?.type === "running"
          ? {
            ...item,
            message: {
              ...item.message,
              status: { type: "incomplete", reason: "cancelled" as const },
              progress: "",
              content: item.message.content.trim() || "Đã hủy",
            },
          }
          : item,
      ),
    );
  }, []);

  /** Branch switch: the runtime passes the current visible ThreadMessage path; only change head. */
  const setMessages = useCallback((next: readonly ThreadMessage[]) => {
    const last = next[next.length - 1];
    setHeadId(last?.id ?? null);
  }, []);

  const unstable_onBranchChange = useCallback((
    event: { headId: string | null },
  ) => {
    setHeadId(event.headId);
    // Sync server head so the visible branch survives refreshes and other clients.
    const convId =
      remoteAnswerer?.getConversationId?.()
      || loadStoredConversationId({ jobId });
    const head = `${event.headId || ""}`.trim();
    if (convId && head) {
      void patchConversation(convId, { head_id: head }).catch(() => {
        // Ignore offline/404; the local tree remains usable.
      });
    }
  }, [jobId, remoteAnswerer]);

  const onImport = useCallback((imported: readonly ThreadMessage[]) => {
    const last = imported[imported.length - 1];
    if (last?.id) setHeadId(last.id);
  }, []);

  /** New chat window: clear bubbles; the next ask will auto-create a new conversation. */
  const newSession = useCallback(async () => {
    if (sessionBusy) return;
    // Allow opening a new window while generating: abort in-flight requests so old streams cannot write into the new window.
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setIsRunning(false);
    armReaderAiClickShield(900);
    lockReaderAiNavigation(900);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      await new Promise<void>((r) => {
        window.setTimeout(r, 40);
      });
      if (token !== switchTokenRef.current) return;
      const docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;
      remoteAnswerer?.clearConversationId?.(docId);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setItems([]);
      setHeadId(null);
      clearThreadBranchSnapshot(jobId);
      if (docId) await refreshSessions(docId);
    } catch (error) {
      console.warn("[reader-ai] new session failed", error);
      setSessionError("Không tạo được hội thoại mới, vui lòng thử lại.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Switch to an existing chat window. */
  const switchSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    const current =
      activeConversationIdRef.current
      || remoteAnswerer?.getConversationId?.()
      || "";
    if (!id || id === current || sessionBusy) return;

    // Allow switching away while generating: abort in-flight requests. If an old
    // stream's done continues, it can stick conversation_id back to the old chat
    // and send the next question to the wrong thread (audit P0-4).
    runAbortRef.current?.abort();
    runAbortRef.current = null;
    runningRef.current = false;
    setIsRunning(false);

    // Short isolation is enough; too long feels like no response or jumpy UI.
    armReaderAiClickShield(1200);
    lockReaderAiNavigation(1200);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;

    // Switch the selected UI state and clear content first so the previous chat does not remain visible.
    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    setItems([]);
    setHeadId(null);

    const viewport = globalThis.document?.querySelector?.(
      "[data-reader-ai-viewport]",
    ) as HTMLElement | null;
    if (viewport) viewport.dataset.suppressAutoscroll = "1";

    try {
      await new Promise<void>((r) => {
        window.setTimeout(r, 80);
      });
      if (token !== switchTokenRef.current) return;

      try {
        (globalThis.document?.activeElement as HTMLElement | null)?.blur?.();
      } catch {
        // ignore
      }

      const docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;

      const detail = await getConversation(id);
      if (token !== switchTokenRef.current) return;

      armReaderAiClickShield(800);
      lockReaderAiNavigation(800);

      const branchItems = messagesToBranchItems(detail.messages || []);
      applyConversationTree(branchItems, detail.head_id);
      remoteAnswerer?.setConversationId?.(id, docId);

      // Align the local snapshot with the server, isolated by session.
      if (branchItems.length) {
        saveThreadBranchSnapshot(
          jobId,
          {
            version: 1,
            headId: `${detail.head_id || ""}`.trim()
              || branchItems[branchItems.length - 1]?.message.id
              || null,
            items: branchItems as ThreadBranchItem[],
          },
          id,
        );
      } else {
        clearThreadBranchSnapshot(jobId, id);
      }

      if (docId) await refreshSessions(docId);

      // Scroll only the AI panel, never the PDF.
      requestAnimationFrame(() => {
        const vp = globalThis.document?.querySelector?.(
          "[data-reader-ai-viewport]",
        ) as HTMLElement | null;
        if (vp) {
          vp.scrollTop = vp.scrollHeight;
          window.setTimeout(() => {
            delete vp.dataset.suppressAutoscroll;
          }, 200);
        }
        armReaderAiClickShield(350);
        lockReaderAiNavigation(350);
      });
    } catch (error) {
      console.warn("[reader-ai] switch session failed", error);
      if (token === switchTokenRef.current) {
        setSessionError("Không tải được hội thoại này, vui lòng kiểm tra mạng rồi thử lại.");
        // Do not pretend the switch succeeded on failure: restore empty state to avoid showing the wrong chat.
        setItems([]);
        setHeadId(null);
      }
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [
    applyConversationTree,
    jobId,
    remoteAnswerer,
    refreshSessions,
    sessionBusy,
  ]);

  /**
   * Start a new chat from an assistant answer:
   * copy the root-to-answer history into a new conversation while preserving the
   * original conversation unchanged. Future questions use only the new chat
   * context, avoiding pollution of the original thread (ChatGPT Branch in new chat).
   * @returns whether the branch was created successfully
   */
  const branchFromAnswer = useCallback(async (assistantMessageId: string): Promise<boolean> => {
    const forkId = `${assistantMessageId || ""}`.trim();
    // If busy, fail with a visible message; forking while generating is allowed after stopping local running.
    if (!forkId) {
      setSessionError("Không thể tách nhánh: id tin nhắn không hợp lệ.");
      return false;
    }
    if (sessionBusy) {
      setSessionError("Vui lòng chờ, đang có thao tác hội thoại.");
      return false;
    }
    if (runningRef.current) {
      runningRef.current = false;
      setIsRunning(false);
    }

    const path = pathForBranch(itemsRef.current, forkId, headIdRef.current);
    if (!path.length) {
      setSessionError("Không thể tách nhánh: không tìm thấy đường hội thoại tới câu trả lời này.");
      return false;
    }
    const last = path[path.length - 1];
    if (last.message.role !== "assistant") {
      setSessionError("Chỉ có thể mở hội thoại mới từ câu trả lời của assistant.");
      return false;
    }

    setSessionBusy(true);
    setSessionError("");
    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 40);
      });

      let docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;
      if (!docId) {
        // Try resolving once more.
        try {
          docId = `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
          documentIdRef.current = docId;
        } catch {
          docId = "";
        }
      }
      if (!docId) {
        setSessionError("Không thể tách nhánh: tài liệu chưa sẵn sàng, vui lòng thử lại sau.");
        return false;
      }

      // Linearize parents so the fork writes a complete parent-child chain, without relying on a possibly broken old parentId.
      const pathPayload = path.map((item, i) => ({
        id: item.message.id,
        role: item.message.role as "user" | "assistant",
        content: item.message.content,
        citations: item.message.citations,
        parentId: i === 0 ? null : path[i - 1].message.id,
      }));

      // Title: fork-n-xxx, where xxx is the current/original chat name.
      const currentId =
        activeConversationIdRef.current
        || remoteAnswerer?.getConversationId?.()
        || "";
      const currentRow = (sessions || []).find((s) => s.conversation_id === currentId);
      const firstUser = pathPayload.find((p) => p.role === "user");
      const sourceTitle =
        `${currentRow?.title || ""}`.trim()
        || `${firstUser?.content || ""}`.replace(/\s+/g, " ").trim()
        || "Hội thoại chưa đặt tên";
      const existingTitles = (sessions || []).map((s) => s.title || "");
      const branchTitle = nextForkConversationTitle(sourceTitle, existingTitles);

      // Must fork the full path to the server, including messages; never create an empty chat only.
      const forked = await forkConversationFromPath({
        documentId: docId,
        title: branchTitle,
        path: pathPayload,
      });
      const nextItems = treeItemsFromBranchItems(forked.items);
      const nextHead = nextItems[nextItems.length - 1]?.message.id || null;
      const nextConvId = forked.conversation.conversation_id;
      if (!nextConvId || !nextItems.length) {
        throw new Error("fork returned empty conversation");
      }

      armReaderAiClickShield(600);
      lockReaderAiNavigation(600);

      // Switch to the new chat; the original chat stays in the list and can be restored.
      setItems(nextItems);
      setHeadId(nextHead);
      setActiveConversationId(nextConvId);
      activeConversationIdRef.current = nextConvId;
      remoteAnswerer?.setConversationId?.(nextConvId, docId);

      // Optimistically insert the row with the correct title and message count, then refresh to align with the server.
      setSessions((prev) => {
        const row: ConversationRecord = {
          conversation_id: nextConvId,
          title: branchTitle,
          document_id: docId,
          created_at: forked.conversation.created_at || new Date().toISOString(),
          updated_at: forked.conversation.updated_at || new Date().toISOString(),
          message_count: nextItems.length,
          head_id: nextHead || "",
        };
        const without = prev.filter((s) => s.conversation_id !== nextConvId);
        return [row, ...without];
      });

      saveThreadBranchSnapshot(
        jobId,
        snapshotFromTree(nextItems, nextHead),
        nextConvId,
      );
      await refreshSessions(docId);

      // New chat: scroll to the end so the user can continue asking.
      requestAnimationFrame(() => {
        const vp = globalThis.document?.querySelector?.(
          "[data-reader-ai-viewport]",
        ) as HTMLElement | null;
        if (vp) {
          delete vp.dataset.suppressAutoscroll;
          vp.scrollTop = vp.scrollHeight;
        }
      });
      return true;
    } catch (error) {
      console.warn("[reader-ai] branch from answer failed", error);
      setSessionError("Tách nhánh thất bại: không copy được ngữ cảnh sang hội thoại mới. Vui lòng kiểm tra mạng rồi thử lại.");
      return false;
    } finally {
      setSessionBusy(false);
    }
  }, [jobId, remoteAnswerer, refreshSessions, sessionBusy, sessions]);

  /** Delete a chat on the server and in the local snapshot; deleting the current one switches to the latest chat or an empty window. */
  const removeSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    if (!id || sessionBusy) return;
    runningRef.current = false;
    setIsRunning(false);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      const docId = documentIdRef.current
        || `${(await remoteAnswerer?.getDocumentId?.()) || ""}`.trim();
      documentIdRef.current = docId;

      try {
        await deleteConversation(id);
      } catch (error) {
        const status = Number((error as { status?: number })?.status) || 0;
        if (status !== 404) throw error;
      }
      clearThreadBranchSnapshot(jobId, id);

      const current =
        activeConversationIdRef.current
        || remoteAnswerer?.getConversationId?.()
        || "";
      const deletingActive = current === id;

      setSessions((prev) => prev.filter((s) => s.conversation_id !== id));

      if (deletingActive) {
        remoteAnswerer?.clearConversationId?.(docId);
        setActiveConversationId("");
        activeConversationIdRef.current = "";
        setItems([]);
        setHeadId(null);
        clearThreadBranchSnapshot(jobId);

        const list = docId
          ? ((await listConversations({ document_id: docId, limit: 50 }).catch(
            () => ({ conversations: [] as ConversationRecord[] }),
          )).conversations || [])
          : [];
        if (token !== switchTokenRef.current) return;
        setSessions(list);

        const next = list[0];
        if (next?.conversation_id) {
          const nextId = next.conversation_id;
          setActiveConversationId(nextId);
          activeConversationIdRef.current = nextId;
          try {
            const detail = await getConversation(nextId);
            if (token !== switchTokenRef.current) return;
            applyConversationTree(
              messagesToBranchItems(detail.messages || []),
              detail.head_id,
            );
            remoteAnswerer?.setConversationId?.(nextId, docId);
          } catch {
            setItems([]);
            setHeadId(null);
          }
        }
      } else if (docId) {
        await refreshSessions(docId);
      }
    } catch (error) {
      console.warn("[reader-ai] delete session failed", error);
      setSessionError("Xóa hội thoại thất bại, vui lòng thử lại.");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [applyConversationTree, jobId, remoteAnswerer, refreshSessions, sessionBusy]);

  /** Rename the chat title. */
  const renameSession = useCallback(async (conversationId: string, title: string) => {
    const id = `${conversationId || ""}`.trim();
    const nextTitle = `${title || ""}`.replace(/\s+/g, " ").trim();
    if (!id || !nextTitle || sessionBusy) return;
    setSessionBusy(true);
    setSessionError("");
    try {
      const clipped = nextTitle.slice(0, 80);
      await patchConversation(id, { title: clipped });
      setSessions((prev) =>
        prev.map((s) =>
          s.conversation_id === id ? { ...s, title: clipped } : s,
        ),
      );
      const docId = documentIdRef.current;
      if (docId) await refreshSessions(docId);
    } catch (error) {
      console.warn("[reader-ai] rename session failed", error);
      setSessionError("Đổi tên thất bại, vui lòng thử lại.");
    } finally {
      setSessionBusy(false);
    }
  }, [refreshSessions, sessionBusy]);

  // Refresh chat titles and ordering after question answering completes.
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !isRunning) {
      const docId = documentIdRef.current;
      if (docId) void refreshSessions(docId);
      const id = remoteAnswerer?.getConversationId?.() || "";
      if (id) setActiveConversationId(id);
    }
    prevRunning.current = isRunning;
  }, [isRunning, remoteAnswerer, refreshSessions]);

  const runtime = useExternalStoreRuntime({
    isRunning,
    // Do not disable the whole thread while switching/branching, which flashes like a refresh; lock the button side with branchBusy.
    isDisabled: !enabled,
    messageRepository,
    setMessages,
    unstable_onBranchChange,
    onNew,
    onReload,
    onEdit,
    onCancel,
    onImport,
    suggestions: messages.length === 0 ? SUGGESTIONS : [],
  });

  const sessionSummaries: ReaderAskSessionSummary[] = useMemo(() => {
    const active = activeConversationId
      || remoteAnswerer?.getConversationId?.()
      || "";
    return (sessions || []).map((s) => ({
      id: s.conversation_id,
      title: `${s.title || ""}`.trim() || "Hội thoại chưa đặt tên",
      updatedAt: s.updated_at || "",
      messageCount: Number(s.message_count) || 0,
      active: s.conversation_id === active,
    }));
  }, [sessions, activeConversationId, remoteAnswerer]);

  return {
    runtime,
    citationsByMessageId,
    progressByMessageId,
    contentByMessageId,
    streamingAssistantId,
    isRunning,
    messages,
    sessions: sessionSummaries,
    activeConversationId: activeConversationId
      || remoteAnswerer?.getConversationId?.()
      || "",
    sessionBusy,
    sessionError,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    branchFromAnswer,
  };
}
