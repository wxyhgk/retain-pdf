/** 白板讲解板：脚本校验、自动排版、逐帧纯函数、公式 SVG 清洗（docs/ops/planning/learning-system/20261125-白板讲解板.md）。 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { validateScript, SCRIPT_LIMITS } from "../../../packages/whiteboard/src/script/validate.ts";
import { layoutScript, LAYOUT } from "../../../packages/whiteboard/src/layout/layout.ts";
import { textWidth, wrapText } from "../../../packages/whiteboard/src/layout/measure.ts";
import { frameAt, stepTimeline, TIMING } from "../../../packages/whiteboard/src/render/frame.ts";
import {
  cachedMath,
  prepareMath,
  sanitizeMathSvg,
  setWhiteboardMathEngine,
} from "../../../packages/whiteboard/src/math/engine.ts";
import { BoardSvg, levelYs, arrowEnds } from "../../../packages/whiteboard/src/react/BoardSvg.tsx";

const fixedMath = () => ({ w: 200, h: 40 });

const SCRIPT = {
  version: 1,
  title: "因式分解",
  steps: [
    { id: "s1", say: "先把方程写出来。", ops: [{ op: "write", id: "eq", math: "x^2-5x+6=0" }] },
    {
      id: "s2",
      say: "找两个数。",
      ops: [
        { op: "write", id: "hint", text: "? × ? = 6", below: "eq" },
        { op: "mark", target: "eq", tone: "focus" },
      ],
    },
    {
      id: "s3",
      ops: [
        { op: "write", id: "fact", math: "(x-2)(x-3)=0", right_of: "hint" },
        { op: "arrow", from: "eq", to: "fact", label: "拆开" },
        { op: "note", target: "fact", text: "两个括号相乘等于 0" },
      ],
    },
  ],
};

test("校验：合规的脚本原样通过，没有问题", () => {
  const { script, issues } = validateScript(SCRIPT);
  assert.deepEqual(issues, []);
  assert.equal(script.steps.length, 3);
  assert.equal(script.steps[2].ops[1].op, "arrow");
  assert.equal(script.title, "因式分解");
});

test("校验：写错的指令变成「跳过」并说明原因，别的照常", () => {
  const { script, issues } = validateScript({
    version: 1,
    steps: [{
      id: "s1",
      ops: [
        { op: "write", id: "a", text: "ok" },
        { op: "draw3d", id: "b" },
        { op: "mark", target: "nope" },
        { op: "write", id: "a", text: "dup" },
        { op: "write", id: "c", text: "x", math: "y" },
        { op: "write", id: "1bad", text: "x" },
        { op: "levels", id: "lv", levels: [{ label: "σ", energy: "low" }] },
        "not an object",
      ],
    }],
  });
  const ops = script.steps[0].ops;
  assert.equal(ops[0].op, "write");
  assert.deepEqual(ops.slice(1).map((op) => op.op), Array(7).fill("unknown"));
  assert.match(ops[1].reason, /不认识的指令「draw3d」/);
  assert.match(ops[2].reason, /target 指向不存在的「nope」/);
  assert.match(ops[3].reason, /id「a」重复/);
  assert.match(ops[4].reason, /二选一/);
  assert.match(ops[5].reason, /不合规矩/);
  assert.match(ops[6].reason, /energy 不是数/);
  assert.equal(issues.length, 7);
});

test("校验：擦掉的东西不能再指；顶层不是脚本给空脚本；超长截断", () => {
  const erased = validateScript({ version: 1, steps: [{ ops: [
    { op: "write", id: "a", text: "x" },
    { op: "erase", target: "a" },
    { op: "mark", target: "a" },
  ] }] });
  assert.equal(erased.script.steps[0].ops[2].op, "unknown");
  assert.equal(erased.script.steps[0].id, "step-1", "没写 id 的步自动编号");

  assert.deepEqual(validateScript("<script>").script, { version: 1, steps: [] });
  assert.deepEqual(validateScript(null).issues, ["不是讲解脚本：缺少 steps 数组"]);

  const many = validateScript({ version: 1, steps: Array.from({ length: SCRIPT_LIMITS.steps + 5 }, () => ({ ops: [] })) });
  assert.equal(many.script.steps.length, SCRIPT_LIMITS.steps);
  const longText = validateScript({ version: 1, steps: [{ ops: [{ op: "write", id: "a", text: "x".repeat(SCRIPT_LIMITS.text + 1) }] }] });
  assert.equal(longText.script.steps[0].ops[0].op, "unknown");
});

test("排版：默认往下排一列；below 正下方、right_of 右边垂直居中；擦掉的不再占列", () => {
  const { script } = validateScript({ version: 1, steps: [{ ops: [
    { op: "write", id: "a", text: "第一行" },
    { op: "write", id: "b", text: "第二行" },
    { op: "write", id: "c", math: "x", right_of: "b" },
    { op: "write", id: "d", text: "下面", below: "c" },
    { op: "erase", target: "d" },
    { op: "write", id: "e", text: "接着排" },
  ] }] });
  const { boxes } = layoutScript(script, fixedMath);
  const a = boxes.get("a");
  const b = boxes.get("b");
  const c = boxes.get("c");
  const d = boxes.get("d");
  const e = boxes.get("e");
  assert.deepEqual([a.x, a.y], [LAYOUT.margin, LAYOUT.margin]);
  assert.equal(b.x, LAYOUT.margin);
  assert.equal(b.y, a.y + a.h + LAYOUT.gapY);
  assert.equal(c.x, b.x + b.w + LAYOUT.gapX);
  assert.equal(c.y, Math.round(b.y + b.h / 2 - c.h / 2), "right_of 垂直居中");
  assert.deepEqual([d.x, d.y], [c.x, c.y + c.h + LAYOUT.gapY]);
  assert.equal(e.y, c.y + c.h + LAYOUT.gapY, "d 擦掉以后，新东西排在 c 下面");
});

test("排版：文字按字符估宽，中文一个字一个 em；批注折行放在目标右边", () => {
  assert.equal(textWidth("中文", 20), 40);
  assert.ok(textWidth("Fock", 20) < textWidth("中文中文", 20));
  const lines = wrapText("The Fock operator depends on the orbitals it is solving for", 16, 120);
  assert.ok(lines.length > 1);
  for (const line of lines) assert.ok(textWidth(line, 16) <= 120 || !line.includes(" "));

  const { script } = validateScript(SCRIPT);
  const layout = layoutScript(script, fixedMath);
  const fact = layout.boxes.get("fact");
  const note = layout.notes.get("2:2");
  assert.equal(note.x, fact.x + fact.w + LAYOUT.noteGap);
});

test("逐帧：同样的输入永远得到同样的一帧；指令一个接一个画", () => {
  const { script } = validateScript(SCRIPT);
  const layout = layoutScript(script, fixedMath);
  const timeline = stepTimeline(script.steps[2].ops);
  assert.equal(timeline.starts[1], timeline.durations[0], "第二条等第一条画完");

  const a = frameAt(script, layout, 2, 100);
  const b = frameAt(script, layout, 2, 100);
  assert.deepEqual(a, b);

  const early = frameAt(script, layout, 2, 10);
  const kinds = early.items.map((item) => item.kind);
  assert.ok(kinds.includes("write"));
  assert.ok(!kinds.includes("arrow"), "箭头还没轮到");
  const fact = early.items.find((item) => item.key === "obj:fact");
  assert.ok(fact.progress > 0 && fact.progress < 1);
  const eq = early.items.find((item) => item.key === "obj:eq");
  assert.equal(eq.progress, 1, "前面各步都画完了");

  const done = frameAt(script, layout, 2, timeline.total);
  assert.equal(done.stepDone, true);
  assert.ok(done.items.every((item) => item.progress === 1));
  assert.equal(frameAt(script, layout, 2, Number.POSITIVE_INFINITY).stepDone, true, "减少动态效果：直接画完");
});

test("逐帧：mark 只在它那一步；擦掉的东西在那一步淡出、之后消失，指着它的箭头也没了", () => {
  const { script } = validateScript({ version: 1, steps: [
    { ops: [{ op: "write", id: "a", text: "A" }, { op: "write", id: "b", text: "B" }, { op: "mark", target: "a" }] },
    { ops: [{ op: "arrow", from: "a", to: "b" }] },
    { ops: [{ op: "erase", target: "a" }] },
    { ops: [{ op: "write", id: "c", text: "C" }] },
  ] });
  const layout = layoutScript(script, fixedMath);
  assert.ok(frameAt(script, layout, 0, 1e9).items.some((item) => item.kind === "mark"));
  assert.ok(!frameAt(script, layout, 1, 1e9).items.some((item) => item.kind === "mark"), "下一步就不圈了");

  const erasing = frameAt(script, layout, 2, TIMING.erase / 2);
  const a = erasing.items.find((item) => item.key === "obj:a");
  assert.ok(a.opacity > 0 && a.opacity < 1);
  const after = frameAt(script, layout, 3, 1e9);
  assert.ok(!after.items.some((item) => item.key === "obj:a"));
  assert.ok(!after.items.some((item) => item.kind === "arrow"));
  assert.ok(after.items.some((item) => item.key === "obj:b"));
});

test("逐帧：focus 把镜头推到目标上；没认出来的指令在那一步给提示", () => {
  const { script } = validateScript({ version: 1, steps: [
    { ops: [{ op: "write", id: "a", text: "A" }, { op: "write", id: "b", text: "很长很长很长很长很长的一行" }] },
    { ops: [{ op: "focus", target: "a" }, { op: "teleport" }] },
  ] });
  const layout = layoutScript(script, fixedMath);
  const wide = frameAt(script, layout, 0, 1e9).camera;
  const focused = frameAt(script, layout, 1, 1e9);
  assert.ok(focused.camera.w < wide.w);
  assert.equal(focused.warnings.length, 1);
  assert.match(focused.warnings[0], /teleport/);
});

test("能级图：能量越高越靠上；箭头按相对位置选边", () => {
  const ys = levelYs([-0.578, 0.670], 100, 300);
  assert.equal(ys[0], 300);
  assert.equal(ys[1], 100);
  assert.deepEqual(levelYs([1, 1], 100, 300), [200, 200]);
  const below = arrowEnds({ x: 0, y: 0, w: 100, h: 20 }, { x: 0, y: 60, w: 100, h: 20 });
  assert.ok(below.end.y > below.start.y);
  const right = arrowEnds({ x: 0, y: 0, w: 100, h: 20 }, { x: 200, y: 0, w: 100, h: 20 });
  assert.ok(right.end.x > right.start.x);
});

test("公式：换成假引擎时按 ex 换算像素；写错的记成错误、不抛；SVG 去掉链接和事件属性", async () => {
  setWhiteboardMathEngine(async () => ({
    toSvg(tex) {
      if (tex === "\\bad") throw new Error("Undefined control sequence");
      return `<svg style="vertical-align: -0.5ex;" width="10ex" height="2ex" viewBox="0 0 10 2"><a href="javascript:alert(1)"><path d="M0 0" onload="x()"/></a><use xlink:href="#g1"/></svg>`;
    },
  }));
  try {
    await prepareMath([{ tex: "x", size: "m" }, { tex: "\\bad", size: "m" }]);
    const ok = cachedMath("x", "m");
    assert.ok(Math.abs(ok.w - 10 * 22 * 0.442) < 0.01);
    assert.ok(!/javascript|onload|<a\b/.test(ok.svg));
    assert.match(ok.svg, /xlink:href="#g1"/, "页内引用留着");
    assert.match(cachedMath("\\bad", "m").error, /Undefined control sequence/);
  } finally {
    setWhiteboardMathEngine(null);
  }
  assert.equal(sanitizeMathSvg('<svg><image href="http://x"/><foreignObject>y</foreignObject></svg>'), "<svg>y</svg>");
});

test("渲染：一帧画成 SVG，文字是文字（不当 HTML），箭头带箭头标记", () => {
  const { script } = validateScript({ version: 1, title: "t", steps: [{ ops: [
    { op: "write", id: "a", text: "<b>不是标签</b>" },
    { op: "write", id: "b", text: "B" },
    { op: "arrow", from: "a", to: "b", tone: "correct" },
    { op: "levels", id: "lv", axis: "ε / Hartree", levels: [{ label: "σg", energy: -0.578, electrons: 2 }, { label: "σu*", energy: 0.67 }] },
  ] }] });
  const layout = layoutScript(script, fixedMath);
  const frame = frameAt(script, layout, 0, 1e9);
  const html = renderToStaticMarkup(createElement(BoardSvg, { frame, math: () => null, idPrefix: "t", title: "t" }));
  assert.match(html, /&lt;b&gt;不是标签&lt;\/b&gt;/);
  assert.match(html, /marker-end="url\(#t-arrowhead-correct\)"/);
  assert.match(html, /σg/);
  assert.equal((html.match(/class="wb-electron"/g) || []).length, 2, "σg 两个电子，σu* 空着");
  assert.match(html, /aria-label="白板：t"/);
});

test("公式：默认引擎（真 mathjax-full）排得出 SVG，尺寸是正数，\\href 不留链接", async () => {
  setWhiteboardMathEngine(null);
  await prepareMath([{ tex: "\\mathbf{F}\\mathbf{C} = \\mathbf{S}\\mathbf{C}\\boldsymbol{\\varepsilon}", size: "m" }, { tex: "\\href{javascript:alert(1)}{x}", size: "m" }]);
  const fcsce = cachedMath("\\mathbf{F}\\mathbf{C} = \\mathbf{S}\\mathbf{C}\\boldsymbol{\\varepsilon}", "m");
  assert.ok(fcsce.svg.startsWith("<svg"));
  assert.ok(fcsce.w > 50 && fcsce.h > 10, `${fcsce.w}×${fcsce.h}`);
  const href = cachedMath("\\href{javascript:alert(1)}{x}", "m");
  assert.ok(!/javascript:/.test(href.svg || ""));
  setWhiteboardMathEngine(null);
});
