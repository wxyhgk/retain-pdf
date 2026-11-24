// 对照模式缩放超过 50% 时每栏底部一条一直看得见的横向滚动条（栏原生的滚动条在整本书最底下、还藏掉了）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  paneScrollDelta,
  paneScrollThumb,
} from "../../../../frontend/packages/reader/src/components/react-pdf/ReaderPaneScrollbars.tsx";

test("放得下（页不比栏宽）时不画", () => {
  assert.equal(paneScrollThumb({ width: 700, scrollWidth: 700, scrollLeft: 0 }, 676), null);
  assert.equal(paneScrollThumb({ width: 700, scrollWidth: 701, scrollLeft: 0 }, 676), null, "差 1px 以内不算");
  assert.equal(paneScrollThumb({ width: 0, scrollWidth: 900, scrollLeft: 0 }, 676), null, "隐藏的栏");
});

test("滑块按可见比例定宽、按滚动位置定位，两头到边", () => {
  const start = paneScrollThumb({ width: 700, scrollWidth: 1400, scrollLeft: 0 }, 600);
  assert.equal(start.size, 300);
  assert.equal(start.offset, 0);
  const end = paneScrollThumb({ width: 700, scrollWidth: 1400, scrollLeft: 700 }, 600);
  assert.equal(end.offset, 300);
  const middle = paneScrollThumb({ width: 700, scrollWidth: 1400, scrollLeft: 350 }, 600);
  assert.equal(middle.offset, 150);
  const tiny = paneScrollThumb({ width: 100, scrollWidth: 100000, scrollLeft: 0 }, 600);
  assert.equal(tiny.size, 32, "滑块有最小宽度，免得拖不着");
});

test("拖滑块的距离换算成栏的滚动量（拖满轨道 = 滚满）", () => {
  const metrics = { width: 700, scrollWidth: 1400 };
  assert.equal(paneScrollDelta(metrics, 600, 300, 300), 700);
  assert.equal(paneScrollDelta(metrics, 600, 300, -150), -350);
  assert.equal(paneScrollDelta({ width: 700, scrollWidth: 700 }, 600, 600, 50), 0);
});

test("接线：对照网格挂了滚动条，样式贴底、不占高度", () => {
  const grid = readFileSync(new URL("../../../../frontend/packages/reader/src/components/react-pdf/ReaderCompareGrid.tsx", import.meta.url), "utf8");
  assert.match(grid, /<ReaderPaneScrollbars shellEl=\{shellEl\} \/>/);
  const css = readFileSync(new URL("../../../../frontend/packages/reader/styles/react-pdf.css", import.meta.url), "utf8");
  assert.match(css, /\.reader-pane-scrollbars \{\s*position: sticky;\s*bottom: 0;[\s\S]*?height: 0;/);
  const built = readFileSync(new URL("../../dist/css/reader.css", import.meta.url), "utf8");
  assert.match(built, /reader-pane-scrollbar-thumb/);
});
