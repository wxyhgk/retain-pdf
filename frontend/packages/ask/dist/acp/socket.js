// 连一个 ACP agent：WebSocket 上每条文字消息是一条 ACP JSON-RPC（RetainPDF 后端的桥 /api/v1/ai/agents/{id}/acp 就是这样）。
// 宿主拼好地址（认证、模型配置都在查询串里，浏览器的 WebSocket 带不了请求头），这里握手、开会话，返回 AskSession。
import { client, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { createWebSocketStream } from "@agentclientprotocol/sdk/experimental/ws-client";
export async function openAcpWebSocketSession(url, handlers, options = {}) {
    const app = client()
        .onNotification("session/update", ({ params }) => handlers.onUpdate(params.update))
        .onRequest("session/request_permission", ({ params }) => handlers.onPermission(params));
    // protocols 要明确给空数组：SDK 不给时传 undefined，Chrome 会把它当成子协议 "undefined" 发出去，桥不回这个头，握手就断（2026-11-25 真机联调踩到）。
    // cookies 不用：认证走查询串。
    const connection = app.connect(createWebSocketStream(url, { protocols: [], cookies: "omit" }));
    const agent = connection.agent;
    // 连接断了（RetainPDF 的桥在 agent 退出时用 1011 关，原因里有退出码和 stderr 最后一行）：没答完的请求会被拒，消息照原样给用户看。
    try {
        await agent.request("initialize", {
            protocolVersion: PROTOCOL_VERSION,
            clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        });
    }
    catch (error) {
        connection.close();
        const detail = error instanceof Error && error.message ? `（${error.message}）` : "";
        throw new Error(`连不上这个 agent：没开、没装，或者设置不对${detail}`);
    }
    const { sessionId } = await agent.request("session/new", { cwd: options.cwd ?? "", mcpServers: [] });
    return {
        prompt: async (blocks) => {
            const result = await agent.request("session/prompt", { sessionId, prompt: blocks });
            const extra = result;
            return { stopReason: result.stopReason, usage: extra.usage ?? null, meta: extra._meta ?? null };
        },
        cancel: () => {
            void agent.notify("session/cancel", { sessionId }).catch(() => { });
        },
        close: () => connection.close(),
    };
}
