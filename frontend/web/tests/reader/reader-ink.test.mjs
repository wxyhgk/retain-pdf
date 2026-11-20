/** 阅读页画笔：笔迹按页按栏、橡皮擦哪些、拖动丢掉太密的点、路径怎么画；右键什么时候出画笔菜单（Shift+右键、输入框里、书页外不出）。 */
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { appendPoint, onPane, strokesHitByEraser } from "../../../packages/reader/src/hooks/use-reader-ink.ts";
import { inkPath } from "../../../packages/reader/src/pdf/InkLayer.tsx";
import { inkMenuFromContextMenu } from "../../../packages/reader/src/components/react-pdf/ReaderInkPalette.tsx";

const stroke = (id, page, pane, points) => ({ id, page, pane, tool: "pen", color: "danger", width: 0.0035, points });

test("笔迹按页按栏：画在原文上的只在原文栏；旧数据没写栏按译文算", () => {
  assert.equal(onPane(stroke("a", 3, "source", []), 3, "source"), true);
  assert.equal(onPane(stroke("a", 3, "source", []), 3, "translated"), false);
  assert.equal(onPane(stroke("a", 3, "source", []), 4, "source"), false);
  assert.equal(onPane({ id: "old", page: 3, tool: "pen", color: "ok", width: 0.01, points: [] }, 3, "translated"), true);
});

test("橡皮：只擦这一页这一栏、离擦的位置够近的笔迹（y 按页高换算成和 x 同一尺度）", () => {
  const strokes = [
    stroke("near", 5, "translated", [[0.5, 0.5], [0.6, 0.5]]),
    stroke("far", 5, "translated", [[0.1, 0.1]]),
    stroke("other-pane", 5, "source", [[0.5, 0.5]]),
    stroke("other-page", 6, "translated", [[0.5, 0.5]]),
  ];
  assert.deepEqual(strokesHitByEraser(strokes, 5, "translated", 0.505, 0.505, 1.4), ["near"]);
  assert.deepEqual(strokesHitByEraser(strokes, 5, "translated", 0.3, 0.3, 1.4), []);
});

test("拖动时太密的点丢掉；路径按页的像素宽高放大，单个点画成一个小圆点", () => {
  const points = appendPoint(appendPoint([], 0.1, 0.1), 0.1005, 0.1004);
  assert.equal(points.length, 1, "挨得太近的不要");
  assert.equal(appendPoint(points, 0.2, 0.2).length, 2);
  assert.equal(inkPath([[0.1, 0.2], [0.3, 0.4]], 1000, 500), "M100.0 100.0 L300.0 200.0");
  assert.equal(inkPath([[0.5, 0.5]], 100, 100), "M50.0 50.0 l0.01 0");
  assert.equal(inkPath([], 100, 100), "");
});

test("右键：书页区里出画笔菜单（带页码）；Shift+右键、输入框里、书页外照旧是浏览器的菜单", () => {
  const dom = new JSDOM(`<body>
    <div class="reader-react-scroll-shell"><div data-reader-page="31"><span id="text">字</span></div><input id="box"></div>
    <header id="top">顶栏</header></body>`);
  const doc = dom.window.document;
  globalThis.Element = dom.window.Element;
  try {
    const at = (id, shiftKey = false) => inkMenuFromContextMenu({ shiftKey, target: doc.getElementById(id), clientX: 10, clientY: 20 });
    assert.deepEqual(at("text"), { x: 10, y: 20, page: 31 });
    assert.equal(at("text", true), null, "Shift+右键给浏览器");
    assert.equal(at("box"), null, "输入框里给浏览器");
    assert.equal(at("top"), null, "书页外给浏览器");
  } finally {
    delete globalThis.Element;
  }
});
