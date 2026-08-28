// Local assistant-ui branch tree snapshot: store the full parentId tree plus headId by job.
// Complements conversation-store's Rust conversation_id stickiness and is not sent to the server.

import { loadStoredConversationId } from "./conversation-store.js";

const STORAGE_PREFIX = "retainpdf.reader.ai.thread-branch.v1:";

/** Compatible with citation shapes in answer-enhance/runtime; kept loose here to avoid circular dependencies. */
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
  /** Chat id owned by this snapshot, used as an anti-cross-chat stamp (audit P2-10); legacy snapshots lack this field. */
  conversationId?: string;
};

export function threadBranchStorageKey(
  jobId: string,
  conversationId = "",
): string {
  const id = `${jobId || ""}`.trim();
  const conv = `${conversationId || ""}`.trim();
  if (conv) {
    return `${STORAGE_PREFIX}job:${id || "anonymous"}:conv:${conv}`;
  }
  return `${STORAGE_PREFIX}job:${id || "anonymous"}`;
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
  const id = `${raw.id || ""}`.trim();
  const role = raw.role === "user" || raw.role === "assistant" ? raw.role : null;
  if (!id || !role) return null;
  const citations = Array.isArray(raw.citations)
    ? (raw.citations as ThreadBranchCitation[])
    : undefined;
  const progress = typeof raw.progress === "string" ? raw.progress : undefined;
  // Do not restore running; after refresh it should not stay stuck in "generating".
  let status = normalizeStatus(raw.status);
  if (status?.type === "running") {
    status = { type: "incomplete", reason: "cancelled" };
  }
  return {
    id,
    role,
    content: typeof raw.content === "string" ? raw.content : "",
    ...(progress ? { progress } : {}),
    ...(citations?.length ? { citations } : {}),
    ...(status ? { status } : {}),
  };
}

function normalizeSnapshot(raw: unknown): ThreadBranchSnapshot | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.items)) {
    return null;
  }
  const items: ThreadBranchItem[] = [];
  for (const entry of raw.items) {
    if (!isRecord(entry)) continue;
    const message = normalizeMessage(entry.message);
    if (!message) continue;
    const parentId =
      entry.parentId === null || entry.parentId === undefined
        ? null
        : `${entry.parentId}`.trim() || null;
    items.push({ parentId, message });
  }
  if (!items.length) return null;
  const headRaw = raw.headId;
  const headId =
    headRaw === null || headRaw === undefined
      ? items[items.length - 1]?.message.id ?? null
      : `${headRaw}`.trim() || null;
  const conversationId = `${(raw as { conversationId?: unknown }).conversationId || ""}`.trim();
  return { version: 1, headId, items, ...(conversationId ? { conversationId } : {}) };
}

export function loadThreadBranchSnapshot(
  jobId: string,
  conversationId = "",
): ThreadBranchSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(threadBranchStorageKey(jobId, conversationId));
    if (!raw && conversationId) {
      // Support the legacy key (job only) while preventing cross-chat leakage (audit P2-10):
      // 1. Reject snapshots with a conversationId stamp that does not match.
      // 2. Accept truly old unstamped snapshots only when the requested chat is
      //    this job's sticky chat, which is the only chat the legacy snapshot could represent.
      const legacy = store.getItem(threadBranchStorageKey(jobId));
      if (!legacy) return null;
      const snapshot = normalizeSnapshot(JSON.parse(legacy));
      if (!snapshot) return null;
      const marked = `${snapshot.conversationId || ""}`.trim();
      if (marked) {
        return marked === conversationId ? snapshot : null;
      }
      const sticky = loadStoredConversationId({ jobId });
      return sticky && sticky === conversationId ? snapshot : null;
    }
    if (!raw) return null;
    const snapshot = normalizeSnapshot(JSON.parse(raw));
    if (!snapshot) return null;
    const marked = `${snapshot.conversationId || ""}`.trim();
    if (marked && conversationId && marked !== conversationId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function saveThreadBranchSnapshot(
  jobId: string,
  snapshot: ThreadBranchSnapshot,
  conversationId = "",
): void {
  const store = storage();
  if (!store) return;
  const id = `${jobId || ""}`.trim();
  if (!id || !snapshot.items.length) return;
  try {
    const payload: ThreadBranchSnapshot = {
      version: 1,
      headId: snapshot.headId,
      items: snapshot.items,
      ...(conversationId ? { conversationId } : {}),
    };
    store.setItem(
      threadBranchStorageKey(id, conversationId),
      JSON.stringify(payload),
    );
  } catch {
    // quota / private mode
  }
}

export function clearThreadBranchSnapshot(
  jobId: string,
  conversationId = "",
): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(threadBranchStorageKey(jobId, conversationId));
    if (!conversationId) {
      // Clear the old job-level key.
      store.removeItem(threadBranchStorageKey(jobId));
    }
  } catch {
    // ignore
  }
}

/** Visible path: walk back from head along the parent chain; parents must appear before children in items. */
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
