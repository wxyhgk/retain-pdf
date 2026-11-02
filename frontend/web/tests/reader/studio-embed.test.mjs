// 放在笔记（Studio）里：消息格式对得上契约、只认 window.parent 和本机回环地址、握手后才认别的、
// 跟着换亮暗不写本机设置、跳页带着 embed、悬停框握手后才有「摘到笔记」、Studio 认 open-notes 才有「笔记」按钮、
// 告诉 Studio 读到哪（reading）。
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
  closeNotesMessage,
  openNotesMessage,
  quoteMessage,
  readingMessage,
  readyMessage,
} from "../../src/platform/studio-bridge/protocol.ts";
import { startStudioEmbed, studioReaderAdapters, themeForStudio } from "../../src/app/bootstrap/studio-embed.ts";
import { carryEmbed } from "../../src/platform/navigation/pages.ts";
import { embeddedIn, trySoftOpenReader } from "../../../../frontend/packages/reader/src/shared/navigation/soft-reader.ts";
import {
  projectReaderTextHoverTargets,
  readerNotesQuoteOf,
  ReaderTextHoverLayer,
} from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";
import { normalizeReaderRegions } from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";
import { setReaderAdapters } from "../../../../frontend/packages/reader/src/adapters.ts";
import { ReaderNotesToggle } from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderCloseHome.tsx";

const CONTRACT = JSON.parse(readFileSync(new URL("../../../../contracts/studio-bridge.v1.schema.json", import.meta.url), "utf8"));
const STUDIO = "http://127.0.0.1:5173";
const hello = (theme = "light", features) => ({ protocol: "retainpdf-studio-bridge", v: 1, type: "hello", theme, ...(features ? { features } : {}) });
const notesMessage = (open, title = null) => ({ protocol: "retainpdf-studio-bridge", v: 1, type: "notes", open, title });

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
  assert.deepEqual(parseStudioMessage(hello("dark")), { type: "hello", theme: "dark", features: null }, "早先的 Studio 不发 features");
  assert.deepEqual(parseStudioMessage(hello("dark", ["quote", "open-notes", "later"])).features, ["quote", "open-notes"], "认不出的 feature 不管");
  assert.deepEqual(parseStudioMessage(notesMessage(true, " 量子化学 ")), { type: "notes", open: true, title: "量子化学" });
  assert.equal(parseStudioMessage({ ...notesMessage(true), open: "yes" }), null);
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
  const ready = readyMessage(["theme", "navigate", "quote", "notes"]);
  assertMatchesContract(ready, "ReadyMessage");
  assertMatchesContract(openNotesMessage({ jobId: "j1", documentId: null, title: "书" }), "OpenNotesMessage");
  assertMatchesContract(closeNotesMessage(), "CloseNotesMessage");
  const quote = quoteMessage({
    jobId: "j1", documentId: "", title: null, itemId: "p001-b0003", pageIdx: 0, sourceText: "a", translatedText: null,
  });
  assertMatchesContract(quote, "QuoteMessage");
  assert.equal(quote.document_id, null, "空的书编号写 null（契约 minLength 1）");
});

test("发出去的 reading 对得上契约：阅读页里是书和页，不在阅读页五项都是 null，页不在页数里写 null", () => {
  const reading = readingMessage({ book: { jobId: "j1", documentId: "d1", title: "量子化学" }, pageIdx: 11, pageCount: 300 });
  assertMatchesContract(reading, "ReadingMessage");
  assert.deepEqual(reading, { protocol: "retainpdf-studio-bridge", v: 1, type: "reading", job_id: "j1", document_id: "d1", title: "量子化学", page_idx: 11, page_count: 300 });
  const left = readingMessage(null);
  assertMatchesContract(left, "ReadingMessage");
  assert.deepEqual([left.job_id, left.document_id, left.title, left.page_idx, left.page_count], [null, null, null, null, null]);
  assert.deepEqual(readingMessage({ book: { jobId: "", documentId: "d1", title: "书" }, pageIdx: 0, pageCount: 3 }), left, "没有任务当不在阅读页");
  const unknown = readingMessage({ book: { jobId: "j1", documentId: "", title: "" }, pageIdx: 5, pageCount: 3 });
  assert.deepEqual([unknown.document_id, unknown.title, unknown.page_idx, unknown.page_count], [null, null, null, 3]);
  assert.equal(readingMessage({ book: { jobId: "j1", documentId: null, title: null }, pageIdx: 2, pageCount: null }).page_idx, 2, "页数还不知道时照样报页");
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
  assert.deepEqual(fake.sent, [
    { data: readyMessage(["theme", "navigate", "quote", "notes", "reading"]), origin: STUDIO },
    { data: readingMessage(null), origin: STUDIO },
  ], "回 ready，再说一声不在阅读页");
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

test("「摘到笔记」交给阅读器包：握过手、Studio 认 quote、知道任务才能摘；书和书名按任务查一次", async () => {
  const dom = makeDom();
  const fake = fakeWindow(dom);
  const embed = startStudioEmbed(fake.win);
  const { notesQuote } = studioReaderAdapters(embed, "j1", async () => ({ document_id: "d1", title: "量子化学" }));
  assert.equal(notesQuote.available(), false, "没握手");
  fake.receive(hello());
  assert.equal(notesQuote.available(), true, "早先的 Studio（hello 没有 features）只认 quote");
  assert.equal(studioReaderAdapters(embed, "", async () => null).notesQuote.available(), false, "不知道任务");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(notesQuote.send({ itemId: "p001-b0003", pageIdx: 0, sourceText: "a", translatedText: "甲" }), true);
  assert.deepEqual(fake.sent.at(-1).data, {
    protocol: "retainpdf-studio-bridge", v: 1, type: "quote", job_id: "j1", document_id: "d1", title: "量子化学",
    item_id: "p001-b0003", page_idx: 0, source_text: "a", translated_text: "甲",
  });
  fake.receive(hello("light", ["open-notes"]));
  assert.equal(notesQuote.available(), false, "Studio 列了 features 却没有 quote：不出「摘到笔记」");
  embed.stop();
});

test("「笔记」按钮：Studio 认 open-notes 才有；收着发 open-notes、开着发 close-notes；按下跟着 Studio 回的 notes 走", async () => {
  const dom = makeDom();
  const fake = fakeWindow(dom);
  const embed = startStudioEmbed(fake.win);
  const { notesPanel } = studioReaderAdapters(embed, "j1", async () => ({ document_id: "d1", title: "量子化学" }));
  const changes = [];
  const unsubscribe = notesPanel.subscribe(() => changes.push(notesPanel.getState()));
  assert.equal(notesPanel.getState().available, false, "没握手");
  fake.receive(hello());
  assert.equal(notesPanel.getState().available, false, "早先的 Studio 不认 open-notes");
  fake.receive(hello("light", ["quote", "open-notes"]));
  assert.deepEqual(notesPanel.getState(), { available: true, open: false, title: null });
  assert.equal(notesPanel.getState(), notesPanel.getState(), "没变时同一个对象");
  await new Promise((resolve) => setTimeout(resolve, 0));

  notesPanel.toggle();
  assert.deepEqual(fake.sent.at(-1), {
    data: { protocol: "retainpdf-studio-bridge", v: 1, type: "open-notes", job_id: "j1", document_id: "d1", title: "量子化学" },
    origin: STUDIO,
  });
  assert.equal(notesPanel.getState().open, false, "等 Studio 回 notes 才算开");
  fake.receive(notesMessage(true, "量子化学"));
  assert.deepEqual(notesPanel.getState(), { available: true, open: true, title: "量子化学" });
  fake.receive(notesMessage(false), { origin: "http://localhost:9999" });
  assert.equal(notesPanel.getState().open, true, "别的 origin 说的不算");
  notesPanel.toggle();
  assert.equal(fake.sent.at(-1).data.type, "close-notes");
  fake.receive(notesMessage(false, "还写着"));
  assert.deepEqual(notesPanel.getState(), { available: true, open: false, title: null }, "收着时不留标题");
  assert.ok(changes.length >= 3, "握手、开、收都通知");
  unsubscribe();
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

test("阅读页顶栏「笔记」：宿主给了且 available 才画；按下跟着 open，悬停写「收起笔记：书名」", () => {
  const render = () => renderToStaticMarkup(createElement(ReaderNotesToggle));
  try {
    setReaderAdapters(null);
    assert.equal(render(), "", "不在 Studio 里");
    const state = { snapshot: { available: false, open: false, title: null } };
    setReaderAdapters({ notesPanel: { getState: () => state.snapshot, subscribe: () => () => {}, toggle() {} } });
    assert.equal(render(), "", "Studio 不认 open-notes");
    state.snapshot = { available: true, open: false, title: null };
    assert.match(render(), /class="reader-notes-toggle"[^>]*aria-label="打开这本书的笔记"[^>]*aria-pressed="false"/);
    state.snapshot = { available: true, open: true, title: "量子化学" };
    assert.match(render(), /aria-label="收起笔记：量子化学"[^>]*aria-pressed="true"/);
  } finally {
    setReaderAdapters(null);
  }
});

test("读到哪：阅读器翻页报给宿主，握过手才发，防抖停下来再发，一样的不重发；书名查回来再报一次；Studio 重新握手再说一遍", async () => {
  const dom = makeDom();
  const fake = fakeWindow(dom);
  const embed = startStudioEmbed(fake.win, { debounceMs: 5 });
  let found;
  const lookup = new Promise((resolve) => { found = resolve; });
  const { readingPosition } = studioReaderAdapters(embed, "j1", () => lookup);
  readingPosition.report(0, 300);
  const readings = () => fake.sent.filter((entry) => entry.data.type === "reading").map((entry) => entry.data);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(readings().length, 0, "没握手不发");

  fake.receive(hello("light", ["quote", "open-notes"]));
  assert.deepEqual(readings().map((message) => [message.job_id, message.page_idx, message.page_count]), [["j1", 0, 300]], "握手时把记着的发出去");

  readingPosition.report(1, 300);
  readingPosition.report(2, 300);
  readingPosition.report(3, 300);
  assert.equal(readings().length, 1, "翻页时先不发");
  await settle();
  assert.deepEqual(readings().map((message) => message.page_idx), [0, 3], "停下来只发最后那页");
  readingPosition.report(3, 300);
  await settle();
  assert.equal(readings().length, 2, "一样的不重发");

  found({ document_id: "d1", title: "量子化学" });
  await settle();
  assert.deepEqual(readings().at(-1), readingMessage({ book: { jobId: "j1", documentId: "d1", title: "量子化学" }, pageIdx: 3, pageCount: 300 }));
  assert.equal(fake.sent.at(-1).origin, STUDIO, "不用 '*'");

  fake.receive(hello("light", ["quote", "open-notes"]));
  assert.deepEqual(readings().at(-1), readings().at(-2), "Studio 重新加载过：再说一遍");
  embed.stop();
});
