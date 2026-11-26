// 演示模式的假 ACP agent（阅读页提问）：不连后端，按 ACP 的 session/update 发一遍——
// 思考、读页的工具调用、计划、（Claude Code 那个）要许可、流式回答（带公式）、用量（_meta.retainpdf.usage）。
// 真的 ACP 桥见 docs/ops/planning/reader-ask/；桥好了以后宿主换成 WebSocket 那个端口。

import type { ContentBlock, SessionUpdate } from "@agentclientprotocol/sdk";
import type { ReaderAskHandlers, ReaderAskPort, ReaderAskSession, ReaderAskThread, ReaderAskThreadsPort } from "@retainpdf/reader/contracts";

import { mockAskConversations, mockAskMemories } from "./ask-conversations.js";

const AGENTS = [
  { id: "retainpdf", name: "RetainPDF 自带模型", description: "用设置里配好的模型", available: true, acceptsImages: true },
  { id: "claude-code", name: "Claude Code", description: "本机的 Claude Code（ACP）", available: true },
  { id: "codex", name: "Codex", description: "本机的 Codex（ACP）", available: false, reason: "演示模式：没有装 codex-acp", install: "npm install -g @agentclientprotocol/codex-acp" },
];

/** 演示回答里的互动块（OpenUI Lang）：拖滑块改迭代次数，看能量怎么收敛。测试里用组件库的解析器检查它没错（tests/ask/ask-openui.test.mjs）。 */
export const MOCK_OPENUI_BLOCK = String.raw`root = Col([title, formula, slider, chart, last], 3)
$n = 4
title = Title("迭代几次，能量就稳住了", "md")
formula = Math("E_k = E_\infty + (E_0 - E_\infty)\,2^{-k}")
slider = Slider($n, 1, 10, 1, "迭代次数")
rows = @Each(@Range(1, $n + 1), "k", {k: k, E: @Round(-1.13 + 0.4 * @Pow(0.5, k), 4)})
chart = Chart("line", rows, "k", ["E"], null, null, 180)
last = Caption("第 " + $n + " 次：E = " + rows[$n - 1].E + " Hartree")`;

const ANSWER = [
  "这一段说的是 **Hartree-Fock 近似**：把多电子波函数近似成一个 Slater 行列式，",
  "每个电子只感受其他电子的*平均*场。\n\n",
  "关键的式子是 Fock 方程：\n\n",
  "$$\n\\hat f(1)\\,\\chi_a(1) = \\varepsilon_a\\,\\chi_a(1)\n$$\n\n",
  "其中 Fock 算符 $\\hat f = \\hat h + \\sum_b (\\hat J_b - \\hat K_b)$，",
  "$\\hat J_b$ 是库仑算符，$\\hat K_b$ 是交换算符。\n\n",
  "1. 先猜一组轨道；\n2. 用它们算出 $\\hat f$；\n3. 解本征方程得到新轨道，重复直到自洽。\n\n",
  "书里第 2、3 页也用到这个近似（见 p. 4）。\n\n",
  "拖一下看迭代几次能量就稳住：\n\n",
  ...("```openui-lang\n" + MOCK_OPENUI_BLOCK + "\n```\n").split(/(?<=\n)/),
];

const THOUGHT = ["读者问的是这一块……", "先看这一页讲到哪了，", "再用最少的公式把意思讲清楚。"];

function wait(ms: number, signal: { cancelled: boolean }) {
  return new Promise<void>((resolve) => setTimeout(resolve, signal.cancelled ? 0 : ms));
}

function promptText(blocks: ContentBlock[]): string {
  return blocks.map((block) => (block.type === "text" ? block.text : "")).join("\n");
}

type FakeConfig = NonNullable<ReaderAskSession["configOptions"]>;

/** 演示用的设置项（照 ACP 的 configOptions）：模型、思考强度；Claude Code 再多一个模式。 */
function fakeConfig(agentId: string): FakeConfig {
  const options: FakeConfig = [
    {
      id: "model", name: "模型", category: "model", type: "select", currentValue: "haiku",
      options: [
        { value: "haiku", name: "Claude Haiku 5.5", description: "快、便宜" },
        { value: "sonnet", name: "Claude Sonnet 5.5", description: "均衡" },
        { value: "opus", name: "Claude Opus 5.5", description: "最强" },
      ],
    },
    {
      id: "effort", name: "思考强度", category: "thought_level", type: "select", currentValue: "medium",
      options: ["off", "low", "medium", "high", "max"].map((value) => ({ value, name: value })),
    },
  ];
  if (agentId === "claude-code") {
    options.push({ id: "mode", name: "模式", category: "mode", type: "select", currentValue: "default", options: [{ value: "default", name: "每次问" }, { value: "plan", name: "先出计划" }] });
  }
  return options;
}

function openFakeSession(agentId: string, handlers: ReaderAskHandlers): ReaderAskSession {
  let current = { cancelled: false };
  const send = (update: SessionUpdate) => {
    if (!current.cancelled) handlers.onUpdate(update);
  };
  let config = fakeConfig(agentId);
  let memories = 0;
  return {
    // 自带 agent 认结构化出处、自己取前文、有记忆工具（演示「已记住（撤销）」）。
    ...(agentId === "retainpdf" ? { capabilities: { selection: true, conversation: true, memory: true } } : {}),
    configOptions: config,
    async setConfigOption(configId, value) {
      config = config.map((option) => (option.id === configId ? { ...option, currentValue: value } : option));
      return config;
    },
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
      send({ sessionUpdate: "subagent_update", sessionId: "demo-sub", title: "查这一章的公式", description: "找式子的出处", state: { state: "running" } } as never);
      send({ sessionUpdate: "tool_call", toolCallId: "view-page", title: `看第 ${page} 页（原文）`, kind: "read", status: "in_progress", locations: [{ path: `第 ${page} 页` }] });
      await wait(500, signal);
      send({ sessionUpdate: "tool_call_update", toolCallId: "view-page", status: "completed", content: [{ type: "content", content: { type: "text", text: "（页图和这一页的原文、译文）" } }] });
      send({ sessionUpdate: "tool_call", toolCallId: "search", title: "在书里找「Fock」", kind: "search", status: "in_progress", rawInput: { query: "Fock" } });
      await wait(300, signal);
      send({ sessionUpdate: "tool_call_update", toolCallId: "search", status: "completed", content: [{ type: "content", content: { type: "text", text: "「Fock」3 处，第 2、3 页" } }] });
      if (agentId === "retainpdf") {
        // 记一条（照自带 agent：编号写进库以后才有，放在完成的 tool_call_update 的 _meta 上）。
        memories += 1;
        const text = `用户在读第 ${page} 页，关心 Hartree-Fock 的推导`;
        send({ sessionUpdate: "tool_call", toolCallId: `remember-${memories}`, title: `记住：${text}`, kind: "other", status: "in_progress" });
        await wait(200, signal);
        send({
          sessionUpdate: "tool_call_update", toolCallId: `remember-${memories}`, status: "completed",
          content: [{ type: "content", content: { type: "text", text: `已记住：${text}` } }],
          _meta: { retainpdf: { memory: { id: `mem-demo-${memories}`, scope: "book", text, category: "progress", document_id: null, created: true, replaced: null } } },
        } as never);
      }
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
      send({ sessionUpdate: "subagent_update", sessionId: "demo-sub", state: { state: "idle" } } as never);
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

// 问答记录存在内存里（刷新就没了），够演示「?」读回来、接着问。
const threads = new Map<string, ReaderAskThread>();
let threadSeq = 0;

const mockThreads: ReaderAskThreadsPort = {
  list: async () => [...threads.values()].map(({ messages: _messages, ...rest }) => rest),
  get: async (_documentId, threadId) => {
    const thread = threads.get(threadId);
    if (!thread) throw new Error("没有这次提问");
    return thread;
  },
  create: async (_documentId, input) => {
    threadSeq += 1;
    const thread: ReaderAskThread = {
      threadId: `demo-${threadSeq}`,
      agentId: input.agentId,
      title: input.messages.find((message) => message.role === "user")?.text.slice(0, 40) || "提问",
      anchor: input.anchor,
      messageCount: input.messages.length,
      updatedAt: new Date().toISOString(),
      messages: input.messages,
    };
    threads.set(thread.threadId, thread);
    return thread;
  },
  update: async (_documentId, threadId, input) => {
    const thread = threads.get(threadId);
    if (!thread) throw new Error("没有这次提问");
    const next = { ...thread, agentId: input.agentId || thread.agentId, messages: input.messages, messageCount: input.messages.length, updatedAt: new Date().toISOString() };
    threads.set(threadId, next);
    return next;
  },
  remove: async (_documentId, threadId) => {
    threads.delete(threadId);
  },
};

export const mockAskPort: ReaderAskPort = {
  listAgents: async () => AGENTS,
  openSession: async ({ agentId }, handlers) => openFakeSession(agentId, handlers),
  threads: mockThreads,
  conversations: mockAskConversations,
  memories: mockAskMemories,
};
