/** 提问窗（@retainpdf/ask）的 ACP 这一层：session/update → 回答的各部分、用量和速度、许可、和 assistant-ui 的适配、问答记录的格式。
 * 都是纯函数或假端口，不起浏览器。 */
import test from "node:test";
import assert from "node:assert/strict";

import { applySessionUpdate, closeOpenReasoning, emptyTurn, turnFooter, turnSpeed, usageFromMeta } from "../../../packages/ask/src/acp/parts.ts";
import { PermissionStore, createAcpChatAdapter, imageBlocks } from "../../../packages/ask/src/acp/adapter.ts";
import { historyText, toInitialMessages, toStoredMessages } from "../../../packages/ask/src/acp/messages.ts";

const text = (sessionUpdate, value) => ({ sessionUpdate, content: { type: "text", text: value } });

/** 宿主给的出处（阅读页拼的那段字，见 packages/reader/src/ask/ask-context.ts）。 */
const PREAMBLE = "我在读一本书，第 56 页（译文栏）。";
const SELECTION = { page: 56, pane: "translated", item_ids: ["p056-b0003"] };
const CONTEXT = { page: 56, label: "第 56 页", preamble: PREAMBLE, meta: { retainpdf: { selection: SELECTION } } };

test("正文、思考：同类相邻的接着拼，中间插了别的新起一段；记首字、末字时间和字数", () => {
  let turn = emptyTurn(0);
  turn = applySessionUpdate(turn, text("agent_thought_chunk", "先看"), 100);
  turn = applySessionUpdate(turn, text("agent_thought_chunk", "这一页"), 150);
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call", toolCallId: "t1", title: "看第 3 页", kind: "read", status: "in_progress" }, 200);
  turn = applySessionUpdate(turn, text("agent_message_chunk", "答"), 300);
  turn = applySessionUpdate(turn, text("agent_message_chunk", "案"), 400);
  assert.deepEqual(turn.parts.map((part) => part.type), ["reasoning", "tool-call", "text"]);
  assert.equal(turn.parts[0].text, "先看这一页");
  assert.equal(turn.parts[2].text, "答案");
  assert.equal(turn.firstTokenAt, 100);
  assert.equal(turn.lastTokenAt, 400);
  assert.equal(turn.chars, 7);
  assert.equal(turn.chunks, 4);
});

test("工具调用按 toolCallId 合并：状态、输出、位置跟着更新，失败标 isError", () => {
  let turn = emptyTurn(0);
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call", toolCallId: "t1", title: "看第 3 页", kind: "read", status: "pending", rawInput: { page: 3 } }, 1);
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed", locations: [{ path: "book.pdf", line: 3 }], content: [{ type: "content", content: { type: "text", text: "页图" } }] }, 2);
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call", toolCallId: "t2", title: "写笔记", kind: "edit" }, 3);
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call_update", toolCallId: "t2", status: "failed" }, 4);
  assert.equal(turn.parts.length, 2);
  const [first, second] = turn.parts;
  assert.equal(first.toolName, "read");
  assert.deepEqual(first.args, { page: 3 });
  assert.deepEqual(first.artifact, { title: "看第 3 页", kind: "read", status: "completed", locations: ["book.pdf:3"], output: "页图" });
  assert.equal(second.isError, true);
});

test("计划整份替换、留在原处；子 agent 按 sessionId 合并；不认识的更新忽略", () => {
  let turn = emptyTurn(0);
  turn = applySessionUpdate(turn, { sessionUpdate: "plan", entries: [{ content: "a", priority: "high", status: "in_progress" }] }, 1);
  turn = applySessionUpdate(turn, text("agent_message_chunk", "x"), 2);
  turn = applySessionUpdate(turn, { sessionUpdate: "plan", entries: [{ content: "a", priority: "high", status: "completed" }, { content: "b", priority: "low", status: "pending" }] }, 3);
  turn = applySessionUpdate(turn, { sessionUpdate: "subagent_update", sessionId: "s1", title: "查文献", state: { state: "running" } }, 4);
  turn = applySessionUpdate(turn, { sessionUpdate: "subagent_update", sessionId: "s1", state: { state: "idle" } }, 5);
  turn = applySessionUpdate(turn, { sessionUpdate: "available_commands_update", availableCommands: [] }, 6);
  assert.deepEqual(turn.parts.map((part) => part.name || part.type), ["plan", "text", "subagent"]);
  assert.equal(turn.parts[0].data.entries.length, 2);
  assert.deepEqual(turn.parts[2].data, { id: "s1", title: "查文献", description: "", state: "idle" });
});

test("用量：ACP 的 used / size / cost，加上 _meta.retainpdf.usage（自带 agent）或 _meta.usage 的分项；几种写法都认", () => {
  assert.deepEqual(usageFromMeta({ retainpdf: { usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 8 } } }), { inputTokens: 10, outputTokens: 5, cachedInputTokens: 8 });
  assert.deepEqual(usageFromMeta({ usage: { input_tokens: 3, output_tokens: 2, cache_read_input_tokens: 1, reasoning_tokens: 4 } }), { inputTokens: 3, outputTokens: 2, cachedInputTokens: 1, reasoningTokens: 4 });
  assert.deepEqual(usageFromMeta(null), {});
  // 自带 agent 的写法（后端 feat/ask-agent，11-25）。
  assert.deepEqual(
    usageFromMeta({ retainpdf: { usage: { model: "claude-haiku-5-5", input_tokens: 900, output_tokens: 40, cache_read_tokens: 800, cache_write_tokens: 100, elapsed_ms: 1200 } } }),
    { inputTokens: 900, outputTokens: 40, cachedInputTokens: 800, cacheWriteTokens: 100, model: "claude-haiku-5-5" },
  );
  const withModel = applySessionUpdate(emptyTurn(0), { sessionUpdate: "usage_update", used: 940, size: 200000, _meta: { retainpdf: { usage: { model: "claude-haiku-5-5", input_tokens: 900, output_tokens: 40, cache_read_tokens: 800, cache_write_tokens: 100 } } } }, 1);
  assert.equal(turnFooter(withModel, null, "RetainPDF 自带模型"), "RetainPDF 自带模型（claude-haiku-5-5） · 输入 900 · 输出 40 token · 缓存命中 800 · 写入缓存 100 · 上下文 0%");
  let turn = emptyTurn(0);
  turn = applySessionUpdate(turn, text("agent_message_chunk", "x".repeat(50)), 1000);
  turn = applySessionUpdate(turn, text("agent_message_chunk", "y".repeat(50)), 3000);
  assert.equal(turnSpeed(turn), null, "只来了两段（整段发来的 agent）：不算速度");
  for (let index = 0; index < 3; index += 1) turn = applySessionUpdate(turn, text("agent_message_chunk", ""), 3000);
  turn = { ...turn, chunks: 5 };
  assert.deepEqual(turnSpeed(turn), { value: 50, unit: "字/s" }, "没有 token 数按字数估");
  turn = applySessionUpdate(turn, { sessionUpdate: "usage_update", used: 50000, size: 200000, cost: { amount: 0.0123, currency: "USD" }, _meta: { retainpdf: { usage: { inputTokens: 4000, outputTokens: 120, cachedInputTokens: 3500 } } } }, 3100);
  assert.deepEqual(turnSpeed(turn), { value: 60, unit: "token/s" });
  assert.equal(
    turnFooter(turn, 3500, "RetainPDF 自带模型"),
    "RetainPDF 自带模型 · 输入 4000 · 输出 120 token · 缓存命中 3500 · 上下文 25% · 0.0123 USD · 60 token/s · 首字 1.0s · 用时 3.5s",
  );
  assert.equal(turnSpeed({ ...emptyTurn(0), firstTokenAt: 1, lastTokenAt: 100, chars: 9, chunks: 9 }), null, "不到 0.3 秒不算速度");
});

test("许可：等用户点；关窗 / 停下时没回的都按取消回掉", async () => {
  const store = new PermissionStore();
  let changes = 0;
  store.subscribe(() => (changes += 1));
  const request = { sessionId: "s", toolCall: { toolCallId: "t1" }, options: [{ optionId: "ok", name: "允许", kind: "allow_once" }] };
  const answer = store.add(request);
  assert.equal(store.get("t1").request, request);
  store.get("t1").resolve({ outcome: { outcome: "selected", optionId: "ok" } });
  assert.deepEqual(await answer, { outcome: { outcome: "selected", optionId: "ok" } });
  assert.equal(store.get("t1"), undefined);
  const later = store.add({ ...request, toolCall: { toolCallId: "t2" } });
  store.cancelAll();
  assert.deepEqual(await later, { outcome: { outcome: "cancelled" } });
  assert.ok(changes >= 4);
});

test("和 assistant-ui 的适配：带了出处的那一问前面写那段字、_meta 放结构化出处（发出去宿主就清掉）；边收边吐；停的原因 → 状态；换 agent 重开会话、带上之前几轮", async () => {
  const prompts = [];
  const metas = [];
  const opened = [];
  const port = {
    listAgents: async () => [],
    openSession: async ({ agentId }, handlers) => {
      opened.push(agentId);
      return {
        prompt: async (blocks, meta) => {
          prompts.push(blocks);
          metas.push(meta);
          handlers.onUpdate(text("agent_message_chunk", "好"));
          await new Promise((resolve) => setTimeout(resolve, 5));
          handlers.onUpdate(text("agent_message_chunk", "的"));
          return { stopReason: "end_turn" };
        },
        cancel() {},
        close() {},
      };
    },
  };
  let agentId = "retainpdf";
  let clock = 0;
  let pending = CONTEXT;
  const asked = [];
  const chat = createAcpChatAdapter({
    port,
    permissions: new PermissionStore(),
    getAgentId: () => agentId,
    getContext: () => pending,
    onAsked: (id, context) => {
      asked.push([id, context?.label ?? null]);
      pending = null;
    },
    now: () => (clock += 100),
  });
  // 像 assistant-ui 那样：每次把到这一问为止的整段对话传进来。
  const history = [];
  const ask = async (question) => {
    history.push({ id: `u${history.length}`, role: "user", content: [{ type: "text", text: question }] });
    const results = [];
    for await (const result of chat.adapter.run({ messages: [...history], abortSignal: new AbortController().signal })) results.push(result);
    history.push({ role: "assistant", content: results.at(-1).content, metadata: { custom: {} } });
    return results;
  };
  const first = await ask("这是什么？");
  assert.equal(prompts[0].length, 2, "第一句：出处 + 问题");
  assert.match(prompts[0][0].text, /第 56 页/);
  assert.equal(prompts[0][1].text, "这是什么？");
  assert.equal(first.at(-1).content[0].text, "好的");
  assert.deepEqual(first.at(-1).status, { type: "complete", reason: "stop" });
  assert.ok(first.at(-1).metadata.timing.totalStreamTime > 0);
  assert.deepEqual(metas[0], { retainpdf: { selection: SELECTION } }, "结构化出处放进 session/prompt 的 _meta");
  assert.deepEqual(chat.lastRun().context, CONTEXT, "这一轮用的出处交给宿主存");
  await ask("再说一遍");
  assert.equal(prompts[1].length, 1, "追问不再带出处（宿主清掉了）");
  assert.equal(metas[1], undefined);
  assert.deepEqual(asked, [["u0", "第 56 页"], ["u2", null]], "每条问题第一次发时交出它带的出处");
  agentId = "claude-code";
  await ask("换个 agent");
  assert.deepEqual(opened, ["retainpdf", "claude-code"]);
  assert.equal(prompts[2].length, 2, "换了 agent：新会话，之前几轮带一次");
  assert.match(prompts[2][0].text, /我：这是什么？/);
});

test("agent 报了能力：认结构化出处就不写那段字；自己取前文就不拼之前几轮；宿主给了前文（上下文接口）用它；重新回答照用那一问的出处；这一轮记下的记忆交出去", async () => {
  const prompts = [];
  const metas = [];
  let capabilities = { selection: true, conversation: true };
  const port = {
    listAgents: async () => [],
    conversationPreamble: async () => "【记忆和前文】",
    openSession: async (_o, handlers) => ({
      capabilities,
      sessionId: "s",
      prompt: async (blocks, meta) => {
        prompts.push(blocks);
        metas.push(meta);
        handlers.onUpdate({ sessionUpdate: "tool_call", toolCallId: "r1", title: "记住：要先看结论", kind: "other", status: "in_progress" });
        handlers.onUpdate({ sessionUpdate: "tool_call_update", toolCallId: "r1", status: "completed", _meta: { retainpdf: { memory: { id: "mem-1", scope: "user", text: "要先看结论", created: true } } } });
        handlers.onUpdate({ sessionUpdate: "tool_call", toolCallId: "r2", title: "记住：旧的", kind: "other", status: "in_progress" });
        handlers.onUpdate({ sessionUpdate: "tool_call_update", toolCallId: "r2", status: "completed", _meta: { retainpdf: { memory: { id: "mem-0", scope: "user", text: "旧的", created: false } } } });
        handlers.onUpdate(text("agent_message_chunk", "答"));
        return { stopReason: "end_turn" };
      },
      cancel() {},
      close() {},
    }),
  };
  let pending = CONTEXT;
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "retainpdf", getContext: () => pending, onAsked: () => { pending = null; } });
  const run = async (messages) => { for await (const _ of chat.adapter.run({ messages, abortSignal: new AbortController().signal })) { /* 收完 */ } };
  const q = { id: "q1", role: "user", content: [{ type: "text", text: "这句什么意思？" }] };
  await run([q]);
  assert.deepEqual(prompts[0].map((block) => block.text), ["这句什么意思？"], "自带 agent 认出处、自己取前文：只发问题");
  assert.deepEqual(metas[0], CONTEXT.meta);
  assert.deepEqual(chat.lastRun().memoryIds, ["mem-1"], "只算新记的");
  assert.ok(chat.lastRun().startedAt > 0, "这一轮开始的时刻（宿主查事后记的记忆用）");
  // 重新回答：会话重开，出处照用那一问的（宿主早清掉了）。
  capabilities = {};
  await run([q]);
  assert.deepEqual(prompts[1].map((block) => block.text), ["【记忆和前文】", PREAMBLE, "这句什么意思？"], "本机 agent：宿主给的前文 + 出处那段字 + 问题");
  assert.deepEqual(metas[1], CONTEXT.meta);
});

test("问答记录：assistant-ui 的对话 → 存的问答（问题 / 回答 + 思考 + 用量和用时）；读回来交给 initialMessages，底下一行照样有用量", () => {
  const turn = { ...emptyTurn(100), firstTokenAt: 1100, lastTokenAt: 2100, usage: { inputTokens: 900, outputTokens: 40, model: "claude-haiku-5-5" } };
  const stored = toStoredMessages([
    { role: "user", content: [{ type: "text", text: "这是什么？" }] },
    { role: "assistant", content: [{ type: "reasoning", text: "先看" }, { type: "reasoning", text: "这一页" }, { type: "text", text: "是哈密顿量。" }], metadata: { custom: { turn, endedAt: 3100 } } },
    { role: "assistant", content: [], metadata: { custom: {} } },
    { role: "system", content: [{ type: "text", text: "忽略" }] },
  ]);
  assert.deepEqual(stored, [
    { role: "user", text: "这是什么？" },
    { role: "assistant", text: "是哈密顿量。", thought: "先看这一页", usage: { inputTokens: 900, outputTokens: 40, model: "claude-haiku-5-5", elapsedMs: 3000, firstTokenMs: 1000 } },
  ]);
  const initial = toInitialMessages(stored);
  assert.deepEqual(initial[0], { role: "user", content: "这是什么？" });
  assert.deepEqual(initial[1].content, [{ type: "reasoning", text: "先看这一页" }, { type: "text", text: "是哈密顿量。" }]);
  const { turn: restored, endedAt } = initial[1].metadata.custom;
  assert.equal(turnFooter(restored, endedAt, "RetainPDF 自带模型"), "RetainPDF 自带模型（claude-haiku-5-5） · 输入 900 · 输出 40 token · 首字 1.0s · 用时 3.0s");
});

test("新会话的第一问带上之前几轮（重新打开、换 agent、断线以后）；没有就不带；太长从前面截", async () => {
  assert.equal(historyText([]), "");
  const earlier = [
    { role: "user", content: [{ type: "text", text: "Q1" }] },
    { role: "assistant", content: [{ type: "text", text: "A1" }], metadata: { custom: {} } },
  ];
  assert.equal(historyText(earlier), "之前我们在这一处聊过（接着聊）：\n\n我：Q1\n\n你：A1");
  const long = Array.from({ length: 30 }, (_, index) => ({ role: "user", content: [{ type: "text", text: `问题${index}`.repeat(200) }] }));
  const text = historyText(long);
  assert.ok(text.length < 8100);
  assert.ok(!text.includes("问题0"), "只带最近几条");

  const prompts = [];
  const port = { listAgents: async () => [], openSession: async (_o, handlers) => ({ prompt: async (blocks) => { prompts.push(blocks); handlers.onUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "好" } }); return { stopReason: "end_turn" }; }, cancel() {}, close() {} }) };
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "a", getContext: () => CONTEXT });
  for await (const _ of chat.adapter.run({ messages: [...earlier, { role: "user", content: [{ type: "text", text: "Q2" }] }], abortSignal: new AbortController().signal })) { /* 收完 */ }
  assert.equal(prompts[0].length, 3, "之前的对话 + 出处 + 问题");
  assert.match(prompts[0][0].text, /我：Q1\n\n你：A1/);
  assert.equal(prompts[0][1].text, PREAMBLE);
  assert.equal(prompts[0][2].text, "Q2");
});

test("Claude Code 的用量：模型在 _meta[\"_claude/model\"]，分项 token 在 session/prompt 结果的 usage 里（cachedReadTokens / cachedWriteTokens），合进这一轮", async () => {
  assert.deepEqual(usageFromMeta({ "_claude/model": "claude-opus-5-5" }), { model: "claude-opus-5-5" });
  assert.deepEqual(usageFromMeta({ usage: { inputTokens: 2, outputTokens: 11, cachedReadTokens: 11727, cachedWriteTokens: 21448 } }), { inputTokens: 2, outputTokens: 11, cachedInputTokens: 11727, cacheWriteTokens: 21448 });
  const port = { listAgents: async () => [], openSession: async (_o, handlers) => ({
    prompt: async () => {
      handlers.onUpdate({ sessionUpdate: "usage_update", used: 33185, size: 1000000, _meta: { "_claude/model": "claude-opus-5-5" } });
      handlers.onUpdate(text("agent_message_chunk", "1+1 等于 2"));
      return { stopReason: "end_turn", usage: { inputTokens: 2, outputTokens: 11, cachedReadTokens: 11727, cachedWriteTokens: 21448 } };
    },
    cancel() {}, close() {},
  }) };
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "claude-code", getContext: () => null });
  let last;
  for await (const result of chat.adapter.run({ messages: [{ role: "user", content: [{ type: "text", text: "1+1？" }] }], abortSignal: new AbortController().signal })) last = result;
  const { turn } = last.metadata.custom;
  assert.deepEqual(turn.usage, { contextUsed: 33185, contextSize: 1000000, model: "claude-opus-5-5", inputTokens: 2, outputTokens: 11, cachedInputTokens: 11727, cacheWriteTokens: 21448 });
  assert.match(turnFooter(turn, null, "Claude Code"), /^Claude Code（claude-opus-5-5） · 输入 2 · 输出 11 token · 缓存命中 11727 · 写入缓存 21448 · 上下文 3%/);
});

test("重新回答（最后一问再答一次）：ACP 会话重开、第一问带上之前几轮", async () => {
  const prompts = [];
  let opened = 0;
  const port = { listAgents: async () => [], openSession: async (_o, handlers) => { opened += 1; return { prompt: async (blocks) => { prompts.push(blocks); handlers.onUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "答" } }); return { stopReason: "end_turn" }; }, cancel() {}, close() {} }; } };
  const chat = createAcpChatAdapter({ port, permissions: new PermissionStore(), getAgentId: () => "a", getContext: () => null });
  const run = async (messages) => { for await (const _ of chat.adapter.run({ messages, abortSignal: new AbortController().signal })) { /* 收完 */ } };
  const u = (t) => ({ role: "user", content: [{ type: "text", text: t }] });
  const a = (t) => ({ role: "assistant", content: [{ type: "text", text: t }], metadata: { custom: {} } });
  await run([u("Q1")]);
  await run([u("Q1"), a("A1"), u("Q2")]);
  assert.equal(opened, 1, "正常往下问：同一个会话");
  await run([u("Q1"), a("A1"), u("Q2")]);
  assert.equal(opened, 2, "重新回答 Q2：会话重开");
  assert.match(prompts[2].map((block) => block.text).join("\n"), /我：Q1\n\n你：A1/, "带上之前几轮");
});

test("贴的图片 → ACP 的 image 块：消息里的和附件里的都认，不是 data URL 的不发", () => {
  const blocks = imageBlocks({
    role: "user",
    content: [{ type: "text", text: "这张图" }, { type: "image", image: "data:image/png;base64,AAAA" }],
    attachments: [{ content: [{ type: "image", image: "data:image/jpeg;base64,BBBB" }, { type: "image", image: "https://x/y.png" }] }],
  });
  assert.deepEqual(blocks, [{ type: "image", mimeType: "image/png", data: "AAAA" }, { type: "image", mimeType: "image/jpeg", data: "BBBB" }]);
  assert.deepEqual(imageBlocks(undefined), []);
});

test("起止时刻（思考写「思考（N 秒）」、工具调用写用时）：思考从第一段起，来了别的内容就收；工具调用完成或失败时收；一轮答完没收的统一收", () => {
  let turn = emptyTurn(0);
  turn = applySessionUpdate(turn, text("agent_thought_chunk", "想"), 1, 1000);
  turn = applySessionUpdate(turn, text("agent_thought_chunk", "想"), 2, 2000);
  assert.deepEqual(turn.parts[0].timing, { startedAt: 1000 });
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call", toolCallId: "t", title: "看", status: "in_progress" }, 3, 4000);
  assert.deepEqual(turn.parts[0].timing, { startedAt: 1000, completedAt: 4000 }, "来了工具调用：思考收了");
  assert.deepEqual(turn.parts[1].timing, { startedAt: 4000 });
  turn = applySessionUpdate(turn, { sessionUpdate: "tool_call_update", toolCallId: "t", status: "completed" }, 4, 6500);
  assert.deepEqual(turn.parts[1].timing, { startedAt: 4000, completedAt: 6500 });
  turn = applySessionUpdate(turn, text("agent_thought_chunk", "再想"), 5, 7000);
  assert.deepEqual(closeOpenReasoning(turn.parts, 9000)[2].timing, { startedAt: 7000, completedAt: 9000 });
});

test("改一条已发出的问 / 重新回答：落在已有位置上的问先交给宿主（后端作废它和之后的），会话重开，照用原来的出处；宿主报错就不问", async () => {
  const prompts = [];
  let opened = 0;
  const port = { listAgents: async () => [], openSession: async (_o, handlers) => { opened += 1; return { prompt: async (blocks, meta) => { prompts.push({ blocks, meta }); handlers.onUpdate(text("agent_message_chunk", "答")); return { stopReason: "end_turn" }; }, cancel() {}, close() {} }; } };
  const rewrites = [];
  let refuse = false;
  const chat = createAcpChatAdapter({
    port,
    permissions: new PermissionStore(),
    getAgentId: () => "a",
    getContext: () => null,
    initialIds: ["msg-1", "msg-2"],
    onRewrite: async (id) => {
      rewrites.push(id);
      if (refuse) throw new Error("对话结束了");
      return id === "msg-1" ? CONTEXT : null;
    },
  });
  const runAll = async (messages) => { const out = []; for await (const result of chat.adapter.run({ messages, abortSignal: new AbortController().signal })) out.push(result); return out; };
  const u = (id, t) => ({ id, role: "user", content: [{ type: "text", text: t }] });
  const a = (id, t) => ({ id, role: "assistant", content: [{ type: "text", text: t }], metadata: { custom: {} } });
  // 往下接着问：不算改。
  await runAll([u("msg-1", "Q1"), a("msg-2", "A1"), u("u3", "Q2")]);
  assert.deepEqual(rewrites, []);
  assert.equal(chat.lastRun().editedFrom, undefined);
  // 改了第一问（新编号落在 0 号位）：交出原来那条，照用它的出处，会话重开。
  await runAll([u("u9", "Q1 改过")]);
  assert.deepEqual(rewrites, ["msg-1"]);
  assert.equal(opened, 2);
  assert.deepEqual(prompts.at(-1).meta, CONTEXT.meta, "照用原来那一问的出处");
  assert.deepEqual([chat.lastRun().questionId, chat.lastRun().editedFrom], ["u9", "msg-1"]);
  // 重新回答（同一条问）：也算改，交出它自己。
  await runAll([u("u9", "Q1 改过")]);
  assert.deepEqual(rewrites, ["msg-1", "u9"]);
  assert.equal(chat.lastRun().editedFrom, "u9");
  // 宿主作废不了：不问，错误写在回答的位置。
  refuse = true;
  const before = prompts.length;
  const out = await runAll([u("u9", "Q1 改过")]);
  assert.equal(prompts.length, before);
  assert.match(out.at(-1).content[0].text, /改不了这一问：对话结束了/);
});
