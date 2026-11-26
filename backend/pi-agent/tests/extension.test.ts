// pi 扩展的接线（extension/index.ts）：用假的 pi 对象看它注册了什么、钩子做了什么。真起 pi 的在 pi-acp.test.ts。
import assert from "node:assert/strict";
import { test } from "node:test";

import { BookTools } from "../extension/book.ts";
import type { HttpGet } from "../extension/book.ts";
import retainpdfBook, { BOOK_TOOLS, MAX_TOOL_CALLS_PER_ROUND, MAX_TOOL_ROUNDS, prepareArguments, RoundGuard } from "../extension/index.ts";

const ITEMS = [
  { item_id: "p001-b0000", source: { page: 1, text: "Quantum Chemistry" }, translated: { page: 1, text: "量子化学" }, sub_type: "title", heading_level: 1 },
  { item_id: "p002-b0000", source: { page: 2, text: "The Hamiltonian is Hermitian." }, translated: { page: 2, text: "哈密顿量是厄米的。" }, sub_type: "body" },
  { item_id: "p002-b0001", source: { page: 2, text: "Next block." }, translated: { page: 2, text: "下一块。" }, sub_type: "body" },
];

function fakePi() {
  const handlers = new Map<string, Array<(event: any) => any>>();
  const tools: any[] = [];
  return {
    tools,
    on(name: string, handler: (event: any) => any) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      return () => {};
    },
    registerTool(tool: any) {
      tools.push(tool);
    },
    async emit(name: string, event: any = {}) {
      let result;
      for (const handler of handlers.get(name) ?? []) result = await handler(event);
      return result;
    },
    has(name: string) {
      return (handlers.get(name) ?? []).length > 0;
    },
  };
}

function book() {
  const httpGet: HttpGet = async (path) => ({
    status: path.endsWith("/reader/regions") ? 200 : 404,
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({ code: 0, data: { items: ITEMS } })),
  });
  return new BookTools({ jobId: "job-1", documentId: "doc1", httpGet });
}

test("with a book: three read-only tools, context first, the book in the system prompt", async () => {
  const pi = fakePi();
  retainpdfBook(pi, book());
  assert.deepEqual(pi.tools.map((tool) => tool.name), BOOK_TOOLS);
  for (const tool of pi.tools) assert.equal(tool.parameters.type, "object");

  const read = pi.tools.find((tool) => tool.name === "read_pages");
  const result = await read.execute("call-1", { pages: [2] });
  assert.equal(result.content[0].type, "text");
  assert.ok(result.content[0].text.includes("哈密顿量是厄米的。"));
  assert.equal(result.isError, undefined);
  const failed = await read.execute("call-2", { pages: [9] });
  assert.equal(failed.isError, true);

  // 带字的问题：背景放在问题前面（pi-acp 把几段字接成一串）
  const anchor = "我在读一本书，第 2 页（原文栏）。\n\n这一块的原文：\nThe Hamiltonian is Hermitian.\n\n（RetainPDF 任务 job-1，块 p002-b0000，第 2 页）";
  const transformed = await pi.emit("input", { text: `${anchor}这句什么意思？`, source: "rpc" });
  assert.equal(transformed.action, "transform");
  assert.ok(transformed.text.startsWith("【RetainPDF 从书里取的背景"));
  assert.ok(transformed.text.endsWith(`${anchor}这句什么意思？`));
  assert.ok(transformed.text.includes("[p002-b0001]"));
  // 认不出位置、没写页码：原样
  assert.deepEqual(await pi.emit("input", { text: "全书讲什么？", source: "rpc" }), { action: "continue" });

  const event = { systemPromptOptions: { sections: {} as Record<string, string> } };
  await pi.emit("before_agent_start", event);
  assert.ok(event.systemPromptOptions.sections.book.startsWith("用户正在读的书共 2 页"));
});

test("without a book: no tools, but the lock is still there", async () => {
  const pi = fakePi();
  retainpdfBook(pi, null);
  assert.deepEqual(pi.tools, []);
  assert.ok(!pi.has("input"));
  const blocked = await pi.emit("tool_call", { toolName: "bash" });
  assert.equal(blocked.block, true);
});

test("only the book tools run, and runaway tool loops are capped", () => {
  const guard = new RoundGuard();
  for (const name of ["bash", "read", "edit", "write", "mcp__x__y"]) assert.equal(guard.check(name)?.block, true, name);
  guard.startRun();
  guard.startTurn();
  for (let call = 0; call < MAX_TOOL_CALLS_PER_ROUND; call += 1) assert.equal(guard.check("read_pages"), undefined);
  assert.ok(guard.check("search_book")?.reason.includes(`一轮最多调 ${MAX_TOOL_CALLS_PER_ROUND} 个`));
  for (let round = 1; round < MAX_TOOL_ROUNDS; round += 1) guard.startTurn();
  assert.equal(guard.check("read_pages"), undefined);
  guard.startTurn();
  const over = guard.check("read_pages");
  assert.ok(over?.block && !over.terminate && over.reason.includes(`最多调 ${MAX_TOOL_ROUNDS} 轮`));
  guard.startTurn();
  guard.startTurn();
  assert.equal(guard.check("read_pages")?.terminate, true);
  // 下一问重新算
  guard.startRun();
  guard.startTurn();
  assert.equal(guard.check("read_pages"), undefined);
});

test("loose arguments are fixed before validation", () => {
  assert.deepEqual(prepareArguments("read_pages", { page: "5" }), { pages: [5] });
  assert.deepEqual(prepareArguments("read_pages", { pages: ["2", 3], side: "source" }), { pages: [2, 3], side: "source" });
  assert.deepEqual(prepareArguments("view_page", { page: " 7 " }), { page: 7 });
  assert.deepEqual(prepareArguments("search_book", { query: "x", limit: "3" }), { query: "x", limit: 3 });
  assert.deepEqual(prepareArguments("search_book", null), {});
});
