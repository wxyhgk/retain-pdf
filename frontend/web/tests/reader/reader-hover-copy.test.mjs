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

test("悬停框是淡的强调色实线框（2026-11-20 以前红色虚线像报错），走语义色不写死颜色", () => {
  const css = readFileSync(new URL("../../../../frontend/packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  const frame = css.match(/\.reader-text-hover-frame\s*\{([^}]*)\}/)[1];
  assert.match(frame, /border:\s*1\.5px solid[^;]*var\(--accent\)/);
  assert.doesNotMatch(frame, /dashed|--danger|#[0-9a-f]{3,6}/i);
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
  // 只在工具条放框外上方 / 下方时才保持（hover-presentation 的 inHoverToolsZone）；页边、段尾的工具条贴着框，不用保持。
  assert.match(slot, /if \(inHoverToolsZone\(hoverPresentation, x, y\)\) return;/);
  const css = readFileSync(new URL("../../../../frontend/packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  assert.match(css, /\.reader-text-hover-tools\[data-placement="inside"\]\s*\{[^}]*top:\s*4px/);
  assert.match(css, /\.reader-text-hover-tools\[data-placement="outside"\]\s*\{[^}]*bottom:\s*100%/);
  assert.match(css, /\.reader-text-hover-layer\s*\{[^}]*z-index:\s*7/);
});

test("双击 / 三击留给浏览器选词选段：不再整块复制、不清选区（只有图片双击放大，图里没有字可选）", () => {
  const slot = readFileSync(new URL("../../../../frontend/packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8");
  const handlers = slot.match(/onDoubleClick=\{[\s\S]*?\n      \}\}/g) || [];
  assert.ok(handlers.length <= 1, "页面上最多一处双击");
  for (const handler of handlers) {
    assert.match(handler, /!== "figure"\) return;/, "不是图片就不管，交给浏览器选词");
    assert.doesNotMatch(handler, /copy|Clipboard/i, "双击不复制");
  }
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

test("「改」「复制」放框外不挡字：候选位置按顺序，先找不碰字也不进别的块的，再找不碰字的，再试段尾，都没有挑压字最少的", async () => {
  const { placeHoverTools, inHoverToolsZone } = await import("../../../packages/reader/src/pdf/hover-presentation.ts");
  const place = (frame, others, glyphs = [], pageWidth = 600, pageHeight = 800) =>
    placeHoverTools({ frame, others, pageWidth, pageHeight, glyphs });
  const para = { left: 100, top: 200, width: 400, height: 120 };
  assert.deepEqual(place(para, [para]), { placement: "side-right" }, "右边页边 100px");
  const tight = { left: 300, top: 200, width: 300, height: 120 };
  assert.deepEqual(place(tight, [tight, { left: 20, top: 500, width: 100, height: 20 }]), { placement: "side-left" }, "右边贴页边、左边空 300px");
  // 论文页边窄（40px）：图标按钮竖排只要 28px，照样放页边，不进框里。
  const narrow = { left: 40, top: 200, width: 520, height: 120 };
  assert.deepEqual(place(narrow, [narrow]), { placement: "side-right" }, "页边 40px");
  // 页边有字（页眉页脚、溢出块的译文）就不放那儿；竖排的页边印章不算字。
  assert.deepEqual(place(narrow, [narrow], [{ left: 570, top: 0, width: 12, height: 800 }]), { placement: "side-right" }, "竖排印章不算字");
  assert.deepEqual(place(narrow, [narrow], [{ left: 562, top: 210, width: 30, height: 12 }, { left: 2, top: 210, width: 30, height: 12 }]),
    { placement: "outside" }, "两边页边都有字：放上方");

  // 两边贴页边：看上下、段尾。框贴着字（两行字，200–250）。
  const block = { left: 8, top: 200, width: 584, height: 50 };
  const neighbours = [block, { left: 8, top: 100, width: 584, height: 99 }, { left: 8, top: 251, width: 584, height: 90 }];
  const aboveText = { left: 10, top: 180, width: 580, height: 18 };
  const belowText = { left: 10, top: 252, width: 580, height: 18 };
  const line1 = { left: 10, top: 203, width: 580, height: 20 };
  assert.deepEqual(place(block, neighbours, [line1, { left: 10, top: 226, width: 300, height: 20 }]), { placement: "outside" },
    "上一块最后一行在 180 以上：上方那条落在上一块的空白里，不碰字，可以");
  assert.deepEqual(place(block, neighbours, [aboveText, belowText, line1, { left: 10, top: 226, width: 520, height: 20 }]),
    { placement: "tail", tailTop: 22 }, "上下都贴着字：最后一行只到 530，段尾空 62px 放得下");
  // 缩小看：一行只有 9px 高，工具条（24px）放段尾会压到上一行 —— 整条查，压到就不放。
  const small = { left: 8, top: 200, width: 584, height: 20 };
  const smallLines = [{ left: 10, top: 201, width: 578, height: 9 }, { left: 10, top: 210, width: 200, height: 9 }];
  const crowd = [{ left: 10, top: 182, width: 580, height: 16 }, { left: 70, top: 222, width: 520, height: 16 }];
  assert.deepEqual(place(small, [small], [...smallLines, ...crowd]), { placement: "below" },
    "段尾会压上一行、上方贴着字；下方那行从 70 开始（缩进）：放下方");
  const nearEdge = { left: 8, top: 200, width: 568, height: 50 };
  const fullLine = [line1, { left: 10, top: 226, width: 560, height: 20 }];
  assert.deepEqual(place(nearEdge, [nearEdge], [...fullLine, aboveText, belowText]), { placement: "side-right" }, "右边页边 24px：伸出页边一点点");
  // 哪都碰字：挑压字最少的（下方只压到一个 30px 宽的字块，比上方整行少）。
  assert.deepEqual(place(block, [block], [aboveText, ...fullLine, { left: 10, top: 252, width: 30, height: 18 }]), { placement: "below" }, "压字最少");
  const formula = { left: 10, top: 300, width: 580, height: 30 };
  assert.deepEqual(place(formula, [formula]), { placement: "outside" }, "矮的行间公式两边都挤：框外上方");

  // 保持区：只在框外上方 / 下方那一小条里。
  const shown = { rect: block, placement: "below" };
  assert.equal(inHoverToolsZone(shown, 20, 255), true, "框下方工具条那儿");
  assert.equal(inHoverToolsZone(shown, 300, 255), false, "框下方别处不保持");
  assert.equal(inHoverToolsZone({ ...shown, placement: "side-right" }, 20, 255), false, "页边的工具条贴着框，不用保持区");
});

test("「改」「复制」只画图标：名字在 aria-label / title，「改过几次」写在「改」的提示里；段尾的工具条对齐最后一行", () => {
  const markup = renderToStaticMarkup(createElement(ReaderTextHoverLayer, {
    target: target("translated"), pane: "translated", onEdit: () => {}, placement: "tail", tailTop: 27, revisedCount: 2,
  }));
  assert.match(markup, /data-placement="tail"/);
  assert.match(markup, /style="top:27px"/);
  assert.match(markup, /aria-label="改这段译文"[^>]*title="改这段译文（E；改过 2 次）"[^>]*><svg/);
  assert.match(markup, /aria-label="复制这段译文"[^>]*title="复制"[^>]*><svg/);
  assert.doesNotMatch(markup, />改</, "不写字");
  assert.doesNotMatch(markup, /改过 2 次</, "「改过几次」不单独出字");
});

test("悬停框贴着字：取中心落在块里的字的并集，留 3px，不超出原块；没有字、字太少照原块", async () => {
  const { tightenHoverRect } = await import("../../../packages/reader/src/pdf/hover-presentation.ts");
  const block = { left: 100, top: 100, width: 400, height: 300 };
  const lines = [
    { left: 110, top: 110, width: 380, height: 18 },
    { left: 104, top: 132, width: 200, height: 18 },
    { left: 600, top: 120, width: 50, height: 18 },
  ];
  assert.deepEqual(tightenHoverRect(block, lines), { left: 101, top: 107, width: 392, height: 46 }, "译文比原文短：框只到第二行底下");
  assert.deepEqual(tightenHoverRect(block, []), block);
  assert.deepEqual(tightenHoverRect(block, [{ left: 120, top: 120, width: 10, height: 10 }]), block, "一两个字的碎块不收");
});
