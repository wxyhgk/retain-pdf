// 译文栏用 HTML 画（2026-11-28，docs/ops/planning/reader-redesign/20261128-阅读页只加载原文PDF.md）：
// 版面完整才替掉译文 PDF；原文先下、译文等定下来；译文栏挂原文 PDF 加版面；搜索在版面上标；放大用原文页加版面。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { layoutReplacesTranslatedPdf, translatedPdfForced } from "../../../packages/reader/src/hooks/reader-session/translated-layout.ts";
import { downloadJobPdfs } from "../../../packages/reader/src/hooks/reader-session/session-pdf-download.ts";
import { computeReaderPaneFlags } from "../../../packages/reader/src/hooks/use-reader-pane-model.ts";
import { LayoutPageLayer, layoutFindSpans } from "../../../packages/reader/src/pdf/LayoutPageLayer.tsx";

const read = (path) => readFileSync(new URL(`../../../packages/reader/${path}`, import.meta.url), "utf8");
const source = (features, fonts = [{ family: "RPR X", weight: 400, url: "/f" }]) => ({ features: new Set(features), fonts });

test("版面要带 erase、tables 和字体才能替掉译文 PDF；?translated=pdf 照旧用译文 PDF", () => {
  assert.equal(layoutReplacesTranslatedPdf(source(["erase", "tables"])), true);
  assert.equal(layoutReplacesTranslatedPdf(source(["erase"])), false, "表格不在版面里，译文 PDF 里的表格是译文");
  assert.equal(layoutReplacesTranslatedPdf(source([])), false, "以前存的版面要底图");
  assert.equal(layoutReplacesTranslatedPdf(source(["erase", "tables"], [])), false, "没有字体画不出和 PDF 一样的字");
  assert.equal(layoutReplacesTranslatedPdf(null), false);
  assert.equal(translatedPdfForced("?job_id=1&translated=pdf"), true);
  assert.equal(translatedPdfForced("?job_id=1"), false);
});

test("下载：原文先开始下，译文等版面定下来，版面能用就不下", async () => {
  const fence = { signal: new AbortController().signal, isInactive: () => false };
  const order = [];
  let release;
  const decided = new Promise((resolve) => { release = resolve; });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    order.push(`${url}`);
    return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "Content-Type": "application/pdf" } });
  };
  try {
    const pending = downloadJobPdfs({ sourceFinal: "http://x/source.pdf", translatedFinal: decided, fence, setBoot: () => {} });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(order, ["http://x/source.pdf"], "原文不等译文");
    release("");
    const result = await pending;
    assert.equal(result.status, "downloaded");
    assert.equal(result.translatedBytes, null);
    assert.deepEqual(order, ["http://x/source.pdf"], "版面能用时不下载译文 PDF");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("没下载译文 PDF 也挂译文栏（translatedHtml）", () => {
  const flags = (hasTranslated) => computeReaderPaneFlags({ mode: "compare", sourceOnly: false, assetsReady: true, hasSource: true, hasTranslated });
  assert.equal(flags(true).mountTranslated, true);
  assert.match(read("src/hooks/use-reader-pane-model.ts"), /hasTranslated: Boolean\(translatedFile\) \|\| Boolean\(input\.translatedHtml\)/);
});

test("译文栏挂原文 PDF、盖版面、版面里的页不挂文字层；放大用原文页加版面", () => {
  const grid = read("src/components/react-pdf/ReaderCompareGrid.tsx");
  assert.match(grid, /const translatedUrl = translatedLayout \? props\.sourceUrl \?\? ctx\?\.sourceUrl/);
  assert.match(grid, /const translatedFile = translatedLayout \? props\.sourceFile/);
  assert.match(grid, /onDocument=\{translatedLayout \? undefined : onPdfDocument\}/, "原文 PDF 不能当译文 PDF 登记（提问、引用预览拿它画译文）");
  const slot = read("src/pdf/PdfPageSlot.tsx");
  assert.match(slot, /renderTextLayer=\{textLayer && !layoutCovers\}/);
  assert.match(slot, /<LayoutPageHost[\s\S]*?coverWhileLoading/);
  const zoom = read("src/components/react-pdf/ReaderZoomViewer.tsx");
  assert.match(zoom, /pane === "translated" && translatedLayout \? documents\.source : documents\[pane\]/);
  const session = read("src/hooks/reader-session/session-assets.ts");
  assert.match(session, /translatedFinal: layoutPromise\.then\(\(layout\) => \(layout \? "" : translatedFinal\)\)/);
});

test("搜索：一行里命中的字簇从它的 x 画到下一个字簇的 x，最后一个到行尾；不分大小写，公式不参与", () => {
  const line = { text: "", x: 10, baseline: 20, width: 60, items: [
    { x: 10, t: "包" }, { x: 20, t: "覆" }, { x: 30, t: "层" }, { x: 40, tex: "x", display: false, w: 1, h: 1, d: 0 }, { x: 50, t: "NbPO" }, { x: 66, t: "4" },
  ] };
  assert.deepEqual(layoutFindSpans(line, "包覆"), [[10, 30]]);
  assert.deepEqual(layoutFindSpans(line, "nbpo4"), [[50, 70]]);
  assert.deepEqual(layoutFindSpans(line, "层x"), [], "公式不当成字");
  assert.deepEqual(layoutFindSpans(line, "  "), []);
  const page = { index: 0, width: 100, height: 100, covers: [], erase: [], tables: [], blocks: [{ id: "b", fontSize: 10, weight: "regular", color: [0, 0, 0], lines: [line] }] };
  const html = renderToStaticMarkup(createElement(LayoutPageLayer, { page, width: 100, height: 100, fontFamily: "serif", arrivedAt: 0, findTerm: "包覆" }));
  assert.equal(html.match(/reader-layout-find-mark/g)?.length, 1);
  assert.ok(html.indexOf("reader-layout-find-mark") < html.indexOf(">包<"), "底色画在字下面");
});
