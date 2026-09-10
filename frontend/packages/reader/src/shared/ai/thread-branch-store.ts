// 共享真值（原 frontend/web/src/js/reader/ai/thread-branch-store.ts），已抽离为 standalone
// 仅依赖 conversation-store 的 storage 键，纯 localStorage

import { loadStoredConversationId } from "./conversation-store.js";

const STORAGE_PREFIX = "retainpdf.reader.ai.thread-branch.v1:";

/** 与 answer-enhance / runtime 中的引用形状兼容；此处用宽松结构避免循环依赖。 */
export type ThreadBranchCitation = {
  ref?: number | string;
  block_id?: string;
  page_idx?: number;
  page?: number;
  job_id?: string;
  document_id?: string;
  snippet?: string;
  [key: string]: unknown;
};

export type ThreadBranchMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  progress?: string;
  citations?: ThreadBranchCitation[];
  status?: {
    type: string;
    reason?: string;
  };
};

export type ThreadBranchItem = {
  parentId: string | null;
  message: ThreadBranchMessage;
};

export type ThreadBranchSnapshot = {
  version: 1;
  headId: string | null;
  items: ThreadBranchItem[];
  /** 快照归属的会话 id（防串会话印章，审计 P2-10）；旧快照无此字段 */
  conversationId?: string;
};

export type ThreadBranchScope = {
  jobId?: string;
  documentId?: string;
};

export type ThreadBranchScopeInput = string | ThreadBranchScope;

function normalizeScope(scope: ThreadBranchScopeInput): Required<ThreadBranchScope> {
  if (typeof scope === "string") {
    return { jobId: `${scope || ""}`.trim(), documentId: "" };
  }
  return {
    jobId: `${scope?.jobId || ""}`.trim(),
    documentId: `${scope?.documentId || ""}`.trim(),
  };
}

export function threadBranchStorageKey(
  scope: ThreadBranchScopeInput,
  conversationId = "",
): string {
  const { jobId, documentId } = normalizeScope(scope);
  const kind = documentId ? "doc" : "job";
  const id = documentId || jobId || "anonymous";
  const conv = `${conversationId || ""}`.trim();
  if (conv) {
    return `${STORAGE_PREFIX}${kind}:${id}:conv:${conv}`;
  }
  return `${STORAGE_PREFIX}${kind}:${id}`;
}

function storage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(
  raw: unknown,
): ThreadBranchMessage["status"] | undefined {
  if (!isRecord(raw) || typeof raw.type !== "string") return undefined;
  const reason = typeof raw.reason === "string" ? raw.reason : undefined;
  return reason ? { type: raw.type, reason } : { type: raw.type };
}

function normalizeMessage(raw: unknown): ThreadBranchMessage | null {
  if (!isRecord(raw)) return null;
  const id = `${(raw as any).id || ""}`.trim();
  const role = (raw as any).role === "user" || (raw as any).role === "assistant" ? (raw as any).role : null;
  if (!id || !role) return null;
  const citations = Array.isArray((raw as any).citations)
    ? ((raw as any).citations as ThreadBranchCitation[])
    : undefined;
  const progress = typeof (raw as any).progress === "string" ? (raw as any).progress : undefined;
  // 不恢复 running：刷新后不应卡在「生成中」
  let status = normalizeStatus((raw as any).status);
  if (status?.type === "running") {
    status = { type: "incomplete", reason: "cancelled" };
  }
  return {
    id,
    role,
    content: typeof (raw as any).content === "string" ? (raw as any).content : "",
    ...(progress ? { progress } : {}),
    ...(citations?.length ? { citations } : {}),
    ...(status ? { status } : {}),
  };
}

function normalizeSnapshot(raw: unknown): ThreadBranchSnapshot | null {
  if (!isRecord(raw) || (raw as any).version !== 1 || !Array.isArray((raw as any).items)) {
    return null;
  }
  const items: ThreadBranchItem[] = [];
  for (const entry of (raw as any).items) {
    if (!isRecord(entry)) continue;
    const message = normalizeMessage((entry as any).message);
    if (!message) continue;
    const parentId =
      (entry as any).parentId === null || (entry as any).parentId === undefined
        ? null
        : `${(entry as any).parentId}`.trim() || null;
    items.push({ parentId, message });
  }
  if (!items.length) return null;
  const headRaw = (raw as any).headId;
  const headId =
    headRaw === null || headRaw === undefined
      ? items[items.length - 1]?.message.id ?? null
      : `${headRaw}`.trim() || null;
  const conversationId = `${(raw as { conversationId?: unknown }).conversationId || ""}`.trim();
  return { version: 1, headId, items, ...(conversationId ? { conversationId } : {}) };
}

function snapshotForConversation(raw: string | null, conversationId: string): ThreadBranchSnapshot | null {
  if (!raw) return null;
  try {
    const snapshot = normalizeSnapshot(JSON.parse(raw));
    if (!snapshot) return null;
    const marked = `${snapshot.conversationId || ""}`.trim();
    if (marked && conversationId && marked !== conversationId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function saveRawSnapshot(
  store: Storage,
  scope: ThreadBranchScopeInput,
  conversationId: string,
  snapshot: ThreadBranchSnapshot,
): void {
  const payload: ThreadBranchSnapshot = {
    version: 1,
    headId: snapshot.headId,
    items: snapshot.items,
    ...(conversationId ? { conversationId } : {}),
  };
  store.setItem(threadBranchStorageKey(scope, conversationId), JSON.stringify(payload));
}

function migrateSnapshot(
  store: Storage,
  targetScope: ThreadBranchScopeInput,
  conversationId: string,
  snapshot: ThreadBranchSnapshot,
  sourceKey: string,
): void {
  try {
    const targetKey = threadBranchStorageKey(targetScope, conversationId);
    saveRawSnapshot(store, targetScope, conversationId, snapshot);
    if (sourceKey && sourceKey !== targetKey) store.removeItem(sourceKey);
  } catch {
    // Migration is best-effort. A valid legacy snapshot remains readable even
    // when storage is full or unavailable for a canonical copy.
  }
}

export function loadThreadBranchSnapshot(
  scope: ThreadBranchScopeInput,
  conversationId = "",
): ThreadBranchSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const normalized = normalizeScope(scope);
    const raw = store.getItem(threadBranchStorageKey(normalized, conversationId));
    const current = snapshotForConversation(raw, conversationId);
    if (current) return current;

    // document scope is canonical. On first read after an upgrade, accept the
    // exact old job+conversation key and copy it forward so a retry/rerender
    // that produces a new job still restores the same local branch.
    if (normalized.documentId && normalized.jobId) {
      const legacyJobScope = { jobId: normalized.jobId };
      const legacyExact = snapshotForConversation(
        store.getItem(threadBranchStorageKey(legacyJobScope, conversationId)),
        conversationId,
      );
      if (legacyExact) {
        migrateSnapshot(
          store,
          normalized,
          conversationId,
          legacyExact,
          threadBranchStorageKey(legacyJobScope, conversationId),
        );
        return legacyExact;
      }
    }

    if (!conversationId) return null;

    // Compatibility with the oldest unscoped snapshot. An explicit seal is
    // authoritative; an unsealed snapshot is accepted only for the sticky
    // conversation of that document/job, preserving the anti-cross-thread
    // guarantee from the previous job-only implementation.
    const fallbackScopes: ThreadBranchScopeInput[] = normalized.documentId
      ? [normalized, ...(normalized.jobId ? [{ jobId: normalized.jobId }] : [])]
      : [normalized];
    for (const fallbackScope of fallbackScopes) {
      const legacy = snapshotForConversation(
        store.getItem(threadBranchStorageKey(fallbackScope)),
        conversationId,
      );
      if (!legacy) continue;
      const marked = `${legacy.conversationId || ""}`.trim();
      const sticky = normalized.documentId
        ? loadStoredConversationId({ documentId: normalized.documentId })
          || loadStoredConversationId({ jobId: normalized.jobId })
        : loadStoredConversationId({ jobId: normalized.jobId });
      if (marked ? marked === conversationId : sticky === conversationId) {
        if (normalized.documentId) {
          migrateSnapshot(
            store,
            normalized,
            conversationId,
            legacy,
            threadBranchStorageKey(fallbackScope),
          );
        }
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveThreadBranchSnapshot(
  scope: ThreadBranchScopeInput,
  snapshot: ThreadBranchSnapshot,
  conversationId = "",
): void {
  const store = storage();
  if (!store) return;
  const normalized = normalizeScope(scope);
  if ((!normalized.documentId && !normalized.jobId) || !snapshot.items.length) return;
  try {
    saveRawSnapshot(store, normalized, conversationId, snapshot);
  } catch {
    // quota / private mode
  }
}

export function clearThreadBranchSnapshot(
  scope: ThreadBranchScopeInput,
  conversationId = "",
): void {
  const store = storage();
  if (!store) return;
  try {
    const normalized = normalizeScope(scope);
    store.removeItem(threadBranchStorageKey(normalized, conversationId));
    if (normalized.documentId && normalized.jobId) {
      // Prevent a cleared canonical snapshot from being resurrected by the
      // old job-key migration fallback on the next load.
      store.removeItem(threadBranchStorageKey({ jobId: normalized.jobId }, conversationId));
    }
    if (!conversationId) {
      store.removeItem(threadBranchStorageKey(normalized));
      if (normalized.documentId && normalized.jobId) {
        store.removeItem(threadBranchStorageKey({ jobId: normalized.jobId }));
      }
    }
  } catch {
    // ignore
  }
}

/** 可见路径：从 head 沿 parent 链回溯（parent 须先于 child 出现在 items 中）。 */
export function visiblePathFromSnapshot(
  snapshot: ThreadBranchSnapshot,
): ThreadBranchMessage[] {
  const byId = new Map(snapshot.items.map((i) => [i.message.id, i]));
  const head =
    (snapshot.headId && byId.get(snapshot.headId)) ||
    snapshot.items[snapshot.items.length - 1];
  if (!head) return [];
  const chain: ThreadBranchMessage[] = [];
  let cur: ThreadBranchItem | undefined = head;
  const guard = new Set<string>();
  while (cur && !guard.has(cur.message.id)) {
    guard.add(cur.message.id);
    chain.push(cur.message);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.reverse();
}
