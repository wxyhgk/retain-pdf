// 放在笔记（Studio）里：消息格式对得上契约、只认 window.parent 和本机回环地址、握手后才认别的、
// 跟着换亮暗不写本机设置、跳页带着 embed、悬停框握手后才有「摘到笔记」。
// 契约 contracts/studio-bridge.v1.schema.json；方案 docs/ops/planning/studio-workbench/20261101-书和笔记接在一起.md。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { makeDom } from "../helpers/dom.mjs";
import {
  isLoopbackOrigin,
  parseStudioMessage,
  quoteMessage,
  readyMessage,
} from "../../src/platform/studio-bridge/protocol.ts";
import { startStudioEmbed, studioNotesQuote, themeForStudio } from "../../src/app/bootstrap/studio-embed.ts";
import { carryEmbed } from "../../src/platform/navigation/pages.ts";
import { embeddedIn, trySoftOpenReader } from "../../../../frontend/packages/reader/src/shared/navigation/soft-reader.ts";
import {
  projectReaderTextHoverTargets,
  readerNotesQuoteOf,
  ReaderTextHoverLayer,
} from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";
import { normalizeReaderRegions } from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";
import { setReaderAdapters } from "../../../../frontend/packages/reader/src/adapters.ts";

const CONTRACT = JSON.parse(readFileSync(new URL("../../../../contracts/studio-bridge.v1.schema.json", import.meta.url), "utf8"));
const STUDIO = "http://127.0.0.1:5173";
const hello = (theme = "light") => ({ protocol: "retainpdf-studio-bridge", v: 1, type: "hello", theme });

/** 发出去的消息键对得上契约：必填都在、没有契约外的键。 */
function assertMatchesContract(message, definition) {
  const schema = CONTRACT.definitions[definition];
  for (const key of schema.required) assert.ok(key in message, `${definition} 缺 ${key}`);
  for (const key of Object.keys(message)) assert.ok(key in schema.properties, `${definition} 多了 ${key}`);
}

test("只认本机回环地址上的 http 页面（任意端口）", () => {
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:40001", "http://[::1]:3000", "http://localhost"]) {
    assert.equal(isLoopbackOrigin(origin), true, origin);
  }
  for (const origin of ["https://localhost:5173", "http://example.com", "http://127.0.0.2", "http://localhost.evil.com", "null", ""]) {
    assert.equal(isLoopbackOrigin(origin), false, origin);
  }
});

test("认契约里 Studio 发的三种消息；protocol / v / type / 必填不对的当没收到", () => {
  assert.deepEqual(parseStudioMessage(hello("dark")), { type: "hello", theme: "dark" });
  assert.deepEqual(parseStudioMessage({ ...hello(), type: "theme", theme: "light" }), { type: "theme", theme: "light" });
  assert.deepEqual(
    parseStudioMessage({ protocol: "retainpdf-studio-bridge", v: 1, type: "navigate", job_id: "j1", page_idx: 7, block_id: "p008-b0009" }),
    { type: "navigate", jobId: "j1", pageIdx: 7, blockId: "p008-b0009" },
  );
  assert.deepEqual(
    parseStudioMessage({ protocol: "retainpdf-studio-bridge", v: 1, type: "navigate", job_id: "j1", page_idx: -1 }),
    { type: "navigate", jobId: "j1", pageIdx: null, blockId: "" },
  );
  assert.equal(parseStudioMessage({ ...hello(), protocol: "other" }), null);
  assert.equal(parseStudioMessage({ ...hello(), v: 2 }), null);
  assert.equal(parseStudioMessage({ ...hello(), theme: "sepia" }), null);
  assert.equal(parseStudioMessage({ ...hello(), type: "ready" }), null, "ready 是我们发的，不认");
  assert.equal(parseStudioMessage({ protocol: "retainpdf-studio-bridge", v: 1, type: "navigate" }), null);
  assert.equal(parseStudioMessage("hello"), null);
  assert.equal(parseStudioMessage({ ...hello(), extra: 1 })?.type, "hello", "多出来的键不管（以后只加可选字段）");
});

test("发出去的 ready、quote 对得上契约", () => {
  const ready = readyMessage(["theme", "navigate", "quote"]);
  assertMatchesContract(ready, "ReadyMessage");
  const quote = quoteMessage({
    jobId: "j1", documentId: "", title: null, itemId: "p001-b0003", pageIdx: 0, sourceText: "a", translatedText: null,
  });
  assertMatchesContract(quote, "QuoteMessage");
  assert.equal(quote.document_id, null, "空的书编号写 null（契约 minLength 1）");
});

test("Studio 的亮暗落到我们的主题：本机主题亮暗对得上就用它", () => {
  assert.equal(themeForStudio("dark", "classic"), "night");
  assert.equal(themeForStudio("dark", "night"), "night");
  assert.equal(themeForStudio("light", "night"), "classic");
  assert.equal(themeForStudio("light", "jiangnan"), "jiangnan");
});

function fakeWindow(dom, search = "?embed=studio") {
  const listeners = new Map();
  const sent = [];
  const parent = { postMessage: (data, origin) => sent.push({ data, origin }) };
  const win = {
    location: { search },
    parent,
    document: dom.window.document,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };
  const receive = (data, { source = parent, origin = STUDIO } = {}) => listeners.get("message")?.({ data, source, origin });
  return { win, parent, sent, receive, listeners };
}

test("不在 Studio 里（没有 embed=studio，或没有父窗口）什么都不做", () => {
  const dom = makeDom();
  const plain = fakeWindow(dom, "");
  assert.equal(startStudioEmbed(plain.win), null);
  const top = fakeWindow(dom);
  top.win.parent = top.win;
  assert.equal(startStudioEmbed(top.win), null);
  assert.equal(dom.window.document.documentElement.dataset.embed, undefined);
});

test("握手：只认父窗口、本机回环地址；回 ready 指定那个 origin；之前的 theme / navigate / quote 都不算", () => {
  const dom = makeDom();
  const navigations = [];
  const fake = fakeWindow(dom);
  const embed = startStudioEmbed(fake.win, { navigate: (url) => navigations.push(url) });
  assert.equal(dom.window.document.documentElement.dataset.embed, "studio");

  fake.receive({ ...hello(), type: "navigate", job_id: "j1" });
  assert.deepEqual(navigations, [], "没握手不跳");
  assert.equal(embed.sendQuote({ jobId: "j1", itemId: "p001-b0003", pageIdx: 0, sourceText: "a", translatedText: null }), false);

  fake.receive(hello(), { source: {} });
  fake.receive(hello(), { origin: "http://example.com" });
  assert.equal(embed.ready(), false, "别的窗口、别的地址发来的 hello 不认");
  assert.equal(fake.sent.length, 0);

  fake.receive(hello("dark"));
  assert.equal(embed.ready(), true);
  assert.deepEqual(fake.sent, [{ data: readyMessage(["theme", "navigate", "quote"]), origin: STUDIO }]);
  assert.equal(dom.window.document.documentElement.dataset.theme, "night", "按 hello 的 theme 换颜色");

  fake.receive({ protocol: "retainpdf-studio-bridge", v: 1, type: "navigate", job_id: "j1" }, { origin: "http://localhost:9999" });
  assert.deepEqual(navigations, [], "握手之后只认握手的那个 origin");
  fake.receive({ protocol: "retainpdf-studio-bridge", v: 1, type: "navigate", job_id: "j 1", page_idx: 7, block_id: "p008-b0009" });
  assert.equal(navigations.length, 1);
  assert.match(navigations[0], /reader\.html\?job_id=j\+1&page_idx=7&block_id=p008-b0009/);

  assert.equal(embed.sendQuote({ jobId: "j1", documentId: "d1", title: "书", itemId: "p001-b0003", pageIdx: 0, sourceText: "a", translatedText: "甲" }), true);
  const last = fake.sent.at(-1);
  assert.equal(last.origin, STUDIO, "不用 '*'");
  assert.equal(last.data.type, "quote");
  embed.stop();
});

test("跟着 Studio 换亮暗不写本机存的主题；阅读页自己晚一步 boot 主题也会被换回来", () => {
  const dom = makeDom("", { keys: ["window", "document", "CustomEvent", "Event", "localStorage"] });
  dom.window.localStorage.setItem("retainpdf.theme", "classic");
  const fake = fakeWindow(dom);
  // 主题事件走真的 window：把 window 上的监听接到假窗口的表里。
  fake.win.addEventListener = (type, fn) => { fake.listeners.set(type, fn); dom.window.addEventListener(type, fn); };
  const embed = startStudioEmbed(fake.win);
  fake.receive(hello("dark"));
  assert.equal(dom.window.document.documentElement.dataset.theme, "night");
  assert.equal(dom.window.localStorage.getItem("retainpdf.theme"), "classic", "不改本机存的设置");
  dom.window.dispatchEvent(new dom.window.CustomEvent("retainpdf:theme-change", { detail: { theme: "classic" } }));
  assert.equal(dom.window.document.documentElement.dataset.theme, "night", "别处换回本机主题时再换成 Studio 的");
  embed.stop();
});

test("「摘到笔记」交给阅读器包：握过手、知道任务才能摘；书和书名按任务查一次", async () => {
  const dom = makeDom();
  const fake = fakeWindow(dom);
  const embed = startStudioEmbed(fake.win);
  const notes = studioNotesQuote(embed, "j1", async () => ({ document_id: "d1", title: "量子化学" }));
  assert.equal(notes.available(), false, "没握手");
  fake.receive(hello());
  assert.equal(notes.available(), true);
  assert.equal(studioNotesQuote(embed, "", async () => null).available(), false, "不知道任务");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(notes.send({ itemId: "p001-b0003", pageIdx: 0, sourceText: "a", translatedText: "甲" }), true);
  assert.deepEqual(fake.sent.at(-1).data, {
    protocol: "retainpdf-studio-bridge", v: 1, type: "quote", job_id: "j1", document_id: "d1", title: "量子化学",
    item_id: "p001-b0003", page_idx: 0, source_text: "a", translated_text: "甲",
  });
  embed.stop();
});

const REGIONS = {
  items: [{
    item_id: "p002-b0004",
    source: { page: 2, bbox: [20, 40, 180, 100], unit: "pdf_point", origin: "top_left", text: "The vibration" },
    translated: { page: 2, bbox: [20, 40, 180, 100], unit: "pdf_point", origin: "top_left", text: "振动" },
    markdown: "振动", region_type: "text", status: "translated", asset_ids: [], asset_urls: [],
  }],
};

function hoverTarget() {
  const [region] = normalizeReaderRegions(REGIONS);
  const [target] = projectReaderTextHoverTargets([{ itemId: region.itemId, region, box: region.source, pageSize: { page: 2, width: 200, height: 200 } }], 200, 200);
  return target;
}

test("悬停框：宿主给了 notesQuote 且握过手才有「摘到笔记」；交出去的是原文页（0 起）、原文和整段译文", () => {
  const target = hoverTarget();
  try {
    setReaderAdapters(null);
    assert.doesNotMatch(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target })), /摘到笔记/, "不在 Studio 里");
    const notes = { ready: false, sent: [] };
    setReaderAdapters({ notesQuote: { available: () => notes.ready, send: (quote) => (notes.sent.push(quote), true) } });
    assert.doesNotMatch(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target })), /摘到笔记/, "没握手");
    notes.ready = true;
    assert.match(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target })), /aria-label="把这一段摘到笔记"/);
    assert.deepEqual(readerNotesQuoteOf(target), { itemId: "p002-b0004", pageIdx: 1, sourceText: "The vibration", translatedText: "振动" });
  } finally {
    setReaderAdapters(null);
  }
});

test("嵌入时整页跳转：不软开阅读层；本站页面的地址带着 embed", () => {
  const dom = makeDom("?embed=studio", { keys: ["window", "document", "CustomEvent", "Event", "location"] });
  assert.equal(embeddedIn(), "studio");
  assert.equal(trySoftOpenReader("./reader.html?job_id=j1"), false);
  assert.equal(carryEmbed("./reader.html?job_id=j1"), "http://localhost/reader.html?job_id=j1&embed=studio");
  assert.equal(carryEmbed("./reader.html?job_id=j1&embed=studio"), "./reader.html?job_id=j1&embed=studio", "已经带了不重复加");
  assert.equal(carryEmbed("https://github.com/x"), "https://github.com/x", "别的站不动");
  dom.window.close();
  makeDom("", { keys: ["window", "document", "location"] });
  assert.equal(carryEmbed("./reader.html?job_id=j1"), "./reader.html?job_id=j1", "没嵌入原样");
});

test("阅读页的加载进度只发给同源的父页（软阅读层），不再用 '*' 发给把它放进 iframe 的任何页面", async () => {
  makeDom("", { url: "http://127.0.0.1:40001/reader.html?job_id=j1&embed=studio", keys: ["window", "document", "location"] });
  const { defaultReaderPageConfigPort } = await import("../../src/features/reader/domain/host/config.ts");
  assert.equal(defaultReaderPageConfigPort.messageTargetOrigin(), "http://127.0.0.1:40001");
});
