// 书页区左缘的目录（2026-11-28 照原型 reader-prototype.html）：一排短横线，移上去出目录卡。
// 数据 packages/reader/src/shared/content/reader-toc.ts，画 ReaderTocMinimap.tsx，样式 toc-minimap.css。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TOC_COMPACT_BARS,
  TOC_FILTER_MIN,
  TOC_MAX_BARS,
  filterToc,
  readerToc,
  tocBars,
  tocCurrent,
  tocSize,
} from "../../../packages/reader/src/shared/content/reader-toc.ts";
import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

const node = (id, title, page, level, children = []) => ({ id, title, page, level, children });
/** 一本「大书」：12 章、每章 6 节（共 84 条，超过 TOC_COMPACT_BARS）。 */
const BIG = Array.from({ length: 12 }, (_, c) => node(`${c}`, `第 ${c + 1} 章`, c * 30 + 1, 1,
  Array.from({ length: 6 }, (_, s) => node(`${c}.${s}`, `${c + 1}.${s + 1} 小节`, c * 30 + 2 + s * 4, 2))));

test("目录数据：有 PDF 书签用书签（只有一个书名根时拆开它，更深的层级摊进所在的章）；没书签用认出的标题，二级挂在前一个一级下", () => {
  const wrapped = [node("0", "整本书", 1, 1, [
    node("0.0", "第 1 章", 1, 2, [node("0.0.0", "1.1", 2, 3, [node("0.0.0.0", "1.1.1", 3, 4)])]),
    node("0.1", "第 2 章", 10, 2),
  ])];
  const toc = readerToc(wrapped, []);
  assert.deepEqual(toc.map((chapter) => chapter.title), ["第 1 章", "第 2 章"], "书名根拆开");
  assert.deepEqual(toc[0].children.map((child) => [child.title, child.depth]), [["1.1", 2], ["1.1.1", 3]], "更深的层级摊进章，深度照旧");
  const outline = [
    { itemId: "a", level: 2, page: 1, text: "前言" },
    { itemId: "b", level: 1, page: 2, text: "第 1 章" },
    { itemId: "c", level: 2, page: 3, text: "1.1" },
    { itemId: "d", level: 1, page: 9, text: "第 2 章" },
  ];
  const fromHeadings = readerToc([], outline);
  assert.deepEqual(fromHeadings.map((chapter) => [chapter.title, chapter.children.map((child) => child.title)]), [["前言", []], ["第 1 章", ["1.1"]], ["第 2 章", []]]);
  assert.equal(fromHeadings[1].itemId, "b", "按标题来的跳到那一块");
  assert.equal(tocSize(fromHeadings), 4);
  assert.deepEqual(readerToc([], []), []);
});

test("眼下在哪：页码不超过当前页的最后一条；章和它的第一节同页标那一节；一串都指向同一页时标第一条", () => {
  assert.deepEqual(tocCurrent(BIG, 1), { chapterId: "0", nodeId: "0" });
  assert.deepEqual(tocCurrent(BIG, 3), { chapterId: "0", nodeId: "0.0" });
  assert.deepEqual(tocCurrent(BIG, 95), { chapterId: "3", nodeId: "3.0" }, "第 4 章 91 页、4.1 在 92 页");
  const samePage = readerToc([node("0", "第 1 章", 5, 1, [node("0.0", "1.1", 5, 2), node("0.1", "1.2", 5, 2)]), node("1", "第 2 章", 5, 1)], []);
  assert.deepEqual(tocCurrent(samePage, 5), { chapterId: "0", nodeId: "0.0" });
  assert.deepEqual(tocCurrent(BIG, 0), { chapterId: null, nodeId: null });
});

test("短横线：条目少全画；大书只画全部章 + 当前章的节，当前节墨色、当前章深灰；章本身太多时隔几章画一根，总数不超过上限", () => {
  const small = readerToc([node("0", "一", 1, 1, [node("0.0", "1.1", 2, 2)]), node("1", "二", 5, 1)], []);
  assert.deepEqual(tocBars(small, tocCurrent(small, 2)).map((bar) => [bar.kind, bar.state]), [["h1", "chapter"], ["h2", "current"], ["h1", ""]]);
  const big = readerToc(BIG, []);
  assert.ok(tocSize(big) > TOC_COMPACT_BARS);
  const bars = tocBars(big, tocCurrent(big, 95));
  assert.equal(bars.filter((bar) => bar.kind === "h1").length, 12, "全部章");
  assert.deepEqual(bars.filter((bar) => bar.kind === "h2").map((bar) => bar.id), ["3.0", "3.1", "3.2", "3.3", "3.4", "3.5"], "只画当前章的节");
  assert.equal(bars.find((bar) => bar.state === "current").id, "3.0");
  const many = readerToc(Array.from({ length: 90 }, (_, c) => node(`${c}`, `第 ${c + 1} 章`, c + 1, 1)), []);
  const manyBars = tocBars(many, tocCurrent(many, 47));
  assert.ok(manyBars.length <= TOC_MAX_BARS, `画了 ${manyBars.length} 根`);
  assert.ok(manyBars.some((bar) => bar.id === "46" && bar.state === "current"), "当前章一定画");
});

test("过滤：章名中了列整章；只有节中了列这一章和中了的节；空的原样", () => {
  const big = readerToc(BIG, []);
  assert.equal(filterToc(big, " ").length, 12);
  assert.deepEqual(filterToc(big, "第 3 章").map((chapter) => [chapter.title, chapter.children.length]), [["第 3 章", 6]]);
  assert.deepEqual(filterToc(big, "5.2").map((chapter) => [chapter.title, chapter.children.map((child) => child.title)]), [["第 5 章", ["5.2 小节"]]]);
  assert.deepEqual(filterToc(big, "没有这个"), []);
});

test("目录卡：当前章展开、别的章收着；当前那一行标出来；点一条跳过去（书签跳页、标题跳块）；条目多时有过滤框；没有目录不画", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { ReaderTocMinimap } = await import("../../../packages/reader/src/components/react-pdf/ReaderTocMinimap.tsx");
  const { ReaderProvider } = await import("../../../packages/reader/src/components/react-pdf/reader-context.tsx");
  const pages = [];
  const blocks = [];
  const root = createRoot(dom.window.document.getElementById("root"));
  const render = async (bookmarks, regions = []) => {
    await act(async () => {
      root.render(React.createElement(ReaderProvider, { value: { regions }, hud: { currentPage: 95 } },
        React.createElement(ReaderTocMinimap, { bookmarks, onJumpPage: (page) => pages.push(page), onJumpBlock: (id) => blocks.push(id) })));
    });
  };
  const doc = dom.window.document;
  await render(BIG);
  const nav = await waitFor(() => doc.querySelector(".reader-toc-minimap"), "目录");
  assert.equal(nav.querySelectorAll(".reader-toc-bar").length, 18, "12 章 + 当前章 6 节");
  assert.ok(nav.querySelector(".reader-toc-filter"), `超过 ${TOC_FILTER_MIN} 条有过滤框`);
  await act(async () => { nav.dispatchEvent(new dom.window.Event("pointerover", { bubbles: true })); });
  await act(async () => { nav.dispatchEvent(new dom.window.FocusEvent("focusin", { bubbles: true })); });
  const current = nav.querySelector('.reader-toc-entry[aria-current="location"]');
  assert.match(current.textContent, /4\.1 小节/);
  assert.ok(nav.querySelector('[aria-label="收起「第 4 章」"]'), "当前章展开");
  assert.ok(nav.querySelector('[aria-label="展开「第 2 章」"]'), "别的章收着");
  assert.equal([...nav.querySelectorAll(".reader-toc-entry")].some((entry) => /2\.1 小节/.test(entry.textContent)), false);
  await act(async () => { nav.querySelector('[aria-label="展开「第 2 章」"]').dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  const sub = [...nav.querySelectorAll(".reader-toc-entry")].find((entry) => /2\.3 小节/.test(entry.textContent));
  await act(async () => { sub.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  assert.deepEqual(pages, [31 + 1 + 8], "书签跳到那一页");
  await render([], [
    { itemId: "h1", source: { page: 1, text: "Intro" }, translated: { page: 1, text: "引言" }, markdown: "", regionType: "text", status: "translated", assetIds: [], assetUrls: [], subType: "title", headingLevel: 1 },
  ]);
  await act(async () => { doc.querySelector(".reader-toc-entry").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  assert.deepEqual(blocks, ["h1"], "按标题来的跳到那一块");
  assert.equal(doc.querySelector(".reader-toc-filter"), null, "条目少没有过滤框");
  await render([], []);
  assert.equal(doc.querySelector(".reader-toc-minimap"), null, "没有目录不画");
  root.unmount();
  dom.window.close();
});

test("摆在书页区左缘、竖着居中；平时只有短横线，悬停 / 键盘焦点才出卡片；只用墨色深浅；左栏不再有目录", () => {
  const css = readFileSync(new URL("../../../packages/reader/styles/toc-minimap.css", import.meta.url), "utf8");
  assert.match(css, /\.reader-toc-minimap\s*\{[^}]*position:\s*absolute[^}]*top:\s*50%[^}]*left:\s*14px/s);
  assert.match(css, /\.reader-toc-card\s*\{[^}]*width:\s*268px[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.reader-toc-minimap:hover \.reader-toc-card,\s*\.reader-toc-minimap:has\(:focus-visible\) \.reader-toc-card\s*\{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}\b|--accent|--warn|--blue/i, "不用彩色");
  const entry = readFileSync(new URL("../../../packages/reader/styles/entry.css", import.meta.url), "utf8");
  assert.match(entry, /@import "\.\/toc-minimap\.css" layer\(pages\);/);
  const app = readFileSync(new URL("../../../packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url), "utf8");
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf("<ReaderCompareGrid"));
  assert.match(stage, /\{tocDocked \? null : <ReaderTocMinimap bookmarks=\{bookmarks\} onJumpPage=\{c\.goToPage\} onJumpBlock=\{jumpToBlock\} pinned=\{tocPinned\} onPinChange=\{setTocPinned\} \/>\}/, "在书页区里（没固定成一栏时）");
  const workspace = app.slice(app.indexOf('<div className="reader-workspace">'), app.indexOf('<div className="reader-stage">'));
  assert.match(workspace, /\{tocDocked \? <ReaderTocMinimap [^>]*pinned docked onPinChange=\{setTocPinned\} \/> : null\}\s*<ReaderFinderArea/, "固定成一栏时在中间工作区最左边");
  assert.match(app, /const tocDocked = tocPinned && finderState\.pinned;/, "屏够宽才固定成一栏（和左栏同一条线）");
  assert.match(app, /compareFitsStage\(c\.shell\.shellWidth, sideDocked \|\| leftDocked \|\| tocDocked\)/, "固定的目录也算让位");
  const finder = readFileSync(new URL("../../../packages/reader/src/components/react-pdf/ReaderFinder.tsx", import.meta.url), "utf8");
  assert.match(finder, /const TAB_TITLES: Record<ReaderFinderTab, string> = \{ search: "搜索", bookmarks: "书签", issues: "待改" \};/, "左栏没有目录页签");
});

test("固定目录（2026-11-28）：卡片顶上的图钉、顶栏「目录」按钮是同一个开关；浮着固定时卡片一直开着、按 Esc 收起；固定成一栏时不画短横线；没有目录时按钮灰掉", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { ReaderTocMinimap, ReaderTocToggle } = await import("../../../packages/reader/src/components/react-pdf/ReaderTocMinimap.tsx");
  const { ReaderProvider } = await import("../../../packages/reader/src/components/react-pdf/reader-context.tsx");
  const root = createRoot(dom.window.document.getElementById("root"));
  const doc = dom.window.document;
  const pins = [];
  let toggled = 0;
  const render = async (pinned, available = true, docked = false) => {
    await act(async () => {
      root.render(React.createElement(ReaderProvider, { value: { regions: [] }, hud: { currentPage: 95 } },
        React.createElement(ReaderTocToggle, { pinned, available, onToggle: () => { toggled += 1; } }),
        React.createElement(ReaderTocMinimap, { bookmarks: BIG, onJumpPage() {}, onJumpBlock() {}, pinned, docked, onPinChange: (next) => pins.push(next) })));
    });
  };
  await render(false);
  const nav = doc.querySelector(".reader-toc-minimap");
  assert.equal(nav.dataset.pinned, undefined);
  const button = doc.querySelector(".reader-toc-toggle");
  assert.equal(button.getAttribute("aria-label"), "目录");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  await act(async () => { button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  assert.equal(toggled, 1);
  const pin = nav.querySelector(".reader-toc-head .reader-toc-pin");
  assert.equal(pin.getAttribute("aria-label"), "固定在左边");
  await act(async () => { pin.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  assert.deepEqual(pins.splice(0), [true], "点图钉固定");
  await render(true);
  assert.equal(nav.dataset.pinned, "true");
  assert.equal(doc.querySelector(".reader-toc-toggle").getAttribute("aria-pressed"), "true");
  assert.ok(nav.querySelector('[aria-label="收起「第 4 章」"]'), "一钉住就展开当前章");
  assert.equal(nav.querySelector(".reader-toc-pin").getAttribute("aria-label"), "取消固定");
  await act(async () => { nav.querySelector(".reader-toc-entry").dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  assert.deepEqual(pins.splice(0), [false], "浮着固定时按 Esc 收起");
  await render(true, true, true);
  assert.equal(doc.querySelector(".reader-toc-minimap"), null, "固定成一栏时不画短横线");
  const dock = doc.querySelector("nav.reader-toc-dock");
  assert.ok(dock.querySelector('[aria-label="收起「第 4 章」"]'), "一栏里也展开当前章");
  await act(async () => { dock.querySelector(".reader-toc-pin").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  assert.deepEqual(pins.splice(0), [false], "一栏里点图钉取消固定");
  await render(false, false);
  assert.equal(doc.querySelector(".reader-toc-toggle").disabled, true, "没有目录时灰掉");
  root.unmount();
  dom.window.close();
  const css = readFileSync(new URL("../../../packages/reader/styles/toc-minimap.css", import.meta.url), "utf8");
  assert.match(css, /\.reader-toc-minimap\[data-pinned="true"\] \.reader-toc-card,[^{]*\{[^}]*opacity:\s*1/s, "固定时卡片开着");
  assert.match(css, /\.reader-toc-dock\s*\{[^}]*flex:\s*none;[^}]*width:\s*var\(--reader-sidebar-width, 248px\)/s, "一栏和左栏一样宽、实占");
});
