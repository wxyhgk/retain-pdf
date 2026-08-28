// CRUD phiên hội thoại AI: kết nối với Rust /api/v1/ai/conversations (bao gồm parent_id / head_id cây nhánh).

import { API_PREFIX } from "../config/api-constants.js";
import { buildApiHeaders, isMockMode } from "../config/runtime.js";
import { unwrapEnvelope } from "../job/core.js";
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

export type ConversationDetail = ConversationRecord & {
  messages: MessageRecord[];
};

async function apiJson<T>(
  path: string,
  options: RequestInit = {},
  apiPrefix = API_PREFIX,
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : buildApiEndpoint(apiPrefix, path.replace(/^\//, ""));
  const headers = buildApiHeaders({
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  });
  const resp = await fetch(url, { ...options, headers });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(
      `${(body as { message?: string })?.message || resp.statusText || "yêu cầu thất bại"}`,
    ) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return unwrapEnvelope(body) as T;
}

export async function createConversation(
  payload: { title?: string; document_id?: string } = {},
  apiPrefix = API_PREFIX,
): Promise<ConversationRecord> {
  if (isMockMode()) {
    return {
      conversation_id: `mock-conv-${Date.now().toString(36)}`,
      title: payload.title || "",
      document_id: payload.document_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
      head_id: "",
    };
  }
  return apiJson<ConversationRecord>("ai/conversations", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title || "",
      document_id: payload.document_id || "",
    }),
  }, apiPrefix);
}

export async function listConversations(
  query: { limit?: number; offset?: number; document_id?: string } = {},
  apiPrefix = API_PREFIX,
): Promise<{ conversations: ConversationRecord[] }> {
  if (isMockMode()) {
    return { conversations: [] };
  }
  const params = new URLSearchParams();
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.document_id) params.set("document_id", query.document_id);
  const q = params.toString();
  return apiJson<{ conversations: ConversationRecord[] }>(
    `ai/conversations${q ? `?${q}` : ""}`,
    { method: "GET" },
    apiPrefix,
  );
}

export async function getConversation(
  conversationId: string,
  apiPrefix = API_PREFIX,
): Promise<ConversationDetail> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("conversation_id required");
  }
  if (isMockMode()) {
    return {
      conversation_id: id,
      title: "",
      created_at: "",
      updated_at: "",
      message_count: 0,
      head_id: "",
      messages: [],
    };
  }
  return apiJson<ConversationDetail>(
    `ai/conversations/${encodeURIComponent(id)}`,
    { method: "GET" },
    apiPrefix,
  );
}

export async function deleteConversation(
  conversationId: string,
  apiPrefix = API_PREFIX,
): Promise<{ deleted: boolean }> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("yêu cầu conversation_id");
  }
  if (isMockMode()) {
    return { deleted: true };
  }
  return apiJson<{ deleted: boolean }>(
    `ai/conversations/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    apiPrefix,
  );
}

export async function patchConversation(
  conversationId: string,
  payload: { head_id?: string; title?: string },
  apiPrefix = API_PREFIX,
): Promise<ConversationRecord> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("yêu cầu conversation_id");
  }
  if (isMockMode()) {
    return {
      conversation_id: id,
      title: payload.title || "",
      created_at: "",
      updated_at: "",
      head_id: payload.head_id || "",
    };
  }
  // Chỉ gửi các trường có giá trị: head_id rỗng không cần đưa (dịch vụ cũ/kiểm tra ổn định hơn)
  const body: Record<string, string> = {};
  const head = `${payload.head_id || ""}`.trim();
  const title = `${payload.title || ""}`.trim();
  if (head) body.head_id = head;
  if (title) body.title = title;
  if (!Object.keys(body).length) {
    throw new Error("patch requires head_id or title");
  }
  return apiJson<ConversationRecord>(
    `ai/conversations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
    apiPrefix,
  );
}

export async function appendConversationMessage(
  conversationId: string,
  payload: {
    role: string;
    content: string;
    parent_id?: string;
    message_id?: string;
    citations_json?: string;
    tool_trace_json?: string;
    model?: string;
    set_head?: boolean;
  },
  apiPrefix = API_PREFIX,
): Promise<MessageRecord> {
  const id = `${conversationId || ""}`.trim();
  if (!id) {
    throw new Error("yêu cầu conversation_id");
  }
  if (isMockMode()) {
    return {
      message_id: payload.message_id || `mock-msg-${Date.now().toString(36)}`,
      conversation_id: id,
      seq: 1,
      role: payload.role,
      content: payload.content,
      parent_id: payload.parent_id || "",
      created_at: new Date().toISOString(),
    };
  }
  return apiJson<MessageRecord>(
    `ai/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        role: payload.role,
        content: payload.content,
        parent_id: payload.parent_id || "",
        message_id: payload.message_id || "",
        citations_json: payload.citations_json || "",
        tool_trace_json: payload.tool_trace_json || "",
        model: payload.model || "",
        set_head: payload.set_head !== false,
      }),
    },
    apiPrefix,
  );
}

/** Loại bỏ tiền tố fork-n- / nhánh · , lấy tên hội thoại gốc. */
export function baseConversationTitle(title: string): string {
  let t = `${title || ""}`.replace(/\s+/g, " ").trim();
  if (!t) return "Hội thoại chưa đặt tên";
  const fork = t.match(/^fork-\d+-(.+)$/i);
  if (fork?.[1]) t = fork[1].trim();
  t = t.replace(/^nhánh\s*[·•\-—]\s*/i, "").trim();
  return t || "Hội thoại chưa đặt tên";
}

/**
 * Tạo tiêu đề fork: fork-n-xxx
 * n là số thứ tự tăng dần của fork đã có với cùng tên gốc; xxx là tên hội thoại gốc.
 */
export function nextForkConversationTitle(
  sourceTitle: string,
  existingTitles: string[] = [],
): string {
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
  // Tiêu đề DB/UI không nên quá dài
  return title.length > 80 ? `${title.slice(0, 79).trim()}…` : title;
}

/**
 * Fork từ câu trả lời thành "Cửa sổ phiên mới":
 * Sao chép đường dẫn root→fork sang conversation mới (message_id mới), phiên gốc không đổi.
 */
export async function forkConversationFromPath(
  options: {
    documentId?: string;
    title?: string;
    path: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      citations?: unknown[];
      parentId?: string | null;
    }>;
  },
  apiPrefix = API_PREFIX,
): Promise<{ conversation: ConversationRecord; items: ReturnType<typeof messagesToBranchItems> }> {
  const path = options.path || [];
  if (!path.length) {
    throw new Error("đường dẫn fork trống");
  }
  const firstUser = path.find((m) => m.role === "user");
  const rawTitle = `${options.title || firstUser?.content || "Hội thoại chưa đặt tên"}`.replace(/\s+/g, " ").trim();
  const title = rawTitle.length > 80 ? `${rawTitle.slice(0, 79).trim()}…` : rawTitle;

  const conversation = await createConversation(
    {
      title: title || "Hội thoại chưa đặt tên",
      document_id: options.documentId || "",
    },
    apiPrefix,
  );
  const convId = conversation.conversation_id;

  // message_id toàn cục duy nhất, phải ánh xạ lại
  const idMap = new Map<string, string>();
  const makeId = (role: string, i: number) =>
    `fork-${role[0] || "m"}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 7)}`;

  path.forEach((m, i) => {
    idMap.set(m.id, makeId(m.role, i));
  });

  const items: ReturnType<typeof messagesToBranchItems> = [];
  for (let i = 0; i < path.length; i += 1) {
    const m = path[i];
    const newId = idMap.get(m.id)!;
    const parentRaw = m.parentId ? idMap.get(m.parentId) || "" : "";
    // Nếu parent trên đường dẫn chưa được ánh xạ (không nên xảy ra), treo theo tuyến tính lên một mức
    const parentId =
      parentRaw
      || (i > 0 ? idMap.get(path[i - 1].id) || "" : "");

    let citations_json = "";
    if (m.citations?.length) {
      try {
        citations_json = JSON.stringify(m.citations);
      } catch {
        citations_json = "[]";
      }
    }

    await appendConversationMessage(
      convId,
      {
        role: m.role,
        content: m.content,
        message_id: newId,
        parent_id: parentId,
        citations_json,
        set_head: i === path.length - 1,
      },
      apiPrefix,
    );

    items.push({
      parentId: parentId || null,
      message: {
        id: newId,
        role: m.role,
        content: m.content,
        ...(m.citations?.length ? { citations: m.citations } : {}),
        ...(m.role === "assistant"
          ? { status: { type: "complete", reason: "stop" as const } }
          : {}),
      },
    });
  }

  return {
    conversation: {
      ...conversation,
      head_id: items[items.length - 1]?.message.id || "",
      message_count: items.length,
    },
    items,
  };
}

/** Tin nhắn server → mục cây nhánh frontend. */
export function messagesToBranchItems(messages: MessageRecord[]): Array<{
  parentId: string | null;
  message: {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: unknown[];
    status?: { type: string; reason?: string };
  };
}> {
  const items: Array<{
    parentId: string | null;
    message: {
      id: string;
      role: "user" | "assistant";
      content: string;
      citations?: unknown[];
      status?: { type: string; reason?: string };
    };
  }> = [];
  for (const m of messages) {
    const role = m.role === "user" || m.role === "assistant" ? m.role : null;
    if (!role) continue;
    let citations: unknown[] | undefined;
    try {
      const raw = JSON.parse(m.citations_json || "[]");
      if (Array.isArray(raw) && raw.length) citations = raw;
    } catch {
      // ignore
    }
    const parent = `${m.parent_id || ""}`.trim();
    items.push({
      parentId: parent || null,
      message: {
        id: m.message_id,
        role,
        content: m.content || "",
        ...(citations ? { citations } : {}),
        // assistant-ui: status chỉ cho phép assistant; user mang status sẽ ném ra trực tiếp
        ...(role === "assistant"
          ? { status: { type: "complete", reason: "stop" } }
          : {}),
      },
    });
  }
  return items;
}
