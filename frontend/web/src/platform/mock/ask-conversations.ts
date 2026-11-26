// 演示模式的主对话、副对话（阅读页提问）：存在内存里（刷新就没了），照后端的规矩：主对话只有一个开着的、
// 消息只追加、幂等号重复回原来那条、副对话结束时主对话末尾追加结论卡片。够演示「?」、深挖、结论卡片、看更早的。

import type { ReaderAskConversationsPort, ReaderAskMemoriesPort } from "@retainpdf/reader/contracts";
import type { AskConversationMessageInput, AskConversationMessageRecord, AskConversationRecord, AskMemoryRecord } from "@retainpdf/api/ai";

const conversations = new Map<string, AskConversationRecord>();
const messages = new Map<string, AskConversationMessageRecord[]>();
let seq = 0;

function now(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-demo-${seq}`;
}

function create(kind: "main" | "side", extra: Partial<AskConversationRecord> = {}): AskConversationRecord {
  const at = now();
  const record: AskConversationRecord = {
    conversation_id: nextId("conv"), kind, parent_id: null, forked_from_message_id: null, status: "open", title: "", summary: null,
    document_id: null, message_count: 0, last_seq: 0, created_at: at, updated_at: at, closed_at: null, ...extra,
  };
  conversations.set(record.conversation_id, record);
  messages.set(record.conversation_id, []);
  return record;
}

function must(conversationId: string): AskConversationRecord {
  const record = conversations.get(conversationId);
  if (!record) throw new Error("没有这个对话");
  return record;
}

type PushInput = Omit<AskConversationMessageInput, "role"> & { role: AskConversationMessageRecord["role"]; side_conversation_id?: string | null };

function push(conversationId: string, input: PushInput): AskConversationMessageRecord {
  const conversation = must(conversationId);
  const list = messages.get(conversationId)!;
  const repeated = input.client_message_id ? list.find((message) => message.client_message_id === input.client_message_id) : undefined;
  if (repeated) return repeated;
  const selection = input.selection ? { ...input.selection, item_ids: input.selection.item_ids || [] } : null;
  const record: AskConversationMessageRecord = {
    message_id: nextId("msg"), conversation_id: conversationId, seq: conversation.last_seq + 1, role: input.role, text: input.text,
    thought: input.thought ?? null, usage: input.usage ?? null, agent_id: input.agent_id ?? null, side_conversation_id: input.side_conversation_id ?? null,
    document_id: input.document_id ?? selection?.document_id ?? null, job_id: selection?.job_id ?? null, version_id: selection?.translation_version ?? null,
    pane: selection?.pane ?? null, page: selection?.page ?? null, selection: selection as never, client_message_id: input.client_message_id ?? null, created_at: now(),
    superseded_at: null, edited_from: input.edited_from ?? null,
  };
  list.push(record);
  conversations.set(conversationId, { ...conversation, message_count: list.length, last_seq: record.seq, updated_at: record.created_at });
  return record;
}

export const mockAskConversations: ReaderAskConversationsPort = {
  main: async () => [...conversations.values()].find((record) => record.kind === "main" && record.status === "open") || create("main"),
  get: async (conversationId) => must(conversationId),
  messages: async (conversationId, page = {}) => {
    must(conversationId);
    const all = messages.get(conversationId)!.filter((message) => !page.beforeSeq || message.seq < page.beforeSeq);
    const limit = page.limit || 50;
    return { conversation_id: conversationId, messages: all.slice(-limit), has_more: all.length > limit, compactions: [] } as never;
  },
  supersede: async (conversationId, messageId) => {
    const list = messages.get(conversationId) || [];
    const at = list.findIndex((message) => message.message_id === messageId);
    if (at < 0) throw new Error("没有这条消息");
    const ids: string[] = [];
    for (const message of list.slice(at)) {
      if (message.superseded_at) continue;
      message.superseded_at = now();
      ids.push(message.message_id);
    }
    return { conversation: must(conversationId), superseded_message_ids: ids, superseded_compaction_ids: [] };
  },
  append: async (conversationId, input) => {
    const conversation = must(conversationId);
    if (conversation.status !== "open") throw Object.assign(new Error("对话已经结束"), { reason: "ask_conversation_not_open" });
    const added = input.map((message) => push(conversationId, message));
    return { conversation: must(conversationId), messages: added, compaction_due: false };
  },
  contextText: async () => "",
  fork: async (input) => create("side", { parent_id: input.parent_id, forked_from_message_id: input.forked_from_message_id ?? null, title: input.title || "副对话", document_id: input.document_id ?? null }),
  close: async (conversationId, summary) => {
    const side = must(conversationId);
    const said = messages.get(conversationId)!.filter((message) => message.role === "assistant").map((message) => message.text.split("\n")[0]).join(" ");
    const text = summary || (said ? `（演示）聊下来的结论：${said.slice(0, 120)}` : "");
    const closed = { ...side, status: "closed" as const, summary: text || null, closed_at: now() };
    conversations.set(conversationId, closed);
    const card = text && side.parent_id ? push(side.parent_id, { role: "side_summary", text, side_conversation_id: conversationId }) : null;
    return { conversation: closed, card };
  },
  reopen: async (conversationId) => {
    const record = { ...must(conversationId), status: "open" as const, closed_at: null };
    conversations.set(conversationId, record);
    return record;
  },
  archive: async (conversationId) => {
    const record = { ...must(conversationId), status: "archived" as const };
    conversations.set(conversationId, record);
    return record;
  },
  compact: async () => {},
  bookMessages: async (documentId) => [...messages.values()].flat().filter((message) => message.role === "user" && message.page && !message.superseded_at && (!message.document_id || message.document_id === documentId)),
  forgetMemory: async () => {},
};

// 记忆也在内存里：两条演示用的，照后端的规矩（删了标 deleted、列表默认只看 active）。
const memories: AskMemoryRecord[] = [
  { scope: "user", category: "style", text: "先给结论，再讲推导", origin: "agent" },
  { scope: "user", category: "background", text: "读的是量子化学，熟悉线性代数", origin: "user" },
].map((entry, index) => ({
  memory_id: `mem-demo-seed-${index + 1}`, scope: entry.scope as AskMemoryRecord["scope"], document_id: null, category: entry.category as AskMemoryRecord["category"],
  text: entry.text, status: "active", superseded_by: null, origin: entry.origin as AskMemoryRecord["origin"], agent_id: entry.origin === "agent" ? "retainpdf" : null,
  source_conversation_id: null, source_message_id: null, source_job_id: null, source_page: null, created_at: now(), updated_at: now(), deleted_at: null,
}));
let memoryEnabled = true;

export const mockAskMemories: ReaderAskMemoriesPort = {
  list: async (query) => memories.filter((memory) => memory.status === "active"
    && (!query.scope || memory.scope === query.scope)
    && (!query.document_id || memory.document_id === query.document_id)
    && (!query.q || memory.text.includes(query.q))),
  create: async (input) => {
    const memory: AskMemoryRecord = {
      memory_id: nextId("mem"), scope: input.scope, document_id: input.document_id ?? null, category: input.category ?? "other", text: input.text, status: "active",
      superseded_by: null, origin: input.origin ?? "user", agent_id: null, source_conversation_id: null, source_message_id: null, source_job_id: null, source_page: null,
      created_at: now(), updated_at: now(), deleted_at: null,
    };
    memories.unshift(memory);
    return { memory, created: true, replaced: null };
  },
  update: async (memoryId, input) => {
    const memory = memories.find((entry) => entry.memory_id === memoryId);
    if (!memory) throw new Error("没有这条记忆");
    Object.assign(memory, { ...(input.text ? { text: input.text } : {}), ...(input.category ? { category: input.category } : {}), updated_at: now() });
    return memory;
  },
  remove: async (memoryId) => {
    const memory = memories.find((entry) => entry.memory_id === memoryId);
    if (!memory) throw new Error("没有这条记忆");
    Object.assign(memory, { status: "deleted", deleted_at: now() });
    return memory;
  },
  settings: async () => ({ memory_enabled: memoryEnabled, updated_at: null }),
  setEnabled: async (enabled) => {
    memoryEnabled = enabled;
    return { memory_enabled: enabled, updated_at: now() };
  },
};
