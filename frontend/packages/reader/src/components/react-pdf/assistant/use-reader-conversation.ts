// Shared conversation/history shell: tree state, session lifecycle, hydration,
// and persistence. This hook owns no streaming and no PDF operations; the
// reading request hook drives new turns through the typed tree port, and the
// facade wires the stream port to the chat owner.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  armReaderAiClickShield,
  clearThreadBranchSnapshot,
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
  saveThreadBranchSnapshot,
  type AiCitationLike,
  type ConversationRecord,
} from "../../../external.js";
import {
  pathForBranch,
  snapshotFromTree,
  treeFromSnapshot,
  treeItemsFromBranchItems,
  visibleMessages,
  type ReaderAskStoreMessage,
  type ReaderAskTreeItem,
} from "./reader-ask-tree.js";

export type ReaderAskSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  active: boolean;
};

/** Minimal remote-answerer surface this shell needs (document/conversation ids). */
export type ReaderConversationRemotePort = {
  getDocumentId?: () => Promise<string>;
  getConversationId?: () => string;
  setConversationId?: (conversationId: string, documentId: string) => void;
  clearConversationId?: (documentId: string) => void;
};

/**
 * Typed stream commands owned by the chat hook. The conversation shell calls
 * these instead of receiving React setters, so stopping a stream never leaks
 * into durable operation handling.
 */
export type ReaderConversationStreamPort = {
  stopStream: () => Promise<void>;
  clearMessages: () => void;
  showMessages: (messages: readonly ReaderAskStoreMessage[]) => void;
};

/** Typed tree commands for the reading request hook (no React setters). */
export type ReaderConversationTreePort = {
  readItems: () => ReaderAskTreeItem[];
  readHeadId: () => string | null;
  appendExchange: (input: {
    parentId: string | null;
    userId: string;
    assistantId: string;
    question: string;
    progress: string;
  }) => void;
  appendRetryTurn: (input: {
    assistantId: string;
    branchParent: string | null;
  }) => void;
  markRunningCancelled: () => void;
  markRunningAsError: (message: string) => void;
  mergeChatMirror: (patches: ReadonlyMap<string, ReaderAskStoreMessage>) => void;
};

export type ReaderConversationSessionCommands = {
  refreshSessions: (
    documentId?: string,
    expectedSwitchToken?: number,
  ) => Promise<ConversationRecord[] | null>;
  adoptRemoteConversationId: () => void;
  newSession: () => Promise<void>;
  switchSession: (conversationId: string) => Promise<void>;
  removeSession: (conversationId: string) => Promise<void>;
  renameSession: (conversationId: string, title: string) => Promise<void>;
  branchFromAnswer: (assistantMessageId: string) => Promise<boolean>;
};

const NOOP_STREAM_PORT: ReaderConversationStreamPort = {
  stopStream: () => Promise.resolve(),
  clearMessages: () => {},
  showMessages: () => {},
};

export function useReaderConversation(options: {
  jobId: string;
  documentId?: string;
  enabled: boolean;
  remoteAnswerer?: ReaderConversationRemotePort | null;
  stream?: ReaderConversationStreamPort;
}) {
  const {
    jobId,
    documentId = "",
    enabled,
    remoteAnswerer = null,
    stream = NOOP_STREAM_PORT,
  } = options;
  const [items, setItems] = useState<ReaderAskTreeItem[]>([]);
  const [headId, setHeadId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationRecord[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const itemsRef = useRef(items);
  const headIdRef = useRef(headId);
  const activeConversationIdRef = useRef(activeConversationId);
  const persistReadyRef = useRef(false);
  const lastJobRef = useRef("");
  const documentIdRef = useRef("");
  const switchTokenRef = useRef(0);
  const sessionListGenerationRef = useRef(0);
  const streamRef = useRef(stream);
  streamRef.current = stream;
  const remoteRef = useRef(remoteAnswerer);
  remoteRef.current = remoteAnswerer;

  itemsRef.current = items;
  headIdRef.current = headId;
  activeConversationIdRef.current = activeConversationId;

  const refreshSessions = useCallback(async (
    docId = "",
    expectedSwitchToken?: number,
  ): Promise<ConversationRecord[] | null> => {
    const doc = `${docId || documentIdRef.current || ""}`.trim();
    const generation = ++sessionListGenerationRef.current;
    if (!doc) {
      if (
        generation === sessionListGenerationRef.current
        && (expectedSwitchToken === undefined || expectedSwitchToken === switchTokenRef.current)
      ) setSessions([]);
      return [];
    }
    try {
      const res = await listConversations({ document_id: doc, limit: 50 });
      const rows = res.conversations || [];
      if (
        generation === sessionListGenerationRef.current
        && doc === `${documentIdRef.current || ""}`.trim()
        && (expectedSwitchToken === undefined || expectedSwitchToken === switchTokenRef.current)
      ) {
        setSessions(rows);
        return rows;
      }
      return null;
    } catch {
      // 列表失败不挡主流程
      return null;
    }
  }, []);

  const applyConversationTree = useCallback((
    branchItems: ReturnType<typeof messagesToBranchItems>,
    head?: string | null,
  ) => {
    const tree = treeItemsFromBranchItems(branchItems);
    const nextHead = `${head || ""}`.trim()
      || tree[tree.length - 1]?.message.id
      || null;
    setItems(tree);
    setHeadId(nextHead);
    streamRef.current.showMessages(visibleMessages(tree, nextHead));
  }, []);

  const resolveRequestScopeKey = useCallback((): string => (
    `${documentId || documentIdRef.current || jobId}`.trim()
  ), [documentId, jobId]);

  // job 切换 / 面板打开：拉会话列表 + hydrate 消息树
  // 注意：面板关闭时 enabled=false 也会跑 effect；不能用 lastJobRef 在 enabled 翻转时直接 return，
  // 否则「打开面板」永远不会 refreshSessions（用户只能新对话后才看到列表）。
  useEffect(() => {
    const remote = remoteRef.current;
    if (!jobId) {
      sessionListGenerationRef.current += 1;
      switchTokenRef.current += 1;
      setItems([]);
      setHeadId(null);
      setSessions([]);
      setActiveConversationId("");
      streamRef.current.clearMessages();
      activeConversationIdRef.current = "";
      lastJobRef.current = "";
      documentIdRef.current = "";
      persistReadyRef.current = false;
      return;
    }

    const jobChanged = lastJobRef.current !== jobId;
    if (jobChanged) {
      sessionListGenerationRef.current += 1;
      switchTokenRef.current += 1;
      lastJobRef.current = jobId;
      persistReadyRef.current = false;
      setItems([]);
      setHeadId(null);
      streamRef.current.clearMessages();
      setSessions([]);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      documentIdRef.current = "";
      setSessionBusy(false);
    }

    // 面板未打开：只记 job，等 enabled 再拉网
    if (!enabled || !remote) {
      sessionListGenerationRef.current += 1;
      return;
    }

    let cancelled = false;
    void (async () => {
      // 1) 解析 document_id（列表按文档过滤）
      let docId = `${documentId || documentIdRef.current || ""}`.trim();
      if (!docId) {
        try {
          docId = `${(await remote.getDocumentId?.()) || ""}`.trim();
        } catch {
          docId = "";
        }
        if (cancelled) return;
      }
      if (docId) documentIdRef.current = docId;

      // 2) 始终刷新会话列表（打开面板 / 切 job 都要）
      let listedRows: ConversationRecord[] | null = null;
      if (!cancelled && docId) {
        listedRows = await refreshSessions(docId);
      }

      // 3) 消息树：job 刚切换，或当前还是空树时再 hydrate
      const needHydrate = jobChanged || !itemsRef.current.length;
      if (!needHydrate || cancelled) {
        if (!cancelled) persistReadyRef.current = true;
        return;
      }

      const convId =
        loadStoredConversationId({ jobId, documentId: docId })
        || `${remote.getConversationId?.() || ""}`.trim();

      if (convId) {
        setActiveConversationId(convId);
        activeConversationIdRef.current = convId;
        remote.setConversationId?.(convId, docId);
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
          // 网络/404 → 本地快照
        }
      }

      // 无粘性会话：若列表里已有对话，自动挂最近一条，便于直接切换
      if (!cancelled && docId) {
        try {
          const rows = listedRows ?? await refreshSessions(docId);
          if (cancelled) return;
          if (!rows) return;
          const latest = rows[0];
          if (latest?.conversation_id) {
            const latestId = latest.conversation_id;
            setActiveConversationId(latestId);
            activeConversationIdRef.current = latestId;
            remote.setConversationId?.(latestId, docId);
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
      const saved = loadThreadBranchSnapshot({ jobId, documentId: docId }, convId);
      if (saved?.items.length) {
        const tree = treeFromSnapshot(saved);
        setItems(tree.items);
        setHeadId(tree.headId);
        streamRef.current.showMessages(visibleMessages(tree.items, tree.headId));
      } else {
        setItems([]);
        setHeadId(null);
        streamRef.current.clearMessages();
      }
      requestAnimationFrame(() => {
        if (!cancelled) persistReadyRef.current = true;
      });
    })();

    return () => {
      cancelled = true;
      sessionListGenerationRef.current += 1;
    };
  }, [jobId, documentId, enabled, refreshSessions, applyConversationTree]);

  // 防抖持久化全量树（按会话隔离）
  useEffect(() => {
    if (!jobId || !persistReadyRef.current) return;
    const convId = activeConversationId;
    const branchScope = { jobId, documentId: documentId || documentIdRef.current };
    const timer = window.setTimeout(() => {
      if (!items.length) {
        clearThreadBranchSnapshot(branchScope, convId);
        return;
      }
      saveThreadBranchSnapshot(branchScope, snapshotFromTree(items, headId), convId);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [jobId, documentId, items, headId, activeConversationId]);

  const messages = useMemo(
    () => visibleMessages(items, headId),
    [items, headId],
  );

  const citationsByMessageId = useMemo(() => {
    const map: Record<string, AiCitationLike[]> = {};
    for (const item of items) {
      const m = item.message;
      if (m.role === "assistant" && m.citations?.length) {
        map[m.id] = m.citations;
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

  const contentByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      const m = item.message;
      if (m.content) map[m.id] = m.content;
    }
    return map;
  }, [items]);

  const tree: ReaderConversationTreePort = useMemo(() => ({
    readItems: () => itemsRef.current,
    readHeadId: () => headIdRef.current,
    appendExchange: ({ parentId, userId, assistantId, question, progress }) => {
      setItems((prev) => [
        ...prev,
        { parentId, message: { id: userId, role: "user", content: question } },
        {
          parentId: userId,
          message: {
            id: assistantId,
            role: "assistant",
            content: "",
            progress,
            status: { type: "running" },
            citations: [],
          },
        },
      ]);
      setHeadId(assistantId);
    },
    appendRetryTurn: ({ assistantId, branchParent }) => {
      setItems((prev) => [
        ...prev,
        {
          parentId: branchParent,
          message: {
            id: assistantId,
            role: "assistant",
            content: "",
            progress: "正在重新生成…",
            status: { type: "running" },
            citations: [],
          },
        },
      ]);
      setHeadId(assistantId);
    },
    markRunningCancelled: () => {
      setItems((prev) =>
        prev.map((item) =>
          item.message.status?.type === "running"
            ? {
              ...item,
              message: {
                ...item.message,
                status: { type: "incomplete", reason: "cancelled" as const },
                progress: "",
                content: item.message.content.trim() || "已取消",
              },
            }
            : item,
        ),
      );
    },
    markRunningAsError: (message) => {
      const fallback = `${message || ""}`.trim() || "生成回答失败，请重试。";
      setItems((prev) => prev.map((item) => (
        item.message.status?.type === "running"
          ? {
            ...item,
            message: {
              ...item.message,
              content: item.message.content.trim() || fallback,
              progress: "",
              citations: [],
              status: { type: "incomplete" as const, reason: "error" as const },
            },
          }
          : item
      )));
    },
    mergeChatMirror: (patches) => {
      if (!patches.size) return;
      setItems((previous) => previous.map((item) => {
        const next = patches.get(item.message.id);
        if (!next) return item;
        return { ...item, message: { ...item.message, ...next } };
      }));
    },
  }), []);

  const adoptRemoteConversationId = useCallback(() => {
    const id = `${remoteRef.current?.getConversationId?.() || ""}`.trim();
    if (id) setActiveConversationId(id);
  }, []);

  /** 新对话窗口：清空气泡，下次 ask 会 auto-create 新 conversation。 */
  const newSession = useCallback(async () => {
    if (sessionBusy) return;
    // AI SDK 统一持有取消控制器；切窗前停止旧流，避免回写新会话。
    await streamRef.current.stopStream();
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
      const remote = remoteRef.current;
      const docId = documentIdRef.current
        || `${(await remote?.getDocumentId?.()) || ""}`.trim();
      if (token !== switchTokenRef.current) return;
      documentIdRef.current = docId;
      remote?.clearConversationId?.(docId);
      setActiveConversationId("");
      activeConversationIdRef.current = "";
      setItems([]);
      setHeadId(null);
      streamRef.current.clearMessages();
      clearThreadBranchSnapshot({ jobId, documentId: docId });
      if (docId) await refreshSessions(docId, token);
    } catch (error) {
      console.warn("[reader-ai] new session failed", error);
      setSessionError("无法创建新对话，请重试。");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [jobId, refreshSessions, sessionBusy]);

  /** 切换已有会话窗口。 */
  const switchSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    const current =
      activeConversationIdRef.current
      || remoteRef.current?.getConversationId?.()
      || "";
    if (!id || id === current || sessionBusy) return;

    await streamRef.current.stopStream();

    // 短时隔离即可；过长会像「点了没反应 / 乱跳」
    armReaderAiClickShield(1200);
    lockReaderAiNavigation(1200);
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;

    // The persistence effect observes activeConversationId + items. Suspend it
    // before selecting the target, otherwise a slow GET can make the 280 ms
    // debounce erase that target's recovery snapshot while items is empty.
    persistReadyRef.current = false;

    // 先切 UI 选中态 + 清空，避免仍显示上一会话内容
    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    setItems([]);
    setHeadId(null);
    streamRef.current.clearMessages();

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

      const remote = remoteRef.current;
      const docId = documentIdRef.current
        || `${(await remote?.getDocumentId?.()) || ""}`.trim();
      if (token !== switchTokenRef.current) return;
      documentIdRef.current = docId;

      const detail = await getConversation(id);
      if (token !== switchTokenRef.current) return;

      armReaderAiClickShield(800);
      lockReaderAiNavigation(800);

      const branchItems = messagesToBranchItems(detail.messages || []);
      applyConversationTree(branchItems, detail.head_id);
      remote?.setConversationId?.(id, docId);
      persistReadyRef.current = true;

      // 本地快照与服务端对齐（按会话隔离）
      if (branchItems.length) {
        const snapshotItems = treeItemsFromBranchItems(branchItems);
        saveThreadBranchSnapshot(
          { jobId, documentId: docId },
          snapshotFromTree(
            snapshotItems,
            `${detail.head_id || ""}`.trim()
              || snapshotItems.at(-1)?.message.id
              || null,
          ),
          id,
        );
      } else {
        clearThreadBranchSnapshot({ jobId, documentId: docId }, id);
      }

      if (docId) await refreshSessions(docId, token);

      // assistant-ui ThreadPrimitive.Viewport 管理滚动；这里不再直接操作 DOM。
      armReaderAiClickShield(350);
      lockReaderAiNavigation(350);
    } catch (error) {
      console.warn("[reader-ai] switch session failed", error);
      if (token === switchTokenRef.current) {
        setSessionError("加载该对话失败，请检查网络后重试。");
        const saved = loadThreadBranchSnapshot(
          { jobId, documentId: documentId || documentIdRef.current },
          id,
        );
        if (saved?.items.length) {
          const recovered = treeFromSnapshot(saved);
          setItems(recovered.items);
          setHeadId(recovered.headId);
          streamRef.current.showMessages(visibleMessages(recovered.items, recovered.headId));
        } else {
          // 失败时不要展示旧会话内容；目标无快照时保持明确空态。
          setItems([]);
          setHeadId(null);
        }
        persistReadyRef.current = true;
      }
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [
    applyConversationTree,
    jobId,
    documentId,
    refreshSessions,
    sessionBusy,
  ]);

  /**
   * 从某条助手答案「开新对话」：
   * 复制 root→该答案 的历史到新 conversation，原会话原样保留。
   * 之后提问只带新会话上下文，避免原线程被续写污染（ChatGPT Branch in new chat）。
   * @returns 是否成功
   */
  const branchFromAnswer = useCallback(async (assistantMessageId: string): Promise<boolean> => {
    const forkId = `${assistantMessageId || ""}`.trim();
    // 允许在 busy 时排队失败要有提示；生成中也可 fork（先停本地 running）
    if (!forkId) {
      setSessionError("无法分支：消息 id 无效。");
      return false;
    }
    if (sessionBusy) {
      setSessionError("请稍候，当前有会话操作进行中。");
      return false;
    }
    await streamRef.current.stopStream();

    const path = pathForBranch(itemsRef.current, forkId, headIdRef.current);
    if (!path.length) {
      setSessionError("无法分支：找不到到此答案的对话路径。");
      return false;
    }
    const last = path[path.length - 1];
    if (last.message.role !== "assistant") {
      setSessionError("只能从助手答案处开新对话。");
      return false;
    }

    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 40);
      });
      if (token !== switchTokenRef.current) return false;

      const remote = remoteRef.current;
      let docId = documentIdRef.current
        || `${(await remote?.getDocumentId?.()) || ""}`.trim();
      if (token !== switchTokenRef.current) return false;
      documentIdRef.current = docId;
      if (!docId) {
        // 再试一次解析
        try {
          docId = `${(await remote?.getDocumentId?.()) || ""}`.trim();
          if (token !== switchTokenRef.current) return false;
          documentIdRef.current = docId;
        } catch {
          docId = "";
        }
      }
      if (!docId) {
        setSessionError("无法分支：文档未就绪，请稍后重试。");
        return false;
      }

      // 线性化 parent，保证 fork 写入时父子链完整（不依赖可能断裂的旧 parentId）
      const pathPayload = path.map((item, i) => ({
        id: item.message.id,
        role: item.message.role as "user" | "assistant",
        content: item.message.content,
        citations: item.message.citations,
        parentId: i === 0 ? null : path[i - 1].message.id,
      }));

      // 标题：fork-n-xxx（xxx = 当前/原始对话名）
      const currentId =
        activeConversationIdRef.current
        || remote?.getConversationId?.()
        || "";
      const currentRow = (sessions || []).find((s) => s.conversation_id === currentId);
      const firstUser = pathPayload.find((p) => p.role === "user");
      const sourceTitle =
        `${currentRow?.title || ""}`.trim()
        || `${firstUser?.content || ""}`.replace(/\s+/g, " ").trim()
        || "未命名对话";
      const existingTitles = (sessions || []).map((s) => s.title || "");
      const branchTitle = nextForkConversationTitle(sourceTitle, existingTitles);

      // 必须完整 fork 到服务端（含消息），禁止只建空会话
      const forked = await forkConversationFromPath({
        documentId: docId,
        title: branchTitle,
        path: pathPayload,
      });
      if (token !== switchTokenRef.current) return false;
      const nextItems = treeItemsFromBranchItems(forked.items);
      const nextHead = nextItems[nextItems.length - 1]?.message.id || null;
      const nextConvId = forked.conversation.conversation_id;
      if (!nextConvId || !nextItems.length) {
        throw new Error("fork returned empty conversation");
      }

      armReaderAiClickShield(600);
      lockReaderAiNavigation(600);

      // 切到新会话：原会话仍在列表里可切回
      setItems(nextItems);
      setHeadId(nextHead);
      streamRef.current.showMessages(visibleMessages(nextItems, nextHead));
      setActiveConversationId(nextConvId);
      activeConversationIdRef.current = nextConvId;
      remote?.setConversationId?.(nextConvId, docId);

      // 乐观插入列表（带正确标题与消息数），再 refresh 对齐服务端
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
        { jobId, documentId: docId },
        snapshotFromTree(nextItems, nextHead),
        nextConvId,
      );
      await refreshSessions(docId, token);

      return true;
    } catch (error) {
      console.warn("[reader-ai] branch from answer failed", error);
      if (token === switchTokenRef.current) {
        setSessionError("分支失败：未能复制上文到新对话。请检查网络后重试。");
      }
      return false;
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [jobId, refreshSessions, sessionBusy, sessions]);

  /** 删除会话（服务端 + 本地快照）；删当前则切到最近一条或空窗。 */
  const removeSession = useCallback(async (conversationId: string) => {
    const id = `${conversationId || ""}`.trim();
    if (!id || sessionBusy) return;
    await streamRef.current.stopStream();
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      const remote = remoteRef.current;
      const docId = documentIdRef.current
        || `${(await remote?.getDocumentId?.()) || ""}`.trim();
      if (token !== switchTokenRef.current) return;
      documentIdRef.current = docId;

      try {
        await deleteConversation(id);
      } catch (error) {
        const status = Number((error as { status?: number })?.status) || 0;
        if (status !== 404) throw error;
      }
      clearThreadBranchSnapshot({ jobId, documentId: docId }, id);

      const current =
        activeConversationIdRef.current
        || remote?.getConversationId?.()
        || "";
      const deletingActive = current === id;

      setSessions((prev) => prev.filter((s) => s.conversation_id !== id));

      if (deletingActive) {
        remote?.clearConversationId?.(docId);
        setActiveConversationId("");
        activeConversationIdRef.current = "";
        setItems([]);
        setHeadId(null);
        streamRef.current.clearMessages();
        clearThreadBranchSnapshot({ jobId, documentId: docId });

        const list = docId ? await refreshSessions(docId, token) : [];
        if (token !== switchTokenRef.current) return;
        if (!list) return;

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
            remote?.setConversationId?.(nextId, docId);
          } catch {
            setItems([]);
            setHeadId(null);
          }
        }
      } else if (docId) {
        await refreshSessions(docId, token);
      }
    } catch (error) {
      console.warn("[reader-ai] delete session failed", error);
      setSessionError("删除对话失败，请重试。");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [applyConversationTree, jobId, refreshSessions, sessionBusy]);

  /** 重命名会话标题。 */
  const renameSession = useCallback(async (conversationId: string, title: string) => {
    const id = `${conversationId || ""}`.trim();
    const nextTitle = `${title || ""}`.replace(/\s+/g, " ").trim();
    if (!id || !nextTitle || sessionBusy) return;
    setSessionBusy(true);
    setSessionError("");
    const token = ++switchTokenRef.current;
    try {
      const clipped = nextTitle.slice(0, 80);
      await patchConversation(id, { title: clipped });
      if (token !== switchTokenRef.current) return;
      setSessions((prev) =>
        prev.map((s) =>
          s.conversation_id === id ? { ...s, title: clipped } : s,
        ),
      );
      const docId = documentIdRef.current;
      if (docId) await refreshSessions(docId, token);
    } catch (error) {
      console.warn("[reader-ai] rename session failed", error);
      setSessionError("重命名失败，请重试。");
    } finally {
      if (token === switchTokenRef.current) setSessionBusy(false);
    }
  }, [refreshSessions, sessionBusy]);

  const sessionSummaries: ReaderAskSessionSummary[] = useMemo(() => {
    const active = activeConversationId
      || remoteAnswerer?.getConversationId?.()
      || "";
    return (sessions || []).map((s) => ({
      id: s.conversation_id,
      title: `${s.title || ""}`.trim() || "未命名对话",
      updatedAt: s.updated_at || "",
      messageCount: Number(s.message_count) || 0,
      active: s.conversation_id === active,
    }));
  }, [sessions, activeConversationId, remoteAnswerer]);

  const sessionCommands: ReaderConversationSessionCommands = useMemo(() => ({
    refreshSessions,
    adoptRemoteConversationId,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    branchFromAnswer,
  }), [
    refreshSessions,
    adoptRemoteConversationId,
    newSession,
    switchSession,
    removeSession,
    renameSession,
    branchFromAnswer,
  ]);

  return {
    items,
    headId,
    messages,
    citationsByMessageId,
    progressByMessageId,
    contentByMessageId,
    sessions: sessionSummaries,
    activeConversationId: activeConversationId
      || remoteAnswerer?.getConversationId?.()
      || "",
    sessionBusy,
    sessionError,
    resolveRequestScopeKey,
    tree,
    sessionCommands,
  };
}

export type ReaderConversation = ReturnType<typeof useReaderConversation>;
