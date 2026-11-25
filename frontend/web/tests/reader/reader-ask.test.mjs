/** 阅读页提问（ACP）：session/update → 回答的各部分、用量和速度、出处、许可、和 assistant-ui 的适配、右键菜单、? 快捷键。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applySessionUpdate, closeOpenReasoning, emptyTurn, turnFooter, turnSpeed, usageFromMeta } from "../../../packages/reader/src/ask/acp-parts.ts";
import { PermissionStore, anchorPromptBlocks, createAcpChatAdapter, imageBlocks } from "../../../packages/reader/src/ask/acp-adapter.ts";
import { buildAskAnchor, nearestRegion, sectionForPage } from "../../../packages/reader/src/ask/anchor.ts";
import { normalizeReaderMetadata, normalizeReaderRegions } from "../../../packages/reader/src/shared/data/reader-regions.ts";
import { historyText, toInitialMessages, toStoredMessages } from "../../../packages/reader/src/ask/thread-messages.ts";

const text = (sessionUpdate, value) => ({ sessionUpdate, content: { type: "text", text: value } });

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

const ANCHOR = { pane: "translated", page: 56, itemId: "p056-b0003", selection: "", sourceText: "H = -Σ ∇²/2", translatedText: "哈密顿量", section: "2.1 电子问题", point: { x: 0.2, y: 0.4 } };

test("出处：第一句前面带第几页、哪一节、原文译文、任务号和块号；没认出字就说可能是扫描页", () => {
  const [block] = anchorPromptBlocks(ANCHOR, "job-1", "现代量子化学");
  assert.equal(block.type, "text");
  assert.match(block.text, /我在读《现代量子化学》，第 56 页，「2\.1 电子问题」（译文栏）/);
  assert.match(block.text, /这一块的原文：\nH = -Σ/);
  assert.match(block.text, /任务 job-1，块 p056-b0003，第 56 页/);
  const [bare] = anchorPromptBlocks({ ...ANCHOR, itemId: null, sourceText: "", translatedText: "" }, "job-1");
  assert.match(bare.text, /没有认出文字/);
});

test("拼出处：页、栏、页内位置、悬停认出的块、章节（书签优先，没有就前面最近的标题）", () => {
  const regions = [
    { itemId: "h1", headingLevel: 1, source: { page: 50, text: "第 2 章 多电子" }, translated: { text: "" }, markdown: "" },
    { itemId: "p056-b0003", source: { page: 56, text: "原文" }, translated: { text: "译文" }, markdown: "", translatedBlockText: "整块译文" },
  ];
  const pageElement = {
    getAttribute: (name) => ({ "data-reader-page": "56", "data-reader-pane": "source" })[name] ?? null,
    getBoundingClientRect: () => ({ left: 100, top: 0, width: 400, height: 600 }),
  };
  const anchor = buildAskAnchor({ pageElement, clientX: 200, clientY: 150, itemId: "p056-b0003", selection: "选的字", regions, bookmarks: [] });
  assert.deepEqual(anchor, { pane: "source", page: 56, itemId: "p056-b0003", selection: "选的字", sourceText: "原文", translatedText: "整块译文", section: "第 2 章 多电子", point: { x: 0.25, y: 0.25 } });
  const bookmarks = [{ id: "0", title: "Chapter 2", page: 40, level: 1, children: [] }];
  assert.equal(sectionForPage(bookmarks, regions, 56), "Chapter 2");
  assert.equal(buildAskAnchor({ pageElement: null, clientX: 0, clientY: 0, itemId: null, selection: "", regions, bookmarks }), null);
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

test("和 assistant-ui 的适配：第一句带出处、之后不带；边收边吐；停的原因 → 状态；换 agent 重开会话、出处再带", async () => {
  const prompts = [];
  const opened = [];
  const port = {
    listAgents: async () => [],
    openSession: async ({ agentId }, handlers) => {
      opened.push(agentId);
      return {
        prompt: async (blocks) => {
          prompts.push(blocks);
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
  const chat = createAcpChatAdapter({ port, jobId: "job-1", permissions: new PermissionStore(), getAgentId: () => agentId, getAnchor: () => ANCHOR, now: () => (clock += 100) });
  // 像 assistant-ui 那样：每次把到这一问为止的整段对话传进来。
  const history = [];
  const ask = async (question) => {
    history.push({ role: "user", content: [{ type: "text", text: question }] });
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
  await ask("再说一遍");
  assert.equal(prompts[1].length, 1, "追问不再带出处");
  agentId = "claude-code";
  await ask("换个 agent");
  assert.deepEqual(opened, ["retainpdf", "claude-code"]);
  assert.equal(prompts[2].length, 3, "换了 agent：新会话，出处和之前几轮再带一次");
});

test("接线：宿主不给端口就没有提问入口；? 只在选着书页上的字时拦（不然照旧是快捷键帮助）；提问窗单独一块、用到才加载", () => {
  const app = readFileSync(new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8");
  assert.match(app, /actions=\{askPort && menuAsk \?/);
  assert.match(app, /\{askPort && ask \? \(/);
  assert.match(app, /if \(!picked\.text \|\| !picked\.element \|\| !picked\.rect\) return;/);
  assert.match(app, /window\.addEventListener\("keydown", onKey, true\)/);
  assert.match(app, /lazy\(\(\) => import\("\.\/ask\/ReaderAskWindow\.js"\)\)/);
  const host = readFileSync(new URL("../../src/features/reader/domain/ask-port.ts", import.meta.url), "utf8");
  assert.match(host, /if \(isMockMode\(\)\) return mockAskPort;/, "演示模式给假 agent");
  assert.match(host, /if \(isLanSharedPage\(\)\) return null;/, "局域网共享的页面不给（网关拦了 \/api\/v1\/ai）");
  const vite = readFileSync(new URL("../../../packages/reader/vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /@assistant-ui\\\/\[\^\/\]\+\|react-rnd/, "开源库不打进阅读器 dist");
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
  const chat = createAcpChatAdapter({ port, jobId: "j", permissions: new PermissionStore(), getAgentId: () => "a", getAnchor: () => ANCHOR });
  for await (const _ of chat.adapter.run({ messages: [...earlier, { role: "user", content: [{ type: "text", text: "Q2" }] }], abortSignal: new AbortController().signal })) { /* 收完 */ }
  assert.equal(prompts[0].length, 3, "出处 + 之前的对话 + 问题");
  assert.match(prompts[0][1].text, /我：Q1\n\n你：A1/);
  assert.equal(prompts[0][2].text, "Q2");
});

test("问答记录接线：读回问过的地方、每答完一轮存、一句没问就关不留「?」、能删", () => {
  const hook = readFileSync(new URL("../../../packages/reader/src/ask/use-ask-threads.ts", import.meta.url), "utf8");
  assert.match(hook, /threads\.list\(documentId\)/);
  assert.match(hook, /threads\.create\(documentId, \{ agentId, anchor: mark\.anchor, messages \}\)/);
  assert.match(hook, /threads\.update\(documentId, mark\.threadId, \{ agentId, messages \}\)/);
  assert.match(hook, /if \(mark && !mark\.threadId\) setMarks/);
  const windowSource = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskWindow.tsx", import.meta.url), "utf8");
  assert.match(windowSource, /if \(wasRunning && !state\.isRunning\)/, "答完一轮才存");
  assert.match(windowSource, /useLocalRuntime\(chat\.adapter as never, \{ initialMessages: initial as never, adapters: \{ attachments \} \}\)/);
});

test("悬停还没认出块（鼠标刚移过来、点在两段之间）：按位置找同一页最近的块，太远（超过页高 15%）不算", () => {
  const box = (bbox) => ({ page: 5, bbox, text: "t" });
  const regions = normalizeReaderRegions({ items: [
    { item_id: "top", source: box([50, 100, 550, 200]), translated: box([50, 100, 550, 200]) },
    { item_id: "mid", source: box([50, 400, 550, 500]), translated: box([50, 400, 550, 500]) },
    { item_id: "other-page", source: { page: 6, bbox: [50, 400, 550, 500], text: "x" }, translated: { page: 6, bbox: [50, 400, 550, 500], text: "x" } },
  ] });
  const doc = { pages: [5, 6].map((page) => ({ page, width: 600, height: 1000 })) };
  const metadata = normalizeReaderMetadata({ source: doc, translated: doc });
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.45 })?.itemId, "mid", "点在块里");
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.3 })?.itemId, "top", "两段之间取近的");
  assert.equal(nearestRegion(regions, metadata, "source", 5, { x: 0.5, y: 0.9 }), null, "离最近的块也太远");
  const pageElement = { getAttribute: (name) => ({ "data-reader-page": "5", "data-reader-pane": "translated" })[name] ?? null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 1000 }) };
  const anchor = buildAskAnchor({ pageElement, clientX: 300, clientY: 300, itemId: null, selection: "", regions, bookmarks: [], metadata });
  assert.equal(anchor.itemId, "top");
  assert.equal(anchor.sourceText, "t");
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
  const chat = createAcpChatAdapter({ port, jobId: "j", permissions: new PermissionStore(), getAgentId: () => "claude-code", getAnchor: () => null });
  let last;
  for await (const result of chat.adapter.run({ messages: [{ role: "user", content: [{ type: "text", text: "1+1？" }] }], abortSignal: new AbortController().signal })) last = result;
  const { turn } = last.metadata.custom;
  assert.deepEqual(turn.usage, { contextUsed: 33185, contextSize: 1000000, model: "claude-opus-5-5", inputTokens: 2, outputTokens: 11, cachedInputTokens: 11727, cacheWriteTokens: 21448 });
  assert.match(turnFooter(turn, null, "Claude Code"), /^Claude Code（claude-opus-5-5） · 输入 2 · 输出 11 token · 缓存命中 11727 · 写入缓存 21448 · 上下文 3%/);
});

test("整套照搬 assistant-ui 的 Thread：只往里塞工具调用、数据块、等待指示、用量那一行；重新回答 / 改问题时 ACP 会话重开", () => {
  const windowSource = readFileSync(new URL("../../../packages/reader/src/ask/ReaderAskWindow.tsx", import.meta.url), "utf8");
  assert.match(windowSource, /<Thread components=\{threadComponents\} autoFocus \/>/);
  assert.match(windowSource, /makeAssistantDataUI\(\{ name: "plan"/);
  const adapter = readFileSync(new URL("../../../packages/reader/src/ask/acp-adapter.ts", import.meta.url), "utf8");
  assert.match(adapter, /if \(session && lastIndex !== sessionSeen\)/);
});

test("重新回答（最后一问再答一次）：ACP 会话重开、第一问带上之前几轮", async () => {
  const prompts = [];
  let opened = 0;
  const port = { listAgents: async () => [], openSession: async (_o, handlers) => { opened += 1; return { prompt: async (blocks) => { prompts.push(blocks); handlers.onUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "答" } }); return { stopReason: "end_turn" }; }, cancel() {}, close() {} }; } };
  const chat = createAcpChatAdapter({ port, jobId: "j", permissions: new PermissionStore(), getAgentId: () => "a", getAnchor: () => null });
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
