// 阅读页提问（ACP）的宿主端口。见 docs/core/frontend/reader-ask.md、docs/api/16-AI/01-阅读页提问.md。
//
// - 列 agent：GET /api/v1/ai/agents。
// - 连一个 agent：WebSocket /api/v1/ai/agents/{id}/acp?api_key=…（浏览器的 WebSocket 带不了请求头），每条文字消息是一条 ACP JSON-RPC。
//   自带 agent（retainpdf）再带模型配置：设置里默认的翻译模型（地址、模型、协议、思考）和凭据库里翻译密钥的引用（不传明文 key）。
// - 演示模式给假 agent；局域网共享打开的页面不给（桌面网关拦了 /api/v1/ai）。

import { openAcpWebSocketSession } from "@retainpdf/ask/acp";
import type { AskConfigOption } from "@retainpdf/ask";
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
import { connectionValue, savedDefaultTranslationModel, savedTranslationConnections, type TranslationConnection } from "@/platform/config/translation-connections.js";
import { loadBrowserStoredConfig, savePersistedBrowserStoredConfig } from "@/platform/config/persisted-config.js";
import { createCredential, updateCredential } from "@/platform/api/domains/credentials.js";
import { mockAskPort } from "@/platform/mock/ask-agent.js";

export const BUILTIN_AGENT_ID = "retainpdf";

type AgentRow = { id?: string; name?: string; kind?: string; available?: boolean; reason?: string; launch?: string; install?: string };

function defaultConnection(): TranslationConnection | null {
  const connections = savedTranslationConnections();
  const preferred = savedDefaultTranslationModel();
  return connections.find((item) => item.model === preferred) || connections[0] || null;
}

/** 自带 agent 的模型配置：设置里默认的翻译模型（密钥另外换成凭据库引用，见 ensureAskCredential）；没配模型时说清楚。 */
export function builtinModelQuery(connection: TranslationConnection | null = defaultConnection()): { query: Record<string, string>; missing: string } {
  if (!connection) return { query: {}, missing: "设置里还没有配翻译模型" };
  const query: Record<string, string> = {
    model: connection.model,
    base_url: connection.baseUrl,
    api_protocol: connection.apiProtocol || "openai",
  };
  if (connection.thinking && connection.thinking !== "off") query.thinking = connection.thinking;
  return { query, missing: "" };
}

/**
 * 后端的 ACP 桥不收明文 key，只收凭据库引用。翻译任务一直是带明文 key 提交的，所以多数人浏览器里没有引用（11-26 用户：「前端还是没接入我们的 agent」）。
 * 连自带 agent 前：浏览器设置里有翻译密钥的引用就把它更新成当前这把，没有（或引用失效）就存一把新的、把引用记回浏览器设置。
 */
async function ensureAskCredential(connection: TranslationConnection): Promise<string> {
  const current = loadBrowserStoredConfig() as Record<string, unknown>;
  const existing = `${current.translationCredentialRef || ""}`.trim();
  const payload = { kind: "translation_api_key", provider: connection.provider, label: "翻译 API", secret: connection.apiKey };
  if (existing) {
    try {
      await updateCredential(API_PREFIX, existing, payload as never);
      return existing;
    } catch {
      // 引用失效（凭据库换了、被删了）：下面新存一把。
    }
  }
  const created = await createCredential(API_PREFIX, payload as never);
  const ref = `${(created as { credential?: { credential_ref?: string } })?.credential?.credential_ref || ""}`.trim();
  if (!ref) throw new Error("翻译模型的密钥存不进凭据库");
  await savePersistedBrowserStoredConfig({ ...current, translationCredentialRef: ref });
  return ref;
}

/** 自带类 agent（kind 是 builtin：retainpdf、11-26 起还有 retainpdf-pi）：握手要带模型配置、凭据引用、job_id。 */
export function isBuiltinAgentRow(row: AgentRow): boolean {
  return row.kind === "builtin" || row.id === BUILTIN_AGENT_ID;
}

/** 后端的 agent 列表 → 阅读器的；自带的缺配置时标成用不了。 */
export function toReaderAgents(rows: readonly AgentRow[], builtinMissing: string): ReaderAskAgent[] {
  return rows
    .filter((row) => row && row.id)
    .map((row) => {
      const id = `${row.id}`;
      const builtin = isBuiltinAgentRow(row);
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

async function listAgents(builtinAgentIds: Set<string>): Promise<ReaderAskAgent[]> {
  const view = await listAiAgents(API_PREFIX);
  const rows = Array.isArray(view?.agents) ? (view.agents as AgentRow[]) : [];
  for (const row of rows) if (row?.id && isBuiltinAgentRow(row)) builtinAgentIds.add(`${row.id}`);
  return toReaderAgents(rows, builtinModelQuery().missing);
}

/**
 * 自带类 agent 的「模型」设置（照 ACP 的 configOptions 写，提问窗画成选模型）：就是设置里存的那几条连接——用户自己的数据。
 * 思考强度不在这里编：每个模型支持的档位不一样，由 agent 按当前模型自己报（ACP 的 thought_level），报了才显示。
 */
export const BUILTIN_MODEL_CONFIG = "model";

export function builtinModelOption(connections: readonly TranslationConnection[], chosen: TranslationConnection): AskConfigOption {
  return {
    id: BUILTIN_MODEL_CONFIG,
    name: "模型",
    category: "model",
    type: "select",
    currentValue: connectionValue(chosen),
    options: connections.map((connection) => ({ value: connectionValue(connection), name: connection.model, description: connection.label, group: connection.label })),
  };
}

/** 自带类 agent 用哪条连接：用户在提问窗选过的优先，没选过（或那条删了）用设置里默认的。 */
export function builtinConnection(connections: readonly TranslationConnection[], config: Readonly<Record<string, string | boolean>> | undefined, fallback: TranslationConnection | null): TranslationConnection | null {
  const wanted = `${config?.[BUILTIN_MODEL_CONFIG] ?? ""}`;
  return connections.find((item) => connectionValue(item) === wanted) || fallback;
}

async function openSession(
  { agentId, jobId, config }: { agentId: string; jobId: string; config?: Readonly<Record<string, string | boolean>> },
  handlers: ReaderAskHandlers,
  builtinAgentIds: ReadonlySet<string>,
): Promise<ReaderAskSession> {
  const builtin = builtinAgentIds.has(agentId);
  if (!builtin) {
    // 本机 agent：认证走 api_key，模型、思考强度由它自己的 configOptions 管（窗口开了会话再设）。
    return openAcpWebSocketSession(acpSocketUrl(apiBase(), agentId, frontendApiKey(), {}), handlers);
  }
  const connections = savedTranslationConnections();
  const connection = builtinConnection(connections, config, defaultConnection());
  // 思考强度先照设置里这条连接的（握手参数 thinking）；agent 报了 thought_level 以后，提问窗改它走 session/set_config_option。
  const extra = builtinModelQuery(connection);
  if (extra.missing || !connection) throw new Error(extra.missing || "设置里还没有配翻译模型");
  extra.query = { ...extra.query, credential_ref: await ensureAskCredential(connection) };
  // 自带 agent 自己读书（read_pages / search_book / view_page）：带上阅读页的任务编号（merged-… 也照传）。本机 agent 走 retainpdf mcp，不用。
  if (jobId) extra.query = { ...extra.query, job_id: jobId };
  // 握手、开会话、发问都在提问窗的包里（@retainpdf/ask/acp）；这里只拼地址：api_key、模型配置和凭据引用、job_id。
  const session = await openAcpWebSocketSession(acpSocketUrl(apiBase(), agentId, frontendApiKey(), extra.query), handlers);
  // 模型这一项是我们加的（agent 自己报了就用它的）；换模型要换密钥和地址，只能重开会话。别的设置（思考强度……）照 agent 报的、交给 agent 改。
  const own = session.configOptions || [];
  if (own.some((option) => option.category === "model")) return session;
  let model = builtinModelOption(connections, connection);
  return {
    ...session,
    configOptions: [model, ...own],
    reopenOnConfigChange: (configId) => configId === BUILTIN_MODEL_CONFIG,
    setConfigOption: async (configId, value) => {
      if (configId === BUILTIN_MODEL_CONFIG) {
        model = { ...model, currentValue: value };
        return [model, ...own];
      }
      const next = session.setConfigOption ? await session.setConfigOption(configId, value) : own;
      return [model, ...next.filter((option) => option.category !== "model")];
    },
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

/** 建问答记录的请求体。session_id 是 ACP 的 sessionId：后端删问答、删书时按它清 retainpdf-pi 的会话文件（别的 agent 带上也不碍事）。 */
export function toCreateThreadBody(input: Parameters<ReaderAskThreadsPort["create"]>[1]) {
  return {
    agent_id: input.agentId,
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    anchor: toAnchorRecord(input.anchor),
    messages: toMessageInputs(input.messages),
  };
}

/** 改问答记录的请求体：给了的才改（agent 换了、会话重开了带新的）。 */
export function toPatchThreadBody(input: Parameters<ReaderAskThreadsPort["update"]>[2]) {
  return {
    ...(input.agentId ? { agent_id: input.agentId } : {}),
    ...(input.sessionId ? { session_id: input.sessionId } : {}),
    messages: toMessageInputs(input.messages),
  };
}

const askThreadsPort: ReaderAskThreadsPort = {
  list: async (documentId) => ((await listAskThreads(API_PREFIX, documentId)).threads || []).map((row) => fromThreadRecord(row as ThreadRow)),
  get: async (documentId, threadId) => fromThreadRecord((await getAskThread(API_PREFIX, documentId, threadId)) as ThreadRow),
  create: async (documentId, input) => fromThreadRecord((await createAskThread(API_PREFIX, documentId, toCreateThreadBody(input) as never)) as ThreadRow),
  update: async (documentId, threadId, input) => fromThreadRecord((await updateAskThread(API_PREFIX, documentId, threadId, toPatchThreadBody(input) as never)) as ThreadRow),
  remove: async (documentId, threadId) => {
    await deleteAskThread(API_PREFIX, documentId, threadId);
  },
};

function createRealAskPort(): ReaderAskPort {
  // 列表里见过的自带类 agent（openSession 只拿到 id）。没列过也认 retainpdf。
  const builtinAgentIds = new Set<string>([BUILTIN_AGENT_ID]);
  return {
    listAgents: () => listAgents(builtinAgentIds),
    openSession: (options, handlers) => openSession(options, handlers, builtinAgentIds),
    threads: askThreadsPort,
  };
}

const realAskPort: ReaderAskPort = createRealAskPort();

function pickAskPort(): ReaderAskPort | null {
  if (isMockMode()) return mockAskPort;
  if (isLanSharedPage()) return null;
  return realAskPort;
}

export const readerAskPort = pickAskPort();
