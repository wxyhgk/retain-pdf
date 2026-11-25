/** 放大查看一块：区域按高分辨率重画（RegionCanvas），← → 在同类的块里走，悬停框多一个「放大」。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { REGION_CANVAS_MAX_PX, padRegion, regionRenderPlan } from "../../../packages/reader/src/pdf/RegionCanvas.tsx";
import { zoomSiblings } from "../../../packages/reader/src/components/react-pdf/ReaderZoomViewer.tsx";
import { ReaderTextHoverLayer } from "../../../packages/reader/src/pdf/ReaderTextHoverLayer.tsx";

test("画这一块：画布宽 = 显示宽 × 像素比，偏移把这一块挪到画布左上角；太大按上限缩", () => {
  const page = { width: 600, height: 800 };
  const region = { left: 0.1, top: 0.25, width: 0.5, height: 0.1 };
  const plan = regionRenderPlan(region, page, 600, 2);
  assert.equal(plan.scale, 4);
  assert.equal(plan.canvasWidth, 1200);
  assert.equal(plan.canvasHeight, 320);
  assert.equal(plan.offsetX, -240);
  assert.equal(plan.offsetY, -800);
  assert.equal(plan.cssHeight, 160);
  const huge = regionRenderPlan({ left: 0, top: 0, width: 1, height: 1 }, page, 5000, 3);
  assert.ok(Math.max(huge.canvasWidth, huge.canvasHeight) <= REGION_CANVAS_MAX_PX);
  assert.equal(huge.cssHeight, Math.round(5000 * 800 / 600), "显示尺寸不跟着上限缩");
});

test("留边不出页", () => {
  const padded = padRegion({ left: 0.005, top: 0.5, width: 0.99, height: 0.1 });
  assert.equal(padded.left, 0);
  assert.ok(padded.left + padded.width <= 1);
  assert.ok(Math.abs(padded.top - 0.488) < 1e-9);
});

const region = (itemId, regionType, extra = {}) => ({
  itemId, regionType, assetIds: [], assetUrls: [], markdown: "", source: { page: 1, text: "x" }, translated: { text: "y" }, ...extra,
});

test("← → 在同类里走：图和表算一类，公式一类，文字一类", () => {
  const all = [region("a", "figure"), region("b", "text"), region("c", "table"), region("d", "formula"), region("e", "figure")];
  assert.deepEqual(zoomSiblings(all, all[0]).map((entry) => entry.itemId), ["a", "c", "e"]);
  assert.deepEqual(zoomSiblings(all, all[3]).map((entry) => entry.itemId), ["d"]);
  assert.deepEqual(zoomSiblings(all, all[1]).map((entry) => entry.itemId), ["b"]);
});

test("悬停框：给了 onZoom 才有「放大」；图片只有放大、没有复制", () => {
  const target = (kind, text) => ({
    itemId: "p1-b1",
    rect: { left: 10, top: 10, width: 200, height: 120 },
    highlight: { itemId: "p1-b1", region: region("p1-b1", kind, { source: { page: 1, text }, translated: { text } }), box: { page: 1, bbox: [0, 0, 1, 1], unit: "pdf_point", origin: "top_left", text }, pageSize: { width: 1, height: 1 } },
  });
  const withZoom = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("text", "一段字"), onZoom: () => {} }));
  assert.match(withZoom, /reader-text-hover-zoom/);
  assert.match(withZoom, /reader-text-hover-copy/);
  const noZoom = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("text", "一段字") }));
  assert.doesNotMatch(noZoom, /reader-text-hover-zoom/);
  const figure = renderToStaticMarkup(createElement(ReaderTextHoverLayer, { target: target("figure", ""), onZoom: () => {} }));
  assert.match(figure, /reader-text-hover-zoom[^>]*title="放大看（也可以双击图片）"|title="放大看（也可以双击图片）"/);
  assert.doesNotMatch(figure, /reader-text-hover-copy/);
});

test("100% 时：先占满栏宽，太高的按放得下的高度缩", async () => {
  const { zoomFitWidth } = await import("../../../packages/reader/src/components/react-pdf/ReaderZoomViewer.tsx");
  assert.equal(zoomFitWidth(1000.4, 700, [0.2]), 1000, "一段字：占满栏宽");
  assert.equal(zoomFitWidth(1000, 700, [1.4]), 500, "高的图：按高度放得下");
  assert.equal(zoomFitWidth(1000, 700, [0.2, 1.4]), 500, "两栏按高的那栏");
  assert.equal(zoomFitWidth(1000, 0, [1.4]), 1000);
});
