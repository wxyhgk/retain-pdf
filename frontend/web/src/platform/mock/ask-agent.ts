// 演示模式的假 ACP agent（阅读页提问）：不连后端，按 ACP 的 session/update 发一遍——
// 思考、读页的工具调用、计划、（Claude Code 那个）要许可、流式回答（带公式）、用量（_meta.retainpdf.usage）。
// 真的 ACP 桥见 docs/ops/planning/reader-ask/；桥好了以后宿主换成 WebSocket 那个端口。

import type { ContentBlock, SessionUpdate } from "@agentclientprotocol/sdk";
import type { ReaderAskHandlers, ReaderAskPort, ReaderAskSession } from "@retainpdf/reader/contracts";

const AGENTS = [
  { id: "retainpdf", name: "RetainPDF 自带模型", description: "用设置里配好的模型", available: true, acceptsImages: true },
  { id: "claude-code", name: "Claude Code", description: "本机的 Claude Code（ACP）", available: true },
  { id: "codex", name: "Codex", description: "本机的 Codex（ACP）", available: false, reason: "演示模式：没有装 codex-acp" },
];

const ANSWER = [
  "这一段说的是 **Hartree-Fock 近似**：把多电子波函数近似成一个 Slater 行列式，",
  "每个电子只感受其他电子的*平均*场。\n\n",
  "关键的式子是 Fock 方程：\n\n",
  "$$\n\\hat f(1)\\,\\chi_a(1) = \\varepsilon_a\\,\\chi_a(1)\n$$\n\n",
  "其中 Fock 算符 $\\hat f = \\hat h + \\sum_b (\\hat J_b - \\hat K_b)$，",
  "$\\hat J_b$ 是库仑算符，$\\hat K_b$ 是交换算符。\n\n",
  "1. 先猜一组轨道；\n2. 用它们算出 $\\hat f$；\n3. 解本征方程得到新轨道，重复直到自洽。\n",
];

const THOUGHT = ["读者问的是这一块……", "先看这一页讲到哪了，", "再用最少的公式把意思讲清楚。"];

function wait(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => setTimeout(resolve, signal.cancelled ? 0 : ms));
}

function promptText(blocks: ContentBlock[]): string {
  return blocks.map((block) => (block.type === "text" ? block.text : "")).join("\n");
}

function openFakeSession(agentId: string, handlers: ReaderAskHandlers): ReaderAskSession {
  let current = { cancelled: false };
  const send = (update: SessionUpdate) => {
    if (!current.cancelled) handlers.onUpdate(update);
  };
  return {
    async prompt(blocks) {
      const signal = { cancelled: false };
      current = signal;
      const page = /第 (\d+) 页/.exec(promptText(blocks))?.[1] || "1";
      for (const piece of THOUGHT) {
        await wait(220, signal);
        send({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: piece } });
      }
      send({
        sessionUpdate: "plan",
        entries: [
          { content: `看第 ${page} 页`, priority: "high", status: "in_progress" },
          { content: "解释这一段", priority: "high", status: "pending" },
        ],
      });
      send({ sessionUpdate: "tool_call", toolCallId: "view-page", title: `看第 ${page} 页（原文）`, kind: "read", status: "in_progress", locations: [{ path: `第 ${page} 页` }] });
      await wait(500, signal);
      send({ sessionUpdate: "tool_call_update", toolCallId: "view-page", status: "completed", content: [{ type: "content", content: { type: "text", text: "（页图和这一页的原文、译文）" } }] });
      if (agentId === "claude-code") {
        // Claude Code 想把要点记进笔记：先要许可。
        send({ sessionUpdate: "tool_call", toolCallId: "note", title: "把要点记到这本书的笔记里", kind: "edit", status: "pending" });
        const answer = await handlers.onPermission({
          sessionId: "demo",
          toolCall: { toolCallId: "note", title: "把要点记到这本书的笔记里", kind: "edit" },
          options: [
            { optionId: "allow", name: "允许", kind: "allow_once" },
            { optionId: "deny", name: "不用", kind: "reject_once" },
          ],
        });
        const allowed = answer.outcome.outcome === "selected" && answer.outcome.optionId === "allow";
        send({ sessionUpdate: "tool_call_update", toolCallId: "note", status: allowed ? "completed" : "failed", content: [{ type: "content", content: { type: "text", text: allowed ? "记好了（演示）" : "没记" } }] });
      }
      send({
        sessionUpdate: "plan",
        entries: [
          { content: `看第 ${page} 页`, priority: "high", status: "completed" },
          { content: "解释这一段", priority: "high", status: "in_progress" },
        ],
      });
      let output = 0;
      for (const piece of ANSWER) {
        for (const chunk of piece.match(/[\s\S]{1,12}/g) || []) {
          await wait(40, signal);
          if (signal.cancelled) return { stopReason: "cancelled" };
          output += Math.ceil(chunk.length / 2);
          send({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: chunk } });
        }
      }
      send({
        sessionUpdate: "plan",
        entries: [
          { content: `看第 ${page} 页`, priority: "high", status: "completed" },
          { content: "解释这一段", priority: "high", status: "completed" },
        ],
      });
      send({
        sessionUpdate: "usage_update",
        used: 5200 + output,
        size: 200000,
        cost: { amount: 0.0021, currency: "USD" },
        _meta: { retainpdf: { usage: { inputTokens: 5200, outputTokens: output, cachedInputTokens: 4096 } } },
      });
      return { stopReason: signal.cancelled ? "cancelled" : "end_turn" };
    },
    cancel() {
      current.cancelled = true;
    },
    close() {
      current.cancelled = true;
    },
  };
}

export const mockAskPort: ReaderAskPort = {
  listAgents: async () => AGENTS,
  openSession: async ({ agentId }, handlers) => openFakeSession(agentId, handlers),
};
