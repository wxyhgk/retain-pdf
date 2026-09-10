// 共享真值（原 frontend/web/src/js/reader/ai/conversation-store.ts），已抽离为 standalone
// 无宿主依赖，纯 localStorage 粘性
const STORAGE_PREFIX = "retainpdf.reader.ai.conversation.v1:";

export type ConversationScopeKey = {
  jobId?: string;
  documentId?: string;
};

export function conversationStorageKey(scope: ConversationScopeKey = {}): string {
  const jobId = `${scope.jobId || ""}`.trim();
  const documentId = `${scope.documentId || ""}`.trim();
  if (documentId) {
    return `${STORAGE_PREFIX}doc:${documentId}`;
  }
  if (jobId) {
    return `${STORAGE_PREFIX}job:${jobId}`;
  }
  return `${STORAGE_PREFIX}anonymous`;
}

function legacyJobStorageKey(scope: ConversationScopeKey): string {
  const jobId = `${scope.jobId || ""}`.trim();
  return jobId ? `${STORAGE_PREFIX}job:${jobId}` : "";
}

function storage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadStoredConversationId(scope: ConversationScopeKey = {}): string {
  const store = storage();
  if (!store) {
    return "";
  }
  try {
    const key = conversationStorageKey(scope);
    const current = `${store.getItem(key) || ""}`.trim();
    if (current) return current;
    // One-time compatibility for readers that previously preferred job_id.
    // Once document_id is known, migrate the sticky conversation to the
    // durable document scope so retry/rerender job handoffs keep the thread.
    const legacyKey = `${scope.documentId || ""}`.trim() ? legacyJobStorageKey(scope) : "";
    const legacy = legacyKey ? `${store.getItem(legacyKey) || ""}`.trim() : "";
    if (legacy) store.setItem(key, legacy);
    return legacy;
  } catch {
    return "";
  }
}

export function saveStoredConversationId(
  scope: ConversationScopeKey,
  conversationId: string,
): void {
  const id = `${conversationId || ""}`.trim();
  const store = storage();
  if (!store || !id) {
    return;
  }
  try {
    store.setItem(conversationStorageKey(scope), id);
  } catch {
    // quota / private mode — 忽略,本轮仍可用内存态
  }
}

export function clearStoredConversationId(scope: ConversationScopeKey = {}): void {
  const store = storage();
  if (!store) {
    return;
  }
  try {
    store.removeItem(conversationStorageKey(scope));
    const legacyKey = `${scope.documentId || ""}`.trim() ? legacyJobStorageKey(scope) : "";
    if (legacyKey) store.removeItem(legacyKey);
  } catch {
    // ignore
  }
}
