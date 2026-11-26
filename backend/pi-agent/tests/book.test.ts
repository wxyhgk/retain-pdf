// 读书的工具（book.ts）：和 Python 版 backend/ask-agent/tests/test_tools.py 同一套书、同一批断言，两边改要一起改。
// 后端是假的（换掉 httpGet，或一个本机 HTTP 服务）。跑法：node --test backend/pi-agent/tests/
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import { BookTools, makeBookTools, splitPrompt } from "../extension/book.ts";
import type { HttpGet, HttpReply } from "../extension/book.ts";

type Item = Record<string, unknown>;

function item(itemId: string, page: number, source: string, translated: string | null = null,
  options: { subType?: string; level?: number; group?: string; own?: string; translatedPage?: number } = {}): Item {
  const value: Item = {
    item_id: itemId, source: { page, text: source }, translated: { page: options.translatedPage ?? page, text: translated },
    region_type: "text", status: translated ? "translated" : "source_only", sub_type: options.subType ?? "body",
  };
  if (options.level !== undefined) value.heading_level = options.level;
  if (options.group) value.continuation_group_id = options.group;
  if (options.own) value.translated_block_text = options.own;
  return value;
}

const ITEMS = [
  item("p001-b0000", 1, "Quantum Chemistry", "量子化学", { subType: "title", level: 1 }),
  item("p001-b0001", 1, "Page header", null, { subType: "header" }),
  item("p002-b0000", 2, "1 The Schrodinger Equation", "1 薛定谔方程", { subType: "heading", level: 2 }),
  item("p002-b0001", 2, "The Hamiltonian operator is Hermitian.", "哈密顿算符是厄米的。"),
  item("p002-b0002", 2, "It has real eigenvalues and", "它有实的本征值，并且本征函数正交。", { group: "g1", own: "它有实的本征值，并且" }),
  item("p002-b0003", 2, "E = mc^2", null, { subType: "display_formula" }),
  item("p003-b0000", 3, "orthogonal eigenfunctions.", "它有实的本征值，并且本征函数正交。", { group: "g1" }),
  item("p003-b0001", 3, "1.1 Time dependence", "1.1 含时", { subType: "heading", level: 3 }),
  item("p003-b0002", 3, "2", null, { subType: "page_number" }),
  item("p005-b0000", 5, "Last words.", "结语。"),
];

// 前端（ask-context.ts 的 anchorPreamble）附在第一问前面的出处
const ANCHOR_WITH_TEXT = "我在读一本书，第 2 页（译文栏）。\n\n这一块的原文：\nThe Hamiltonian operator is Hermitian.\n\n（RetainPDF 任务 job-1，块 p002-b0001，第 2 页）";
const ANCHOR_NO_TEXT = "我在读一本书，第 4 页（原文栏）。\n\n这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。\n\n（RetainPDF 任务 job-1，第 4 页）";
const JPEG = Buffer.from("\xff\xd8\xff fake jpeg", "latin1");

const json = (status: number, value: unknown): HttpReply => ({ status, contentType: "application/json", body: Buffer.from(JSON.stringify(value)) });

function tools(items: Item[] = ITEMS, options: { documentId?: string; pages?: Record<string, HttpReply> } = {}) {
  const calls: string[] = [];
  const httpGet: HttpGet = async (path) => {
    calls.push(path);
    if (path.endsWith("/reader/regions")) return json(200, { code: 0, data: { items } });
    for (const [prefix, reply] of Object.entries(options.pages ?? {})) if (path.startsWith(prefix)) return reply;
    return json(404, { code: 404, message: "not found" });
  };
  return { book: new BookTools({ jobId: "job-1", documentId: options.documentId ?? "doc1", httpGet }), calls };
}

test("which questions carry text", () => {
  const { book } = tools();
  assert.ok(book.carriesText([ANCHOR_WITH_TEXT, "这句译得对吗？"]));
  assert.ok(book.carriesText(["我选中的这段：\nHermitian", "什么意思"]));
  assert.ok(!book.carriesText([ANCHOR_NO_TEXT, "这页讲什么"]));
  assert.ok(!book.carriesText(["第 5 页讲了什么？"]));
});

test("pi-acp joins the prompt blocks; the anchor line splits them again", () => {
  assert.deepEqual(splitPrompt(`${ANCHOR_WITH_TEXT}和第 5 页一样吗？`), [ANCHOR_WITH_TEXT, "和第 5 页一样吗？"]);
  assert.deepEqual(splitPrompt("全书讲什么？"), ["全书讲什么？"]);
});

test("background for a question with text is small", async () => {
  const { book, calls } = tools();
  const context = await book.background([ANCHOR_WITH_TEXT, "这句译得对吗？"]);
  assert.ok(context);
  // 所在的节、同页前后各一块；提问那一块前端已经附了，不重复
  assert.ok(context.text.includes("所在的节：1 The Schrodinger Equation（第 2 页）"));
  assert.ok(context.text.includes("[p002-b0000]") && context.text.includes("[p002-b0002]"));
  assert.ok(!context.text.includes("[p002-b0001]") && !context.text.includes("[p002-b0003]"));
  assert.deepEqual(context.images, []);
  assert.equal(context.info.item_id, "p002-b0001");
  // 问题里写了别的页：那一页也带上
  const other = await book.background([ANCHOR_WITH_TEXT, "和第 5 页的说法一样吗？"]);
  assert.ok(other && other.text.includes("第 5 页（问题里说到的）") && other.text.includes("结语。"));
  assert.deepEqual(calls, ["/api/v1/jobs/job-1/reader/regions"]);
});

test("background gives up when the book cannot be read", async () => {
  const book = new BookTools({ jobId: "job-1", httpGet: async () => { throw new Error("connection refused"); } });
  assert.equal(await book.background([ANCHOR_WITH_TEXT, "问"]), null);
});

test("prefetch for a question without text", async () => {
  const { book, calls } = tools(ITEMS, { pages: { "/api/v1/documents/doc1/files/pages/4.jpg": { status: 200, contentType: "image/jpeg", body: JPEG } } });
  // 问题里写了第 5 页：取那一页
  const page = await book.prefetch(["第 5 页讲了什么？"]);
  assert.ok(page && page.text.includes("第 5 页（问题里说到的）") && page.text.includes("结语。"));
  assert.deepEqual(page.info.pages, [5]);
  // 点在没有文字层的页上：代码取页图，不让模型调 view_page
  const scanned = await book.prefetch([ANCHOR_NO_TEXT, "这页讲什么"]);
  assert.ok(scanned);
  assert.deepEqual(scanned.images, [{ mimeType: "image/jpeg", data: JPEG.toString("base64") }]);
  assert.deepEqual(scanned.info.images, [4]);
  assert.equal(calls[calls.length - 1], "/api/v1/documents/doc1/files/pages/4.jpg?width=1000");
  // 没有位置、也没写页码：不取，靠目录和工具
  assert.equal(await book.prefetch(["全书讲什么？"]), null);
  const overview = await book.overview();
  assert.equal(overview.split("\n")[0], "用户正在读的书共 5 页（页码是原文 PDF 的页码）。");
  assert.ok(overview.includes("- Quantum Chemistry ｜ 量子化学 —— 第 1 页"));
  assert.ok(overview.includes("  - 1 The Schrodinger Equation ｜ 1 薛定谔方程 —— 第 2 页"));
  assert.ok(overview.includes("    - 1.1 Time dependence ｜ 1.1 含时 —— 第 3 页"));
});

test("read_pages reads several pages at once", async () => {
  const { book } = tools();
  const result = await book.run("read_pages", { pages: [2, 3] });
  assert.ok(!result.isError);
  assert.equal(result.summary, "第 2 页 4 块，第 3 页 2 块");
  assert.ok(result.text.includes("=== 第 2 页（4 块）===") && result.text.includes("[p002-b0001] 正文"));
  assert.ok(result.text.includes("原文：The Hamiltonian operator is Hermitian.") && result.text.includes("译文：哈密顿算符是厄米的。"));
  assert.ok(result.text.includes("[p002-b0003] 公式") && result.text.includes("标题（2 级）"));
  // 跨页的段落：本块有自己那份译文就用自己的；页眉页码不算
  assert.ok(result.text.includes("译文：它有实的本征值，并且\n") && !result.text.includes("[p003-b0002]"));
  assert.ok(!(await book.run("read_pages", { pages: [3], side: "translated" })).text.includes("原文："));
  // 旧写法（一页）也认
  assert.equal((await book.run("read_page", { page: 2 })).summary, "第 2 页 4 块");
});

test("tool errors go back to the model", async () => {
  const { book } = tools();
  assert.ok((await book.run("read_pages", { pages: [9] })).text.includes("1–5"));
  assert.ok((await book.run("read_pages", { pages: [0] })).isError);
  assert.ok((await book.run("read_pages", { pages: [1, 2, 3, 4, 5, 6] })).isError);
  assert.ok((await book.run("read_pages", {})).isError);
  assert.ok((await book.run("outline", {})).isError);
  const empty = tools([]).book;
  assert.ok((await empty.run("read_pages", { pages: [1] })).text.includes("还没有识别出文字"));
});

test("search hits carry the section and the whole block", async () => {
  const { book } = tools();
  const result = await book.run("search_book", { query: "hermitian" });
  assert.ok(result.text.includes("第 2 页，1 The Schrodinger Equation [p002-b0001] 正文"));
  assert.ok(result.text.includes("原文：The Hamiltonian operator is Hermitian.") && result.text.includes("译文：哈密顿算符是厄米的。"));
  assert.equal(result.summary, "「hermitian」1 处，1 页");
  // 跨块的段落按整段的译文找
  const both = await book.run("search_book", { query: "本征 正交" });
  assert.ok(both.text.includes("[p002-b0002]") && both.text.includes("[p003-b0000]"));
  assert.ok((await book.run("search_book", { query: "Dirac" })).text.includes("没找到"));
  assert.ok((await book.run("search_book", { query: "  " })).isError);
  const limited = await book.run("search_book", { query: "的", limit: 1 });
  assert.ok(limited.text.includes("列前 1 处") && limited.text.includes("全部命中的页"));
});

test("view_page fetches the source or translated page image", async () => {
  const items = [item("p001-b0000", 5, "x", "y", { translatedPage: 2 })];
  const { book, calls } = tools(items, {
    pages: {
      "/api/v1/documents/doc1/files/pages/5.jpg": { status: 200, contentType: "image/jpeg", body: JPEG },
      "/api/v1/jobs/job-1/files/pages/2.jpg": json(409, { message: "page not ready", error: { details: { reason: "not_ready" } } }),
    },
  });
  const source = await book.run("view_page", { page: 5 });
  assert.ok(!source.isError);
  assert.deepEqual(source.images, [{ mimeType: "image/jpeg", data: JPEG.toString("base64") }]);
  assert.equal(calls[calls.length - 1], "/api/v1/documents/doc1/files/pages/5.jpg?width=1000");
  // 译文页按任务自己的页号取
  const translated = await book.run("view_page", { page: 5, side: "translated" });
  assert.ok(translated.isError && translated.text.includes("还没排好"));
  assert.ok(calls[calls.length - 1].startsWith("/api/v1/jobs/job-1/files/pages/2.jpg"));
  // 不知道书编号：原文页取不到，看任务的页
  const noDoc = tools(items, { documentId: "" });
  assert.ok((await noDoc.book.run("view_page", { page: 5 })).isError);
  assert.ok(noDoc.calls[noDoc.calls.length - 1].startsWith("/api/v1/jobs/job-1/files/pages/2.jpg"));
});

test("real http sends the key and reports a backend that is down", async () => {
  const seen: Array<[string, string | undefined]> = [];
  const server = createServer((request, response) => {
    seen.push([request.url ?? "", request.headers["x-api-key"] as string | undefined]);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: 0, data: { items: ITEMS } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    const book = makeBookTools({ jobId: "merged-doc-abc", documentId: "doc", baseUrl: base, apiKey: "agent-key" });
    assert.ok(book);
    assert.ok((await book.run("read_pages", { pages: [2] })).text.includes("哈密顿算符"));
    assert.deepEqual(seen, [["/api/v1/jobs/merged-doc-abc/reader/regions", "agent-key"]]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const down = makeBookTools({ jobId: "job-1", baseUrl: base, apiKey: "k" });
  assert.ok(down);
  const result = await down.run("search_book", { query: "x" });
  assert.ok(result.isError && result.text.includes("连不上"));
  assert.equal(await down.overview(), "");
  // 没有书、地址不对：不给工具
  assert.equal(makeBookTools({ jobId: "", baseUrl: base, apiKey: "k" }), null);
  assert.equal(makeBookTools({ jobId: "job/../x", baseUrl: base, apiKey: "k" }), null);
  assert.equal(makeBookTools({ jobId: "job-1", baseUrl: "ftp://x", apiKey: "k" }), null);
});
