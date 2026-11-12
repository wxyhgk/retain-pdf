// 阅读器悬停复制：鼠标在 PDF 内容块上 → 红色虚线框 + 「复制」，对照时左右两栏同一块一起画；
// 左栏复制原文、右栏复制译文；双击整块复制。4.1.x 旧引擎里最常用的交互，React 引擎替换时丢了，
// 同时内容块数据被「归一化两次」清成了 0，悬停框、点块浮条一起失效。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  copyReaderText,
  hoverToolsOutside,
  projectReaderTextHoverTargets,
  ReaderTextHoverLayer,
  readerShowsItemIds,
} from "../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx";
import { normalizeReaderRegions, readerRegionCopyText } from "../../../../frontend/packages/reader/src/shared/data/reader-regions.ts";
import { shouldEnableLiveTranslation } from "../../../../frontend/packages/reader/src/hooks/use-reader-react-controller.ts";

const PAYLOAD = {
  code: 0,
  data: {
    items: [{
      item_id: "p001-b0003",
      source: { page: 1, bbox: [20, 40, 180, 100], unit: "pdf_point", origin: "top_left", text: "The vibration of a diatomic molecule" },
      translated: { page: 1, bbox: [20, 40, 180, 100], unit: "pdf_point", origin: "top_left", text: "双原子分子的振动" },
      markdown: "双原子分子的振动",
      region_type: "text",
      status: "translated",
      asset_ids: ["a1"],
      asset_urls: ["/a1.png"],
    }],
  },
};

test("内容块归一化是幂等的：宿主快照归一化过一次，session 再归一化不能清空", () => {
  const once = normalizeReaderRegions(PAYLOAD);
  assert.equal(once.length, 1);
  assert.deepEqual(normalizeReaderRegions(once), once, "第二次归一化（拿到数组）必须原样保留，含 assetIds");
});

function target(pane) {
  const [region] = normalizeReaderRegions(PAYLOAD);
  const box = pane === "translated" ? region.translated : region.source;
  const [t] = projectReaderTextHoverTargets([{
    itemId: region.itemId,
    region,
    box,
    pageSize: { page: 1, width: 200, height: 200 },
  }], 200, 200);
  return t;
}

test("悬停框带「复制」，左栏标原文、右栏标译文；没有可复制的文字就不给复制按钮；翻译编号默认不显示", () => {
  const left = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("source"), pane: "source" }));
  assert.match(left, /reader-text-hover-frame/);
  assert.match(left, /aria-label="复制这段原文"/);
  assert.doesNotMatch(left, /复制翻译编号|p001-b0003</, "编号是排查用的，读者默认看不到");
  const right = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("translated"), pane: "translated" }));
  assert.match(right, /aria-label="复制这段译文"/);
  const empty = target("source");
  empty.highlight.region = { ...empty.highlight.region, source: { ...empty.highlight.region.source, text: "" }, markdown: "" };
  assert.doesNotMatch(renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: empty, pane: "source" })), /reader-text-hover-copy/);
});

test("阅读页地址带 ?debug=1 时框上出翻译编号（点一下复制），排查翻译问题用", () => {
  assert.equal(readerShowsItemIds("?job_id=x&debug=1"), true);
  assert.equal(readerShowsItemIds("?debug=true"), true);
  assert.equal(readerShowsItemIds("?job_id=x"), false);
  assert.equal(readerShowsItemIds("?debug=0"), false);
  const hadWindow = "window" in globalThis;
  globalThis.window = { location: { search: "?job_id=x&debug=1" } };
  try {
    const html = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("source"), pane: "source" }));
    assert.match(html, /aria-label="复制翻译编号 p001-b0003"/);
    assert.match(html, />p001-b0003</);
  } finally {
    if (!hadWindow) delete globalThis.window;
  }
});

test("红色虚线框用 danger 语义色", () => {
  const css = readFileSync(new URL("../../../../frontend/packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  assert.match(css, /\.reader-text-hover-frame\s*\{[^}]*border:\s*2px dashed[^}]*var\(--danger\)/);
});

test("复制：剪贴板可用就写进去；空文本不假装成功", async () => {
  const written = [];
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (text) => { written.push(text); } } }, configurable: true });
  try {
    assert.equal(await copyReaderText("双原子分子的振动"), true);
    assert.deepEqual(written, ["双原子分子的振动"]);
    assert.equal(await copyReaderText("   "), false);
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
  }
});

test("对照两栏共享悬停块；页里只把悬停 id 交给含这一块的页", () => {
  const grid = readFileSync(new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx", import.meta.url), "utf8");
  assert.equal((grid.match(/hoveredRegionId=\{hoveredRegionId\}/g) || []).length, 2, "左右两个 PdfDocumentPane 都拿到同一个悬停块");
  const pane = readFileSync(new URL("../../../../frontend/packages/reader/src/pdf/PdfDocumentPane.tsx", import.meta.url), "utf8");
  assert.match(pane, /hoveredRegionId && hoveredPages\.has\(pageNumber\) \? hoveredRegionId : null/);
});

test("打开时就已成功且有最终译文的任务不跟实时译文", () => {
  assert.equal(shouldEnableLiveTranslation({
    jobId: "j", sourceUrl: "/s.pdf", translatedUrl: "/t.pdf", jobStatus: "succeeded", workflow: "book",
  }), false);
  const controller = readFileSync(new URL("../../../../frontend/packages/reader/src/hooks/use-reader-react-controller.ts", import.meta.url), "utf8");
  assert.match(controller, /enabled: liveTranslationTracked && \(liveTranslationAvailable \|\| sawRunningRef\.current\.running\)/);
});

// 行间公式：region_type 常是 unknown、保留原文（kept_origin），公式只在原文里，译文和 markdown 都空。
const FORMULA = {
  items: [{
    item_id: "p002-b0003",
    source: { page: 2, bbox: [60, 120, 160, 140], unit: "pdf_point", origin: "top_left", text: "$$ f=-k(l-l_{0})=-kx $$" },
    translated: { page: 2, bbox: [60, 120, 160, 140], unit: "pdf_point", origin: "top_left", text: "" },
    markdown: "",
    region_type: "unknown",
    status: "kept_origin",
  }],
};

test("行间公式也能悬停：两栏都复制 LaTeX（去掉 $$）；译文栏没有译文时退回原文", () => {
  const [formula] = normalizeReaderRegions(FORMULA);
  assert.equal(readerRegionCopyText(formula, "source"), "f=-k(l-l_{0})=-kx");
  assert.equal(readerRegionCopyText(formula, "translated"), "f=-k(l-l_{0})=-kx");
  const [t] = projectReaderTextHoverTargets([{
    itemId: formula.itemId, region: formula, box: formula.translated, pageSize: { page: 2, width: 200, height: 200 },
  }], 200, 200);
  assert.ok(t, "公式块是悬停目标（以前只有正文是）");
  const markup = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: t, pane: "translated" }));
  assert.match(markup, /复制 LaTeX/);
});

test("正文里的行内公式原样保留 $…$", () => {
  const [region] = normalizeReaderRegions({ items: [{
    item_id: "p002-b0002",
    source: { page: 2, bbox: [1, 1, 9, 9], unit: "pdf_point", origin: "top_left", text: "Suppose no force acts on $m$" },
    translated: { page: 2, bbox: [1, 1, 9, 9], unit: "pdf_point", origin: "top_left", text: "设 $l_0$ 为平衡长度，位移 $x = l - l_0$" },
    markdown: "", region_type: "paragraph", status: "translated",
  }] });
  assert.equal(readerRegionCopyText(region, "translated"), "设 $l_0$ 为平衡长度，位移 $x = l - l_0$");
  assert.equal(readerRegionCopyText(region, "source"), "Suppose no force acts on $m$");
});

test("工具条：一般的块放框内右上角，只有矮 / 窄的块（行间公式）才放框外上方", () => {
  assert.equal(hoverToolsOutside({ left: 0, top: 0, width: 400, height: 120 }), false, "正文段落");
  assert.equal(hoverToolsOutside({ left: 0, top: 0, width: 140, height: 22 }), true, "一行高的窄公式");
  assert.equal(hoverToolsOutside({ left: 0, top: 0, width: 600, height: 18 }), true, "一行高的宽标题也放外面");
  const markup = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("source"), pane: "source" }));
  assert.match(markup, /data-placement="outside"/, "测试夹具的块 160×60：宽度不够，放外面");
});

test("只在框外工具条自己那一小块里保持当前框；不再保持整条带（紧贴上方的短块要能悬停到）", () => {
  const slot = readFileSync(new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(slot, /HOVER_TOOLS_BAND/);
  assert.match(slot, /hoverToolsOutside\(current\)/);
  assert.match(slot, /x <= current\.left \+ HOVER_TOOLS_WIDTH/);
  const css = readFileSync(new URL("../../../../frontend/packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  assert.match(css, /\.reader-text-hover-tools\[data-placement="inside"\]\s*\{[^}]*top:\s*4px/);
  assert.match(css, /\.reader-text-hover-tools\[data-placement="outside"\]\s*\{[^}]*bottom:\s*100%/);
  assert.match(css, /\.reader-text-hover-layer\s*\{[^}]*z-index:\s*7/);
});

test("双击 / 三击留给浏览器选词选段：不再整块复制、不清选区", () => {
  const slot = readFileSync(new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(slot, /onDoubleClick/);
  assert.doesNotMatch(slot, /removeAllRanges/);
});

test("触屏：点一下块出框，滑动不换框，抬手（pointerleave）不收框", () => {
  const slot = readFileSync(new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8");
  assert.match(slot, /onPointerDown=\{handlePointerDown\}/);
  assert.match(slot, /if \(event\.pointerType === "mouse"\) return;/, "点按出框只给触屏 / 笔");
  assert.match(slot, /if \(event\.pointerType === "touch"\) return;/, "触屏滑动不换框");
  assert.match(slot, /if \(event\.pointerType === "mouse"\) setHoveredTextId\(null\)/, "只有鼠标离开才收框");
});

test("「已复制」的定时器随换块清掉（A 上复制后马上换 B 复制，B 的提示不会被提前收掉）", () => {
  const layer = readFileSync(new URL("../../../../frontend/packages/reader/src/pdf/ReaderTextHoverLayer.tsx", import.meta.url), "utf8");
  assert.match(layer, /timers\.forEach\(\(timer\) => window\.clearTimeout\(timer\)\)/);
  assert.match(layer, /\}, \[itemId\]\);/);
});
