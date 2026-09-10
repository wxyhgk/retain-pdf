// conversations — pure (mock branches removed, runtime via internal)
import { API_PREFIX, buildApiHeaders, unwrapEnvelope } from "./internal/runtime.js";
import { buildApiEndpoint } from "./http.js";

export type ConversationRecord = {
  conversation_id: string;
  title: string;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
  head_id?: string;
};

export type MessageRecord = {
  message_id: string;
  conversation_id: string;
  seq: number;
  role: "user" | "assistant" | string;
  content: string;
  citations_json?: string;
  tool_trace_json?: string;
  model?: string;
  created_at: string;
  parent_id?: string;
};

export type ConversationDetail = ConversationRecord & { messages: MessageRecord[] };

async function apiJson<T>(path: string, options: RequestInit = {}, apiPrefix = API_PREFIX): Promise<T> {
  const url = path.startsWith("http") ? path : buildApiEndpoint(apiPrefix, path.replace(/^\//, ""));
  const headers = buildApiHeaders({ "Content-Type": "application/json", ...(options.headers as Record<string, string> | undefined) });
  const resp = await fetch(url, { ...options, headers });
  const body: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(`${body?.message || (resp as any).statusText || "request failed"}`) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return unwrapEnvelope(body) as T;
}

export async function createConversation(payload: { title?: string; document_id?: string } = {}, apiPrefix = API_PREFIX): Promise<ConversationRecord> {
  return apiJson<ConversationRecord>("ai/conversations", { method: "POST", body: JSON.stringify({ title: payload.title || "", document_id: payload.document_id || "" }) }, apiPrefix);
}

export async function listConversations(query: { limit?: number; offset?: number; document_id?: string } = {}, apiPrefix = API_PREFIX): Promise<{ conversations: ConversationRecord[] }> {
  const params = new URLSearchParams();
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.document_id) params.set("document_id", query.document_id);
  const q = params.toString();
  return apiJson<{ conversations: ConversationRecord[] }>(`ai/conversations${q ? `?${q}` : ""}`, { method: "GET" }, apiPrefix);
}

export async function getConversation(conversationId: string, apiPrefix = API_PREFIX): Promise<ConversationDetail> {
  const id = `${conversationId || ""}`.trim();
  if (!id) throw new Error("conversation_id required");
  return apiJson<ConversationDetail>(`ai/conversations/${encodeURIComponent(id)}`, { method: "GET" }, apiPrefix);
}

export async function deleteConversation(conversationId: string, apiPrefix = API_PREFIX): Promise<{ deleted: boolean }> {
  const id = `${conversationId || ""}`.trim();
  if (!id) throw new Error("conversation_id required");
  return apiJson<{ deleted: boolean }>(`ai/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }, apiPrefix);
}

export async function patchConversation(conversationId: string, payload: { head_id?: string; title?: string }, apiPrefix = API_PREFIX): Promise<ConversationRecord> {
  const id = `${conversationId || ""}`.trim();
  if (!id) throw new Error("conversation_id required");
  const body: Record<string, string> = {};
  const head = `${payload.head_id || ""}`.trim();
  const title = `${payload.title || ""}`.trim();
  if (head) body.head_id = head;
  if (title) body.title = title;
  if (!Object.keys(body).length) throw new Error("patch requires head_id or title");
  return apiJson<ConversationRecord>(`ai/conversations/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }, apiPrefix);
}

export async function appendConversationMessage(
  conversationId: string,
  payload: { role: string; content: string; parent_id?: string; message_id?: string; citations_json?: string; tool_trace_json?: string; model?: string; set_head?: boolean },
  apiPrefix = API_PREFIX,
): Promise<MessageRecord> {
  const id = `${conversationId || ""}`.trim();
  if (!id) throw new Error("conversation_id required");
  return apiJson<MessageRecord>(`ai/conversations/${encodeURIComponent(id)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      role: payload.role, content: payload.content, parent_id: payload.parent_id || "", message_id: payload.message_id || "",
      citations_json: payload.citations_json || "", tool_trace_json: payload.tool_trace_json || "", model: payload.model || "", set_head: payload.set_head !== false,
    }),
  }, apiPrefix);
}

export function baseConversationTitle(title: string): string {
  let t = `${title || ""}`.replace(/\s+/g, " ").trim();
  if (!t) return "未命名对话";
  const fork = t.match(/^fork-\d+-(.+)$/i);
  if (fork?.[1]) t = fork[1].trim();
  t = t.replace(/^分支\s*[·•\-—]\s*/, "").trim();
  return t || "未命名对话";
}

export function nextForkConversationTitle(sourceTitle: string, existingTitles: string[] = []): string {
  const base = baseConversationTitle(sourceTitle);
  let maxN = 0;
  for (const raw of existingTitles) {
    const t = `${raw || ""}`.trim();
    const m = t.match(/^fork-(\d+)-(.+)$/i);
    if (!m) continue;
    if (baseConversationTitle(t) !== base) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxN) maxN = n;
  }
  const title = `fork-${maxN + 1}-${base}`;
  return title.length > 80 ? `${title.slice(0, 79).trim()}…` : title;
}

export async function forkConversationFromPath(
  options: { documentId?: string; title?: string; path: Array<{ id: string; role: "user" | "assistant"; content: string; citations?: unknown[]; parentId?: string | null }> },
  apiPrefix = API_PREFIX,
): Promise<{ conversation: ConversationRecord; items: ReturnType<typeof messagesToBranchItems> }> {
  const path = options.path || [];
  if (!path.length) throw new Error("fork path empty");
  const firstUser = path.find((m) => m.role === "user");
  const rawTitle = `${options.title || firstUser?.content || "未命名对话"}`.replace(/\s+/g, " ").trim();
  const title = rawTitle.length > 80 ? `${rawTitle.slice(0, 79).trim()}…` : rawTitle;
  const idMap = new Map<string, string>();
  const makeId = (role: string, i: number) => `fork-${role[0] || "m"}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`;
  path.forEach((m, i) => { idMap.set(m.id, makeId(m.role, i)); });
  const forkMessages = path.map((m, i) => {
    const newId = idMap.get(m.id)!;
    const parentRaw = m.parentId ? idMap.get(m.parentId) || "" : "";
    const parentId = parentRaw || (i > 0 ? idMap.get(path[i - 1].id) || "" : "");
    let citations_json = "";
    if (m.citations?.length) { try { citations_json = JSON.stringify(m.citations); } catch { citations_json = "[]"; } }
    return { role: m.role, content: m.content, message_id: newId, parent_id: parentId, citations_json };
  });
  const items: ReturnType<typeof messagesToBranchItems> = forkMessages.map((fm) => ({
    parentId: fm.parent_id || null,
    message: { id: fm.message_id, role: fm.role as "user" | "assistant", content: fm.content, ...(fm.citations_json && fm.citations_json !== "[]" ? { citations: JSON.parse(fm.citations_json) } : {}), ...(fm.role === "assistant" ? { status: { type: "complete", reason: "stop" as const } } : {}) },
  }));
  try {
    const detail = await apiJson<ConversationDetail>("ai/conversations/fork", {
      method: "POST",
      body: JSON.stringify({ title: title || "未命名对话", document_id: options.documentId || "", messages: forkMessages.map((m) => ({ role: m.role, content: m.content, message_id: m.message_id, parent_id: m.parent_id, citations_json: m.citations_json })) }),
    }, apiPrefix);
    const conversation: ConversationRecord = {
      conversation_id: (detail as ConversationDetail).conversation_id || "",
      title: (detail as ConversationDetail).title || title,
      document_id: (detail as ConversationDetail).document_id ?? options.documentId ?? null,
      created_at: (detail as ConversationDetail).created_at || new Date().toISOString(),
      updated_at: (detail as ConversationDetail).updated_at || new Date().toISOString(),
      message_count: (detail as ConversationDetail).messages?.length || forkMessages.length,
      head_id: (detail as ConversationDetail).head_id || forkMessages[forkMessages.length - 1]?.message_id || "",
    };
    const serverMessages = (detail as ConversationDetail).messages;
    if (Array.isArray(serverMessages) && serverMessages.length) {
      const serverItems = messagesToBranchItems(serverMessages);
      return { conversation: { ...conversation, head_id: serverItems[serverItems.length - 1]?.message.id || conversation.head_id, message_count: serverItems.length }, items: serverItems };
    }
    return { conversation: { ...conversation, head_id: items[items.length - 1]?.message.id || "", message_count: items.length }, items };
  } catch {}
  const conversation = await createConversation({ title: title || "未命名对话", document_id: options.documentId || "" }, apiPrefix);
  const convId = conversation.conversation_id;
  for (let i = 0; i < forkMessages.length; i += 1) {
    const fm = forkMessages[i];
    await appendConversationMessage(convId, { role: fm.role, content: fm.content, message_id: fm.message_id, parent_id: fm.parent_id, citations_json: fm.citations_json, set_head: i === forkMessages.length - 1 }, apiPrefix);
  }
  return { conversation: { ...conversation, head_id: items[items.length - 1]?.message.id || "", message_count: items.length }, items };
}

export function messagesToBranchItems(messages: MessageRecord[]): Array<{ parentId: string | null; message: { id: string; role: "user" | "assistant"; content: string; citations?: unknown[]; status?: { type: string; reason?: string } } }> {
  const items: Array<{ parentId: string | null; message: { id: string; role: "user" | "assistant"; content: string; citations?: unknown[]; status?: { type: string; reason?: string } } }> = [];
  for (const m of messages) {
    const role = m.role === "user" || m.role === "assistant" ? m.role : null;
    if (!role) continue;
    let citations: unknown[] | undefined;
    try { const raw = JSON.parse(m.citations_json || "[]"); if (Array.isArray(raw) && raw.length) citations = raw; } catch {}
    const parent = `${m.parent_id || ""}`.trim();
    items.push({ parentId: parent || null, message: { id: m.message_id, role, content: m.content || "", ...(citations ? { citations } : {}), ...(role === "assistant" ? { status: { type: "complete", reason: "stop" } } : {}) } });
  }
  return items;
}
