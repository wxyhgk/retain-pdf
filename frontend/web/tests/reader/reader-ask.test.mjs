/** 阅读页提问（ACP）：session/update → 回答的各部分、用量和速度、出处、许可、和 assistant-ui 的适配、右键菜单、? 快捷键。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applySessionUpdate, emptyTurn, turnFooter, turnSpeed, usageFromMeta } from "../../../packages/reader/src/ask/acp-parts.ts";
import { PermissionStore, anchorPromptBlocks, createAcpChatAdapter } from "../../../packages/reader/src/ask/acp-adapter.ts";
import { buildAskAnchor, sectionForPage } from "../../../packages/reader/src/ask/anchor.ts";
import { normalizeMathDelimiters } from "../../../packages/reader/src/ask/math-delimiters.ts";

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
  assert.deepEqual(turnSpeed(turn), { value: 50, unit: "字/s" }, "没有 token 数按字数估");
  turn = applySessionUpdate(turn, { sessionUpdate: "usage_update", used: 50000, size: 200000, cost: { amount: 0.0123, currency: "USD" }, _meta: { retainpdf: { usage: { inputTokens: 4000, outputTokens: 120, cachedInputTokens: 3500 } } } }, 3100);
  assert.deepEqual(turnSpeed(turn), { value: 60, unit: "token/s" });
  assert.equal(
    turnFooter(turn, 3500, "RetainPDF 自带模型"),
    "RetainPDF 自带模型 · 输入 4000 · 输出 120 token · 缓存命中 3500 · 上下文 25% · 0.0123 USD · 60 token/s · 首字 1.0s · 用时 3.5s",
  );
  assert.equal(turnSpeed({ ...emptyTurn(0), firstTokenAt: 1, lastTokenAt: 100, chars: 9 }), null, "不到 0.3 秒不算速度");
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
  const ask = async (question) => {
    const results = [];
    for await (const result of chat.adapter.run({ messages: [{ role: "user", content: [{ type: "text", text: question }] }], abortSignal: new AbortController().signal })) results.push(result);
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
  assert.equal(prompts[2].length, 2, "换了 agent：新会话，出处再带一次");
});

test("公式分隔符：\\( \\) → $，\\[ \\] → $$；代码块里的不动", () => {
  assert.equal(normalizeMathDelimiters("设 \\(x^2\\)，则\n\\[a=b\\]"), "设 $x^2$，则\n$$a=b$$");
  assert.equal(normalizeMathDelimiters("```\n\\(x\\)\n```"), "```\n\\(x\\)\n```");
});

test("接线：宿主不给端口就没有提问入口；? 只在选着书页上的字时拦（不然照旧是快捷键帮助）；提问窗单独一块、用到才加载", () => {
  const app = readFileSync(new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8");
  assert.match(app, /actions=\{askPort && menuAsk \?/);
  assert.match(app, /\{askPort && ask \? \(/);
  assert.match(app, /if \(!picked\.text \|\| !picked\.element \|\| !picked\.rect\) return;/);
  assert.match(app, /window\.addEventListener\("keydown", onKey, true\)/);
  assert.match(app, /lazy\(\(\) => import\("\.\/ask\/ReaderAskWindow\.js"\)\)/);
  const host = readFileSync(new URL("../../src/features/reader/domain/ask-port.ts", import.meta.url), "utf8");
  assert.match(host, /isMockMode\(\) \? mockAskPort : null/, "后端桥没合之前正式环境不给端口");
  const vite = readFileSync(new URL("../../../packages/reader/vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /@assistant-ui\\\/\[\^\/\]\+\|streamdown/, "开源库不打进阅读器 dist");
});
