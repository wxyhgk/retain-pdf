// 阅读页提问（ACP）的宿主端口。见 docs/core/frontend/reader-ask.md、docs/api/16-AI/01-阅读页提问.md。
//
// - 列 agent：GET /api/v1/ai/agents。
// - 连一个 agent：WebSocket /api/v1/ai/agents/{id}/acp?api_key=…（浏览器的 WebSocket 带不了请求头），每条文字消息是一条 ACP JSON-RPC。
//   自带 agent（retainpdf）再带模型配置：设置里默认的翻译模型（地址、模型、协议、思考）和凭据库里翻译密钥的引用（不传明文 key）。
// - 演示模式给假 agent；局域网共享打开的页面不给（桌面网关拦了 /api/v1/ai）。

import { client, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { createWebSocketStream } from "@agentclientprotocol/sdk/experimental/ws-client";
import type { ReaderAskAgent, ReaderAskHandlers, ReaderAskPort, ReaderAskSession } from "@retainpdf/reader/contracts";

import { API_PREFIX } from "@/platform/config/api-constants.js";
import { listAiAgents } from "@retainpdf/api/ai";
import { apiBase, frontendApiKey, isLanSharedPage, isMockMode } from "@/platform/config/runtime.js";
import { savedDefaultTranslationModel, savedTranslationConnections } from "@/platform/config/translation-connections.js";
import { readStoredTranslationSecret } from "@/platform/api/translation-secret.js";
import { mockAskPort } from "@/platform/mock/ask-agent.js";

export const BUILTIN_AGENT_ID = "retainpdf";

type AgentRow = { id?: string; name?: string; kind?: string; available?: boolean; reason?: string; launch?: string };

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
  const connection = app.connect(createWebSocketStream(acpSocketUrl(apiBase(), agentId, frontendApiKey(), extra.query)));
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
      return { stopReason: result.stopReason };
    },
    cancel: () => {
      void agent.notify("session/cancel", { sessionId }).catch(() => {});
    },
    close: () => connection.close(),
  };
}

const realAskPort: ReaderAskPort = { listAgents, openSession };

function pickAskPort(): ReaderAskPort | null {
  if (isMockMode()) return mockAskPort;
  if (isLanSharedPage()) return null;
  return realAskPort;
}

export const readerAskPort = pickAskPort();
