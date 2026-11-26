// 连一个 ACP agent：WebSocket 上每条文字消息是一条 ACP JSON-RPC（RetainPDF 后端的桥 /api/v1/ai/agents/{id}/acp 就是这样）。
// 宿主拼好地址（认证、模型配置都在查询串里，浏览器的 WebSocket 带不了请求头），这里握手、开会话，返回 AskSession。

import { client, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { createWebSocketStream } from "@agentclientprotocol/sdk/experimental/ws-client";

import type { AskAgentCapabilities, AskHandlers, AskSession } from "../contract.js";
import { normalizeConfigOptions } from "./config.js";

export type AcpSocketOptions = {
  /** session/new 的 cwd 和 mcpServers。RetainPDF 的桥空着就会自己填书文件夹、补上 retainpdf mcp。 */
  cwd?: string;
};

/** initialize 结果里的 agentCapabilities._meta.retainpdf（自带 agent 报，见 docs/api/16-AI/02-主对话和记忆.md）；只认布尔值。 */
export function retainpdfCapabilities(initialized: unknown): AskAgentCapabilities {
  const raw = (initialized as { agentCapabilities?: { _meta?: { retainpdf?: Record<string, unknown> } } } | null)?.agentCapabilities?._meta?.retainpdf;
  if (!raw || typeof raw !== "object") return {};
  const out: AskAgentCapabilities = {};
  for (const key of ["selection", "conversation", "memory"] as const) if (raw[key] === true) out[key] = true;
  return out;
}

export async function openAcpWebSocketSession(url: string, handlers: AskHandlers, options: AcpSocketOptions = {}): Promise<AskSession> {
  const app = client()
    .onNotification("session/update", ({ params }) => handlers.onUpdate(params.update))
    .onRequest("session/request_permission", ({ params }) => handlers.onPermission(params));
  // protocols 要明确给空数组：SDK 不给时传 undefined，Chrome 会把它当成子协议 "undefined" 发出去，桥不回这个头，握手就断（2026-11-25 真机联调踩到）。
  // cookies 不用：认证走查询串。
  const connection = app.connect(createWebSocketStream(url, { protocols: [], cookies: "omit" }));
  const agent = connection.agent;
  // 连接断了（RetainPDF 的桥在 agent 退出时用 1011 关，原因里有退出码和 stderr 最后一行）：没答完的请求会被拒，消息照原样给用户看。
  let capabilities: AskAgentCapabilities = {};
  try {
    const initialized = await agent.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    capabilities = retainpdfCapabilities(initialized);
  } catch (error) {
    connection.close();
    const detail = error instanceof Error && error.message ? `（${error.message}）` : "";
    throw new Error(`连不上这个 agent：没开、没装，或者设置不对${detail}`);
  }
  const created = await agent.request("session/new", { cwd: options.cwd ?? "", mcpServers: [] });
  const { sessionId } = created;
  return {
    sessionId,
    capabilities,
    // 模型、思考强度、模式……（ACP 的 configOptions；agent 不给就是空的，窗口不画选择器）。
    configOptions: normalizeConfigOptions((created as { configOptions?: unknown }).configOptions),
    setConfigOption: async (configId, value) => {
      const params = typeof value === "boolean" ? { sessionId, configId, type: "boolean" as const, value } : { sessionId, configId, value };
      const result = await agent.request("session/set_config_option", params as never);
      return normalizeConfigOptions((result as { configOptions?: unknown })?.configOptions);
    },
    prompt: async (blocks, meta) => {
      const params = meta && Object.keys(meta).length ? { sessionId, prompt: blocks, _meta: meta } : { sessionId, prompt: blocks };
      const result = await agent.request("session/prompt", params);
      const extra = result as { usage?: Record<string, unknown> | null; _meta?: Record<string, unknown> | null };
      return { stopReason: result.stopReason, usage: extra.usage ?? null, meta: extra._meta ?? null };
    },
    cancel: () => {
      void agent.notify("session/cancel", { sessionId }).catch(() => {});
    },
    close: () => connection.close(),
  };
}
