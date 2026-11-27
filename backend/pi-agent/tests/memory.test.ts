// 记忆和前文（extension/memory.ts，2026-11-26 第二期）：和 Python 版 retainpdf_ask_agent/memory.py 同一套工具说明、同一批请求。
// 后端是假的 HttpCall；接线（钩子、额度）用假的 pi 对象。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import retainpdfBook, { RoundGuard, sessionHasMessages } from "../extension/index.ts";
import {
  DISABLED_NOTE, historyText, makeMemoryTools, MEMORY_TOOL_SPECS, MEMORY_TOOLS, MemoryTools, REMEMBER_PER_TURN, SEARCH_PER_TURN, SUMMARY_HEADING,
} from "../extension/memory.ts";
import type { HttpCall } from "../extension/memory.ts";

const ASK_AGENT = join(dirname(fileURLToPath(import.meta.url)), "../../ask-agent");

type Call = { method: string; path: string; body: any };

function backend(options: { enabled?: boolean; memories?: any[]; summaries?: any[]; context?: any } = {}) {
  const calls: Call[] = [];
  const http: HttpCall = async (method, path, body) => {
    calls.push({ method, path, body });
    if (path === "/api/v1/ai/ask-settings") return { status: 200, json: { code: 0, data: { memory_enabled: options.enabled ?? true } } };
    if (method === "POST" && path === "/api/v1/ai/memories") {
      if (body.replaces === "mem-gone") return { status: 400, json: { message: "replaces not found" } };
      return { status: 200, json: { code: 0, data: { created: true, replaced: body.replaces ?? null, memory: { memory_id: "mem-1", ...body } } } };
    }
    if (method === "GET" && path.startsWith("/api/v1/ai/memories?")) {
      const params = new URLSearchParams(path.split("?")[1]);
      const scope = params.get("scope");
      const memories = (options.memories ?? []).filter((memory) => memory.scope === scope);
      const summaries = params.get("include_summaries") === "true" ? { summaries: options.summaries ?? [] } : {};
      return { status: 200, json: { code: 0, data: { memories, ...summaries } } };
    }
    if (path.startsWith("/api/v1/ai/ask-conversations/conv-1/context?")) {
      return options.context ? { status: 200, json: { code: 0, data: options.context } } : { status: 404, json: { message: "not found" } };
    }
    return { status: 404, json: null };
  };
  return { http, calls };
}

function fakePi() {
  const handlers = new Map<string, Array<(event: any, ctx?: any) => any>>();
  const tools: any[] = [];
  return {
    tools,
    on(name: string, handler: (event: any, ctx?: any) => any) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      return () => {};
    },
    registerTool(tool: any) {
      tools.push(tool);
    },
    async emit(name: string, event: any = {}, ctx?: any) {
      let result;
      for (const handler of handlers.get(name) ?? []) result = await handler(event, ctx);
      return result;
    },
  };
}

test("the tool descriptions and the disabled note are word for word the Python ones", (t) => {
  const python = spawnSync("python3", ["-c", [
    "import json",
    "from retainpdf_ask_agent.memory import TOOL_SPECS, DISABLED_NOTE, SUMMARY_HEADING",
    "print(json.dumps({'specs': TOOL_SPECS, 'note': DISABLED_NOTE, 'heading': SUMMARY_HEADING}, ensure_ascii=False))",
  ].join("\n")], { env: { ...process.env, PYTHONPATH: ASK_AGENT }, encoding: "utf8" });
  if (python.error || python.status !== 0) {
    t.skip(`python3 not usable: ${python.error ?? python.stderr}`);
    return;
  }
  const expected = JSON.parse(python.stdout);
  assert.deepEqual(MEMORY_TOOL_SPECS.map(({ name, description, parameters }) => ({ name, description, parameters })), expected.specs);
  assert.equal(DISABLED_NOTE, expected.note);
  assert.equal(SUMMARY_HEADING, expected.heading);
});

test("remember posts an agent memory with where it came from; book memories need the book", async () => {
  const { http, calls } = backend();
  const memory = new MemoryTools({ http, conversationId: "conv-1", documentId: "doc1", jobId: "job-1" });
  memory.page = 56;
  const done = await memory.run("remember", { text: " 用户要先看结论 ", scope: "user", category: "style" });
  assert.equal(done.isError, false);
  assert.equal(done.text, "记住了（mem-1）。");
  assert.equal(done.summary, "已记住：用户要先看结论");
  const post = calls.find((call) => call.method === "POST")!;
  assert.deepEqual(post.body, {
    scope: "user", category: "style", text: "用户要先看结论", origin: "agent", agent_id: "retainpdf-pi",
    source_conversation_id: "conv-1", source_job_id: "job-1", source_page: 56,
  });
  const book = await memory.run("remember", { text: "这本书把 exchange 译成交换", scope: "book", category: "term", replaces: "mem-0" });
  assert.equal(book.text, "记住了（mem-1）。旧的 mem-0 已标为被替代。");
  assert.equal(calls.filter((call) => call.method === "POST")[1].body.document_id, "doc1");

  const bookless = new MemoryTools({ http });
  assert.equal((await bookless.run("remember", { text: "这本书……", scope: "book" })).isError, true);
  for (const bad of [{ text: "", scope: "user" }, { text: "x", scope: "both" }, { text: "x", scope: "user", category: "mood" },
    { text: "字".repeat(501), scope: "user" }, { text: "x", scope: "user", replaces: "旧的那条" }]) {
    assert.equal((await memory.run("remember", bad)).isError, true, JSON.stringify(bad));
  }
  const failed = await memory.run("remember", { text: "x", scope: "user", replaces: "mem-gone" });
  assert.equal(failed.isError, true);
  assert.ok(failed.text.startsWith("没记上：HTTP 400"));
});

test("search looks in the user layer and this book, and says where each one is from", async () => {
  const { http, calls } = backend({ memories: [
    { memory_id: "mem-u", scope: "user", category: "style", text: "用户要先看结论", updated_at: "2026-11-20T10:00:00Z" },
    { memory_id: "mem-b", scope: "book", document_id: "doc1", category: "term", text: "exchange 译交换", updated_at: "2026-11-21T10:00:00Z" },
  ] });
  const memory = new MemoryTools({ http, documentId: "doc1" });
  const found = await memory.run("search_memories", { query: "结论 交换" });
  assert.equal(found.text, "- [mem-u] 2026-11-20 回答风格：用户要先看结论（关于用户）\n- [mem-b] 2026-11-21 术语：exchange 译交换（这本书）");
  assert.equal(found.summary, "找到 2 条");
  const book = calls.find((call) => call.path.includes("scope=book"))!;
  assert.ok(book.path.includes("document_id=doc1") && book.path.includes("limit=8"));
  // 不知道是哪本书时 all 只查用户层
  const { http: http2, calls: calls2 } = backend();
  assert.equal((await new MemoryTools({ http: http2 }).run("search_memories", { query: "无" })).text, "记忆里没有找到「无」。");
  assert.equal(calls2.filter((call) => call.path.startsWith("/api/v1/ai/memories?")).length, 1);
  assert.equal((await memory.run("search_memories", { query: " " })).isError, true);
});

test("search with scope all also lists conversation summaries, cut short", async () => {
  const { http, calls } = backend({ summaries: [
    { kind: "side", conversation_id: "conv-s", compaction_id: null, summary: "结论：交换项\n只在同自旋之间", created_at: "2026-11-21T09:00:00Z" },
    { kind: "compaction", conversation_id: "conv-1", compaction_id: "cmp-1", summary: "长".repeat(500), created_at: "2026-11-22T09:00:00Z" },
  ] });
  const memory = new MemoryTools({ http, documentId: "doc1" });
  const found = await memory.run("search_memories", { query: "交换项" });
  assert.equal(found.text, `- [副对话的结论] 2026-11-21：结论：交换项 只在同自旋之间\n- [以前对话的摘要] 2026-11-22：${"长".repeat(400)}……`);
  assert.equal(found.summary, "找到 0 条、2 份对话摘要");
  assert.equal(calls.filter((call) => call.path.includes("include_summaries=true")).length, 1);
  calls.length = 0;
  await memory.run("search_memories", { query: "交换项", scope: "book" });
  assert.ok(!calls.some((call) => call.path.includes("include_summaries")));
});

test("with memory turned off neither tool sends anything", async () => {
  const { http, calls } = backend({ enabled: false });
  const memory = new MemoryTools({ http, documentId: "doc1" });
  const refused = await memory.run("remember", { text: "x", scope: "user" });
  assert.equal(refused.isError, true);
  assert.ok(refused.text.includes("这次没有记"));
  assert.ok((await memory.run("search_memories", { query: "x" })).text.includes("这次没有查"));
  assert.deepEqual(calls.map((call) => call.path), ["/api/v1/ai/ask-settings", "/api/v1/ai/ask-settings"]);
});

test("the history text carries the summary, the parent's turns and the recent turns", () => {
  assert.equal(historyText(null), "");
  assert.equal(historyText({ messages: [] }), "");
  const text = historyText({
    summary: "用户在读第 3 章。",
    parent: { messages: [{ role: "user", text: "主对话里问的", page: 12 }] },
    messages: [{ role: "side_summary", text: "副对话：是平均场。" }, { role: "user", text: "那这里呢？", page: 56 }, { role: "assistant", text: "是交换项。" }],
  });
  assert.equal(text, "【之前对话的摘要】\n用户在读第 3 章。\n\n【我们之前的对话（最近几轮）】\n\n我（第 12 页）：主对话里问的\n\n（副对话的结论）副对话：是平均场。\n\n我（第 56 页）：那这里呢？\n\n你：是交换项。");
});

test("makeMemoryTools needs a backend address and key", () => {
  assert.equal(makeMemoryTools({}), null);
  assert.equal(makeMemoryTools({ RETAIN_ASK_BACKEND_URL: "http://127.0.0.1:1" }), null);
  assert.equal(makeMemoryTools({ RETAIN_ASK_BACKEND_URL: "file:///x", RETAIN_ASK_BACKEND_KEY: "k" }), null);
  const memory = makeMemoryTools({ RETAIN_ASK_BACKEND_URL: "http://127.0.0.1:1", RETAIN_ASK_BACKEND_KEY: "k", RETAIN_ASK_CONVERSATION_ID: "conv-1", RETAIN_ASK_DOCUMENT_ID: "../x" });
  assert.equal(memory?.conversationId, "conv-1");
  assert.equal(memory?.documentId, "");
});

test("without a book: the memory tools are there, history goes before the first question only, memory goes last in the system prompt", async () => {
  const { http, calls } = backend({ context: { summary: "之前聊了 Fock 算符。", messages: [], memory_text: "【RetainPDF 记下的关于用户的事】\n- [mem-u] 2026-11-20 回答风格：先看结论" } });
  const memory = new MemoryTools({ http, conversationId: "conv-1", jobId: "job-1" });
  const pi = fakePi();
  retainpdfBook(pi, null, null, memory);
  assert.deepEqual(pi.tools.map((tool) => tool.name), MEMORY_TOOLS);

  await pi.emit("session_start", { reason: "startup" });
  const question = "这一块的原文：…\n\n（RetainPDF 任务 job-1，块 p056-b0002，第 56 页）";
  const first = await pi.emit("input", { text: question, source: "interactive" }, { sessionManager: { getEntries: () => [] } });
  assert.equal(first.action, "transform");
  assert.ok(first.text.startsWith("【之前对话的摘要】\n之前聊了 Fock 算符。\n\n"));
  assert.ok(first.text.endsWith(question));
  assert.equal(memory.page, 56);
  const second = await pi.emit("input", { text: "接着呢？", source: "interactive" });
  assert.deepEqual(second, { action: "continue" });
  assert.equal(memory.page, null);
  // 上下文只取一次
  assert.equal(calls.filter((call) => call.path.includes("/context?")).length, 1);
  assert.ok(calls.find((call) => call.path.includes("/context?"))!.path.includes("recent_turns=6"));

  const sections: Record<string, string> = { base: "……" };
  await pi.emit("before_agent_start", { systemPromptOptions: { sections } });
  assert.deepEqual(Object.keys(sections), ["base", "memory"]);
  assert.ok(sections.memory.includes("先看结论"));
});

test("a resumed pi session does not get the history again", async () => {
  const { http } = backend({ context: { summary: "之前的。", messages: [], memory_text: "" } });
  const pi = fakePi();
  retainpdfBook(pi, null, null, new MemoryTools({ http, conversationId: "conv-1" }));
  const resumed = { sessionManager: { getEntries: () => [{ type: "session_info" }, { type: "message", message: { role: "user" } }] } };
  assert.equal(sessionHasMessages(resumed), true);
  assert.equal(sessionHasMessages({ sessionManager: { getEntries: () => { throw new Error("x"); } } }), false);
  assert.deepEqual(await pi.emit("input", { text: "问", source: "interactive" }, resumed), { action: "continue" });
});

test("remember and search have their own per-question budget", () => {
  const guard = new RoundGuard(MEMORY_TOOLS);
  guard.startRun();
  guard.startTurn();
  for (let i = 0; i < REMEMBER_PER_TURN; i += 1) {
    if (i === 2) guard.startTurn(); // 一轮最多 4 个工具，换一轮接着记
    assert.equal(guard.check("remember"), undefined);
  }
  assert.equal(guard.check("remember")?.block, true);
  for (let i = 0; i < SEARCH_PER_TURN; i += 1) assert.equal(guard.check("search_memories"), undefined);
  guard.startTurn();
  assert.equal(guard.check("search_memories")?.block, true);
  guard.startRun();
  guard.startTurn();
  assert.equal(guard.check("remember"), undefined);
});
