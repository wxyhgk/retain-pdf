// Ctrl + 滚轮缩放：手势中 CSS 预览、停手才提交一次；以鼠标所在点为中心（按页内比例对回去）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  WHEEL_ZOOM_SETTLE_MS,
  applyWheelPreview,
  captureZoomAnchor,
  clearWheelPreview,
  nextWheelZoom,
  restoreZoomAnchor,
  roundWheelZoom,
  wheelPreviewScale,
  wheelZoomFactor,
} from "../../../../frontend/packages/reader/src/pdf/reader-wheel-zoom.ts";
import {
  READER_ZOOM_MAX,
  READER_ZOOM_MIN,
  pageWidthFromShell,
} from "../../../../frontend/packages/reader/src/pdf/reader-zoom.ts";

test("往上滚放大、往下滚缩小；单个事件的幅度有上限；按行、按页的滚动换算成像素", () => {
  assert.ok(wheelZoomFactor(-100) > 1);
  assert.ok(wheelZoomFactor(100) < 1);
  assert.equal(wheelZoomFactor(0), 1);
  assert.equal(wheelZoomFactor(Number.NaN), 1);
  // 鼠标滚轮一格（100px）和截断上限（50px）一样大，触控板的小步更细。
  assert.equal(wheelZoomFactor(400), wheelZoomFactor(50));
  assert.ok(wheelZoomFactor(4) > wheelZoomFactor(50));
  assert.equal(wheelZoomFactor(3, 1), wheelZoomFactor(48));
  assert.ok(Math.abs(Math.log(wheelZoomFactor(-100)) + Math.log(wheelZoomFactor(100))) < 1e-12, "放大缩小对称");
});

test("累积的目标缩放夹在上下限里，提交取两位小数", () => {
  let zoom = 0.5;
  for (let i = 0; i < 100; i += 1) zoom = nextWheelZoom(zoom, -100);
  assert.equal(zoom, READER_ZOOM_MAX);
  for (let i = 0; i < 100; i += 1) zoom = nextWheelZoom(zoom, 100);
  assert.equal(zoom, READER_ZOOM_MIN);
  assert.equal(roundWheelZoom(0.53456), 0.53);
});

test("预览倍数 = 提交后的页宽 / 现在的页宽（页宽扣了固定内边距，不和缩放成正比）", () => {
  for (const shell of [800, 1400, 2560]) {
    for (const [from, to] of [[0.5, 0.75], [0.5, 0.3], [0.25, 1]]) {
      const before = pageWidthFromShell(shell, from);
      const after = pageWidthFromShell(shell, to);
      const scale = wheelPreviewScale(from, to, before);
      assert.ok(Math.abs(scale * before - after) <= 1.01, `${shell} ${from}→${to}: ${scale * before} vs ${after}`);
    }
  }
});

function fakeLayout() {
  const dom = new JSDOM(`<!doctype html><div class="reader-react-scroll-shell" id="shell"><main class="reader-react-grid">
    <div data-reader-pane="source" class="pane">
      <div class="reader-react-pdf-page-slot" data-reader-page="1" data-reader-pane="source"></div>
      <div class="reader-react-pdf-page-slot" data-reader-page="2" data-reader-pane="source"></div>
    </div></main></div>`);
  const doc = dom.window.document;
  const shell = doc.getElementById("shell");
  const state = { width: 400, gap: 20, scrollTop: 0, scrollLeft: 0, top: 50, left: 10 };
  Object.defineProperty(shell, "scrollTop", { get: () => state.scrollTop, set: (v) => { state.scrollTop = v; } });
  Object.defineProperty(shell, "scrollLeft", { get: () => state.scrollLeft, set: (v) => { state.scrollLeft = v; } });
  const pane = doc.querySelector(".pane");
  Object.defineProperty(pane, "scrollWidth", { get: () => 0 });
  Object.defineProperty(pane, "clientWidth", { get: () => 0 });
  for (const slot of doc.querySelectorAll(".reader-react-pdf-page-slot")) {
    const index = Number(slot.getAttribute("data-reader-page")) - 1;
    slot.getBoundingClientRect = () => {
      const height = state.width * 1.4;
      const top = state.top + index * (height + state.gap) - state.scrollTop;
      const left = state.left - state.scrollLeft;
      return { top, left, width: state.width, height, right: left + state.width, bottom: top + height, x: left, y: top };
    };
  }
  doc.querySelector("main").getBoundingClientRect = () => ({ top: state.top - state.scrollTop, left: state.left - state.scrollLeft, width: 800, height: 2000 });
  return { dom, shell, state };
}

test("鼠标下那一点：按页内比例记下，缩放后（页间距不变）滚回原位", () => {
  const { shell, state } = fakeLayout();
  state.scrollTop = 300;
  // 第 2 页上的一点
  const anchor = captureZoomAnchor(shell, 210, 500);
  assert.equal(anchor.page, "2");
  assert.equal(anchor.pane, "source");
  assert.equal(anchor.pageWidth, 400);
  const pointBefore = (rect) => [rect.left + anchor.fracX * rect.width, rect.top + anchor.fracY * rect.height];

  state.width = 600; // 放大 1.5 倍，页间距 20px 不变
  restoreZoomAnchor(shell, anchor);
  const slot = shell.querySelector('[data-reader-page="2"]');
  const [x, y] = pointBefore(slot.getBoundingClientRect());
  assert.ok(Math.abs(y - 500) < 0.5, `纵向回到鼠标下：${y}`);
  assert.ok(Math.abs(x - 210) < 0.5, `横向回到鼠标下：${x}`);
  // 再对一次不变（布局稳定后会再调一次）
  const before = state.scrollTop;
  restoreZoomAnchor(shell, anchor);
  assert.equal(state.scrollTop, before);
});

test("鼠标在页与页的空隙里取最近的一页；没有页时不记", () => {
  const { shell } = fakeLayout();
  const anchor = captureZoomAnchor(shell, 210, 50 + 560 + 5);
  assert.ok(anchor.page === "1" || anchor.page === "2");
  const empty = new JSDOM(`<div id="s"></div>`).window.document.getElementById("s");
  assert.equal(captureZoomAnchor(empty, 0, 0), null);
  assert.doesNotThrow(() => restoreZoomAnchor(empty, null));
});

test("预览只改页面区的 transform（以鼠标为原点），收起时清干净", () => {
  const { shell } = fakeLayout();
  const grid = applyWheelPreview(shell, 1.2, 110, 150);
  assert.equal(grid.style.transform, "scale(1.2)");
  assert.equal(grid.style.transformOrigin, "100px 100px");
  applyWheelPreview(shell, 1.3, 400, 400);
  assert.equal(grid.style.transformOrigin, "100px 100px", "同一次手势原点不动");
  clearWheelPreview(grid);
  assert.equal(grid.getAttribute("style") || "", "");
});

test("接线：控制器挂了滚轮缩放；只拦 Ctrl，非 passive；停手才提交、提交不再按视口中心拉滚动", () => {
  const read = (p) => readFileSync(new URL(`../../../../frontend/packages/reader/src/${p}`, import.meta.url), "utf8");
  assert.match(read("hooks/use-reader-react-controller.ts"), /useReaderWheelZoom\(shellEl, userZoom, onZoomChange\)/);
  const hook = read("hooks/use-reader-wheel-zoom.ts");
  assert.match(hook, /if \(!event\.ctrlKey\) return;/);
  assert.match(hook, /passive: false/);
  assert.match(hook, /setTimeout\(commit, WHEEL_ZOOM_SETTLE_MS\)/);
  assert.match(hook, /keepScroll: false/);
  assert.ok(WHEEL_ZOOM_SETTLE_MS >= 100 && WHEEL_ZOOM_SETTLE_MS <= 300);
});
