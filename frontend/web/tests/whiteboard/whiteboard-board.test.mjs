/** 无限白板（@retainpdf/whiteboard 的 Board）：Markdown + 公式怎么认、怎么渲染，打公式时按键怎么办，视图几何，存档。
 * 设计见 docs/ops/planning/learning-system/20261125-以PDF为主体的提问白板笔记.md。 */
import test from "node:test";
import assert from "node:assert/strict";

import { findMath, mathAtCaret, renderMathMarkdown } from "../../../packages/whiteboard/src/markdown/math-markdown.ts";
import {
  applyTextEdit,
  planBackspace,
  planBrace,
  planDollar,
  planTab,
} from "../../../packages/whiteboard/src/board/math-typing.ts";
import { applyCompletion, completeLatex, completionQuery, latexCommands } from "../../../packages/whiteboard/src/math/latex-assist.ts";
import {
  addNote,
  emptyBoard,
  fitView,
  parseBoard,
  removeItem,
  screenToWorld,
  updateItem,
  zoomAt,
  BOARD_ZOOM,
  NOTE_WIDTH,
} from "../../../packages/whiteboard/src/board/board-state.ts";
import { loadMathEngine, setWhiteboardMathEngine } from "../../../packages/whiteboard/src/math/engine.ts";

/** 把 `|` 当光标：返回 [文字, 光标位置]。 */
const at = (marked) => [marked.replace("|", ""), marked.indexOf("|")];
const show = (text, caret) => `${text.slice(0, caret)}|${text.slice(caret)}`;

test("认公式：$…$、$$…$$、\\(…\\)、\\[…\\]；转义、代码、$5 和 $10 不算", () => {
  const kinds = (text) => findMath(text).map((math) => `${math.display ? "D" : "I"}:${math.tex}`);
  assert.deepEqual(kinds("能量 $E_0$ 和 $$f = h$$"), ["I:E_0", "D:f = h"]);
  assert.deepEqual(kinds("\\(a+b\\) 与 \\[c\\]"), ["I:a+b", "D:c"]);
  assert.deepEqual(kinds("价格 $5 和 $10"), []);
  assert.deepEqual(kinds("转义 \\$x\\$ 不算"), []);
  assert.deepEqual(kinds("代码 `$x$` 和\n```\n$y$\n```\n真的 $z$"), ["I:z"]);
  assert.deepEqual(kinds("$$\na\n\nb\n$$"), ["D:\na\n\nb\n"], "单独一块可以跨空行");
  assert.deepEqual(kinds("写到一半 $\\frac{1"), [], "渲染时没收尾的不算");
  assert.deepEqual(findMath("写到一半 $\\frac{1", { open: true }).map((math) => math.tex), ["\\frac{1"], "边打边看时算");
});

test("光标所在的公式：在定界符里、或正好在公式末尾", () => {
  const [text, caret] = at("x $\\fr|$ y");
  assert.equal(mathAtCaret(text, caret)?.tex, "\\fr");
  assert.equal(mathAtCaret(...at("x| $a$")), null);
});

test("渲染：Markdown 照常；公式先占位再换回来（下划线不会变斜体）；原始 HTML、javascript: 链接、图片都不生效", async () => {
  setWhiteboardMathEngine(async () => ({
    toSvg: (tex, display) => `<svg data-tex="${tex.replace(/[<>&"]/g, "")}" data-display="${display}" width="2ex" height="1ex"></svg>`,
  }));
  try {
    const before = renderMathMarkdown("能量 $a_b$");
    assert.match(before, /wbm-math-pending/, "引擎没好时按原文显示");
    await loadMathEngine();
    const html = renderMathMarkdown("## 标题\n能量 $a_b$ 和 $c_d$\n\n$$x$$\n\n- 一\n- 二\n\n<script>alert(1)</script>\n\n链接 [坏](javascript:alert(1)) [好](https://example.com) ![图](http://x/y.png)");
    assert.match(html, /<h2>标题<\/h2>/);
    assert.match(html, /data-tex="a_b" data-display="false"/);
    assert.match(html, /data-tex="c_d"/);
    assert.match(html, /<span class="wbm-math wbm-math-display"><svg data-tex="x" data-display="true"/);
    assert.match(html, /<li>一<\/li>/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /href="javascript/i);
    assert.match(html, /链接 坏 /, "javascript: 链接只留文字");
    assert.match(html, /<a href="https:\/\/example.com"[^>]*rel="noreferrer noopener">好<\/a>/);
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /<em>/, "a_b c_d 里的下划线没被当成斜体");
    assert.match(renderMathMarkdown("未完 $\\frac{1"), /<p>未完 \$\\frac\{1<\/p>/, "没收尾的 $ 按原文");
    assert.match(renderMathMarkdown("价格 $5 和 $10"), /<p>价格 \$5 和 \$10<\/p>/);
  } finally {
    setWhiteboardMathEngine(null);
  }
});

test("打 $：外面自带收尾；选着字就包起来；空的 $|$ 里再打变单独一块；收尾前跳过", () => {
  const run = (marked) => {
    const [text, caret] = at(marked);
    const edit = planDollar(text, caret, caret);
    return edit ? show(applyTextEdit(text, edit), edit.caret) : null;
  };
  assert.equal(run("能量 |"), "能量 $|$");
  assert.equal(run("能量 $|$"), "能量 $$\n|\n$$");
  assert.equal(run("能量 $E|$ 后"), "能量 $E$| 后");
  assert.equal(run("能量 $E_|0$"), null, "公式中间照常打");
  const [text] = at("能量 E0|");
  const wrap = planDollar(text, 3, 5);
  assert.equal(show(applyTextEdit(text, wrap), wrap.caret), "能量 $E0$|");
});

test("公式里：{ 自带 }、} 跳过、空 {} 退格两个一起删、Tab 进下一个空 → 跳出这一层 → 跳出公式", () => {
  const apply = (marked, plan) => {
    const [text, caret] = at(marked);
    const edit = plan(text, caret);
    return edit ? show(applyTextEdit(text, edit), edit.caret) : null;
  };
  assert.equal(apply("$\\sqrt|$", (t, c) => planBrace(t, c, c, "{")), "$\\sqrt{|}$");
  assert.equal(apply("$\\sqrt{x|}$", (t, c) => planBrace(t, c, c, "}")), "$\\sqrt{x}|$");
  assert.equal(apply("$\\sqrt{|}$", (t, c) => planBackspace(t, c, c)), "$\\sqrt|$");
  assert.equal(apply("外面 {|", (t, c) => planBrace(t, c, c, "{")), null, "公式外面照常");
  assert.equal(apply("$\\frac{1|}{}$", planTab), "$\\frac{1}{|}$");
  assert.equal(apply("$\\sum_{b|} x$", planTab), "$\\sum_{b}| x$", "没有下一个空：跳出这一层，还在公式里");
  assert.equal(apply("$\\frac{1}{2}|$", planTab), "$\\frac{1}{2}$|", "不在任何 {} 里：跳出公式");
  assert.equal(apply("外面|", planTab), null);
});

test("命令补全（搬自 notes-studio）：\\fr → \\frac{|}{}，常用的排前面", () => {
  const commands = latexCommands();
  const tex = "\\fr";
  const query = completionQuery(tex, tex.length);
  assert.deepEqual(query, { from: 0, to: 3, prefix: "fr" });
  const [first] = completeLatex(query.prefix, commands);
  assert.equal(first.name, "\\frac");
  const edit = applyCompletion(tex, query, first);
  assert.equal(show(edit.insert, edit.caret), "\\frac{|}{}");
  assert.equal(completeLatex("al", commands)[0].name, "\\alpha");
  assert.deepEqual(completeLatex("alpha", commands), [], "已经打全了不再提示");
});

test("视图：以鼠标为中心缩放（那一点不动）、限制缩放范围、看全部", () => {
  const view = { x: 100, y: 50, zoom: 1 };
  const point = { x: 300, y: 200 };
  const before = screenToWorld(view, point);
  const zoomed = zoomAt(view, point, 2);
  const after = screenToWorld(zoomed, point);
  assert.deepEqual([Math.round(after.x), Math.round(after.y)], [Math.round(before.x), Math.round(before.y)]);
  assert.equal(zoomAt(view, point, 99).zoom, BOARD_ZOOM.max);
  assert.equal(zoomAt(view, point, 0.01).zoom, BOARD_ZOOM.min);

  let doc = addNote(emptyBoard(), { x: 0, y: 0 }, "a", "a").doc;
  doc = addNote(doc, { x: 1000, y: 600 }, "b", "b").doc;
  const fit = fitView(doc.items, { w: 800, h: 600 });
  assert.ok(fit.zoom < 1);
  const topLeft = { x: fit.x + 0 * fit.zoom, y: fit.y };
  assert.ok(topLeft.x >= 40 && topLeft.y >= 40, "左上角那张在视野里");
});

test("卡片：宽度有上下限；删掉；读存档时坏数据当空白板", () => {
  let doc = addNote(emptyBoard(), { x: 10.4, y: 20.6 }, "x", "n1").doc;
  assert.deepEqual([doc.items[0].x, doc.items[0].y, doc.items[0].w], [10, 21, NOTE_WIDTH.default]);
  assert.equal(updateItem(doc, "n1", { w: 10 }).items[0].w, NOTE_WIDTH.min);
  assert.equal(updateItem(doc, "n1", { w: 99999 }).items[0].w, NOTE_WIDTH.max);
  assert.equal(removeItem(doc, "n1").items.length, 0);
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(doc))), doc);
  assert.deepEqual(parseBoard({ version: 2, items: [] }), emptyBoard());
  assert.deepEqual(parseBoard({ version: 1, items: [{ kind: "note", id: "x" }, null], view: { x: "a" } }).items, []);
});
