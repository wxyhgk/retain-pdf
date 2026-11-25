// 阅读页提问（ACP）的宿主端口。见 docs/core/frontend/reader-ask.md、docs/api/16-AI/01-阅读页提问.md。
//
// - 列 agent：GET /api/v1/ai/agents。
// - 连一个 agent：WebSocket /api/v1/ai/agents/{id}/acp?api_key=…（浏览器的 WebSocket 带不了请求头），每条文字消息是一条 ACP JSON-RPC。
//   自带 agent（retainpdf）再带模型配置：设置里默认的翻译模型（地址、模型、协议、思考）和凭据库里翻译密钥的引用（不传明文 key）。
// - 演示模式给假 agent；局域网共享打开的页面不给（桌面网关拦了 /api/v1/ai）。

import { client, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { createWebSocketStream } from "@agentclientprotocol/sdk/experimental/ws-client";
import type {
  ReaderAskAgent,
  ReaderAskAnchor,
  ReaderAskHandlers,
  ReaderAskMessage,
  ReaderAskPort,
  ReaderAskSession,
  ReaderAskThread,
  ReaderAskThreadsPort,
} from "@retainpdf/reader/contracts";

import { API_PREFIX } from "@/platform/config/api-constants.js";
import { createAskThread, deleteAskThread, getAskThread, listAiAgents, listAskThreads, updateAskThread } from "@retainpdf/api/ai";
import { apiBase, frontendApiKey, isLanSharedPage, isMockMode } from "@/platform/config/runtime.js";
import { savedDefaultTranslationModel, savedTranslationConnections } from "@/platform/config/translation-connections.js";
import { readStoredTranslationSecret } from "@/platform/api/translation-secret.js";
import { mockAskPort } from "@/platform/mock/ask-agent.js";

export const BUILTIN_AGENT_ID = "retainpdf";

type AgentRow = { id?: string; name?: string; kind?: string; available?: boolean; reason?: string; launch?: string; install?: string };

/** 自带 agent 的模型配置：设置里默认的翻译模型；没配模型或密钥没存进凭据库时说清楚缺什么。 */
export function builtinModelQuery(): { query: Record<string, string>; missing: string } {
  const connections = savedTranslationConnections();
  const preferred = savedDefaultTranslationModel();
  const connection = connections.find((item) => item.model === preferred) || connections[0];
  if (!connection) return { query: {}, missing: "设置里还没有配翻译模型" };
  const credentialRef = `${readStoredTranslationSecret().translationCredentialRef || ""}`.trim();
  if (!credentialRef) return { query: {}, missing: "翻译模型的密钥还没存进凭据库（在设置里保存一次）" };
  const query: Record<string, string> = {
    model: connection.model,
    base_url: connection.baseUrl,
    api_protocol: connection.apiProtocol || "openai",
    credential_ref: credentialRef,
  };
  if (connection.thinking && connection.thinking !== "off") query.thinking = connection.thinking;
  return { query, missing: "" };
}

/** 后端的 agent 列表 → 阅读器的；自带的缺配置时标成用不了。 */
export function toReaderAgents(rows: readonly AgentRow[], builtinMissing: string): ReaderAskAgent[] {
  return rows
    .filter((row) => row && row.id)
    .map((row) => {
      const id = `${row.id}`;
      const builtin = id === BUILTIN_AGENT_ID;
      const available = row.available !== false && !(builtin && builtinMissing);
      return {
        id,
        name: `${row.name || id}`,
        description: builtin ? "用设置里的翻译模型" : row.launch ? `本机：${row.launch}` : "",
        available,
        reason: builtin && builtinMissing ? builtinMissing : `${row.reason || ""}`,
        install: `${row.install || ""}` || undefined,
        acceptsImages: builtin,
      };
    });
}

/** WebSocket 地址：接口地址换成 ws(s)，查询串带 api_key 和（自带 agent 的）模型配置。 */
export function acpSocketUrl(base: string, agentId: string, apiKey: string, extra: Record<string, string> = {}): string {
  const url = new URL(`${API_PREFIX}/ai/agents/${encodeURIComponent(agentId)}/acp`, base || globalThis.location?.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (apiKey) url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(extra)) if (value) url.searchParams.set(key, value);
  return url.toString();
}

async function listAgents(): Promise<ReaderAskAgent[]> {
  const view = await listAiAgents(API_PREFIX);
  return toReaderAgents(Array.isArray(view?.agents) ? (view.agents as AgentRow[]) : [], builtinModelQuery().missing);
}

async function openSession({ agentId }: { agentId: string; jobId: string }, handlers: ReaderAskHandlers): Promise<ReaderAskSession> {
  const extra = agentId === BUILTIN_AGENT_ID ? builtinModelQuery() : { query: {}, missing: "" };
  if (extra.missing) throw new Error(extra.missing);
  const app = client()
    .onNotification("session/update", ({ params }) => handlers.onUpdate(params.update))
    .onRequest("session/request_permission", ({ params }) => handlers.onPermission(params));
  // protocols 要明确给空数组：SDK 不给时传 undefined，Chrome 会把它当成子协议 "undefined" 发出去，桥不回这个头，握手就断（2026-11-25 真机联调踩到）。
  // cookies 不用：认证走 api_key。
  const connection = app.connect(createWebSocketStream(acpSocketUrl(apiBase(), agentId, frontendApiKey(), extra.query), { protocols: [], cookies: "omit" }));
  const agent = connection.agent;
  // 连接断了（agent 退出时桥用 1011 关，原因里有退出码和 stderr 最后一行）：没答完的请求会被拒，消息照原样给用户看。
  try {
    await agent.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
  } catch (error) {
    connection.close();
    const detail = error instanceof Error && error.message ? `（${error.message}）` : "";
    throw new Error(`连不上这个 agent：没开、没装，或者设置不对${detail}`);
  }
  // cwd 空着、mcpServers 空着：桥会填书文件夹、补上 retainpdf mcp。
  const { sessionId } = await agent.request("session/new", { cwd: "", mcpServers: [] });
  return {
    prompt: async (blocks) => {
      const result = await agent.request("session/prompt", { sessionId, prompt: blocks });
      const extra = result as { usage?: Record<string, unknown> | null; _meta?: Record<string, unknown> | null };
      return { stopReason: result.stopReason, usage: extra.usage ?? null, meta: extra._meta ?? null };
    },
    cancel: () => {
      void agent.notify("session/cancel", { sessionId }).catch(() => {});
    },
    close: () => connection.close(),
  };
}

// —— 问答记录（契约 ask-threads.v1）：阅读器用驼峰，接口用下划线 ——

type AnchorRecord = Partial<{
  pane: string; page: number; item_id: string | null; selection: string | null; source_text: string | null;
  translated_text: string | null; section: string | null; point: { x: number; y: number } | null;
}>;

export function toAnchorRecord(anchor: ReaderAskAnchor) {
  return {
    pane: anchor.pane,
    page: anchor.page,
    item_id: anchor.itemId,
    selection: anchor.selection || null,
    source_text: anchor.sourceText || null,
    translated_text: anchor.translatedText || null,
    section: anchor.section || null,
    point: anchor.point,
  };
}

export function fromAnchorRecord(record: AnchorRecord | null | undefined): ReaderAskAnchor {
  const value = record || {};
  return {
    pane: value.pane === "source" ? "source" : "translated",
    page: Number(value.page) || 1,
    itemId: value.item_id || null,
    selection: value.selection || "",
    sourceText: value.source_text || "",
    translatedText: value.translated_text || "",
    section: value.section || "",
    point: value.point && Number.isFinite(value.point.x) && Number.isFinite(value.point.y) ? { x: value.point.x, y: value.point.y } : null,
  };
}

type ThreadRow = {
  thread_id: string; agent_id: string; title: string; anchor: AnchorRecord; message_count: number; updated_at: string;
  messages?: { role: string; text: string; thought?: string | null; usage?: Record<string, unknown> | null }[];
};

export function fromThreadRecord(row: ThreadRow): ReaderAskThread {
  return {
    threadId: row.thread_id,
    agentId: row.agent_id,
    title: row.title || "",
    anchor: fromAnchorRecord(row.anchor),
    messageCount: Number(row.message_count) || 0,
    updatedAt: row.updated_at || "",
    ...(Array.isArray(row.messages)
      ? { messages: row.messages.map((message) => ({ role: message.role === "user" ? "user" : "assistant", text: message.text || "", thought: message.thought ?? null, usage: message.usage ?? null }) as ReaderAskMessage) }
      : {}),
  };
}

function toMessageInputs(messages: readonly ReaderAskMessage[]) {
  return messages.map((message) => ({ role: message.role, text: message.text, thought: message.thought ?? null, usage: message.usage ?? null }));
}

const askThreadsPort: ReaderAskThreadsPort = {
  list: async (documentId) => ((await listAskThreads(API_PREFIX, documentId)).threads || []).map((row) => fromThreadRecord(row as ThreadRow)),
  get: async (documentId, threadId) => fromThreadRecord((await getAskThread(API_PREFIX, documentId, threadId)) as ThreadRow),
  create: async (documentId, input) => fromThreadRecord((await createAskThread(API_PREFIX, documentId, {
    agent_id: input.agentId,
    anchor: toAnchorRecord(input.anchor),
    messages: toMessageInputs(input.messages),
  } as never)) as ThreadRow),
  update: async (documentId, threadId, input) => fromThreadRecord((await updateAskThread(API_PREFIX, documentId, threadId, {
    ...(input.agentId ? { agent_id: input.agentId } : {}),
    messages: toMessageInputs(input.messages),
  } as never)) as ThreadRow),
  remove: async (documentId, threadId) => {
    await deleteAskThread(API_PREFIX, documentId, threadId);
  },
};

const realAskPort: ReaderAskPort = { listAgents, openSession, threads: askThreadsPort };

function pickAskPort(): ReaderAskPort | null {
  if (isMockMode()) return mockAskPort;
  if (isLanSharedPage()) return null;
  return realAskPort;
}

export const readerAskPort = pickAskPort();
