/** 右边停着东西时，「居中」得按书页区算，不是按视口。
 *
 * 起因：`.reader-react-error` 和 `.reader-error-notice` 用 `left: 50%` +
 * `translateX(-50%)`。AI dock 打开后视口右半边是面板，50% 正好落在分栏线上 ——
 * 提示一半画在 PDF 上、一半画在面板上，而这两条偏偏是最需要读清楚的文案。
 *
 * 2026-11-27 起书页区是一个元素（.reader-stage，右边让出 --reader-stage-right）：底栏在它里面，
 * left: 50% 按书页区算；两条提示在外面，按 --reader-stage-right 算。右边停的是 Markdown 面板
 * （is-assistant-open）还是扩展贴右边的浮层（data-right-inset），都只设这一个变量。
 *
 * 断言方式：把 CSS 里的 `left` 表达式**算出像素值**再比中心点，不是去匹配某个
 * 字符串。换写法（改成 right、改成 margin-left、换个等价 calc）只要中心点对了
 * 就该绿；中心点错了必须红。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const READER_STYLES = fileURLToPath(
  new URL("../../../../frontend/packages/reader/styles/", import.meta.url),
);

const read = (name) =>
  readFileSync(new URL(name, `file://${READER_STYLES}`), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const VIEWPORT = 1000;
const SPLIT = 400;

/** 顶层规则（不含 @media 内部）。 */
function topLevelRules(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) {
        const prelude = css.slice(start, i).trim();
        rules.push({ prelude, bodyStart: i + 1, atRule: prelude.startsWith("@") });
      }
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const rule = rules[rules.length - 1];
        rule.body = css.slice(rule.bodyStart, i);
        start = i + 1;
      }
    }
  }
  return rules.filter((rule) => !rule.atRule && rule.body !== undefined);
}

function declaration(files, selector, property) {
  let found = null;
  for (const file of files) {
    for (const rule of topLevelRules(read(file))) {
      const selectors = rule.prelude.split(",").map((part) => part.trim());
      if (!selectors.includes(selector)) continue;
      const hits = [...rule.body.matchAll(new RegExp(`${property}\\s*:\\s*([^;]+);`, "g"))];
      if (hits.length > 0) found = hits[hits.length - 1][1].trim();
    }
  }
  return found;
}

/** 把 CSS 长度表达式算成像素。百分比按 percentBase 算（fixed 的是视口，书页区里 absolute 的是书页区宽）；
 * stageRight 是根节点上 --reader-stage-right 那时的值。 */
function px(expression, { stageRight = 0, stageLeft = 0, percentBase = VIEWPORT } = {}) {
  let expr = expression
    .replace(/calc\(/g, "(")
    .replace(/var\(--reader-ai-split-width\)/g, String(SPLIT))
    .replace(/var\(--reader-right-inset\)/g, String(SPLIT))
    .replace(/var\(--reader-sidebar-width\)/g, String(SIDEBAR))
    .replace(/var\(--reader-stage-right\)/g, String(stageRight))
    .replace(/var\(--reader-stage-left\)/g, String(stageLeft))
    .replace(/(\d+(?:\.\d+)?)dvw/g, (_, n) => String((VIEWPORT * Number(n)) / 100))
    .replace(/(\d+(?:\.\d+)?)vw/g, (_, n) => String((VIEWPORT * Number(n)) / 100))
    .replace(/(\d+(?:\.\d+)?)%/g, (_, n) => String((percentBase * Number(n)) / 100))
    .replace(/(\d+(?:\.\d+)?)px/g, "$1")
    .replace(/\bmin\(/g, "Math.min(")
    .replace(/\bmax\(/g, "Math.max(");
  expr = expr.trim();
  // 只放行算术 + min/max：别的写法宁可让测试炸掉，也不要悄悄算出个假数。
  const guard = expr.replace(/Math\.(?:min|max)/g, "");
  assert.match(guard, /^[-+*/(),0-9.\s]+$/, `算不动的表达式: ${expression}`);
  return Function(`"use strict"; return (${expr});`)();
}

const CHROME_FILES = ["react-pdf.css", "hud.css", "chrome.css", "assistant-dock.css"];
const DOCK_ONLY = ["assistant-dock.css"];

/** 这三条都靠 translateX(-50%) 居中，所以 left 就是中心点。 */
const CENTERED = [
  ".reader-react-error",
  ".reader-error-notice",
  ".reader-react-hud",
];
/** 在书页区里面（absolute，百分比按书页区宽）的。 */
const IN_STAGE = new Set([".reader-react-hud"]);

/** 三种状态下根节点的 --reader-stage-right：什么都没停、停着面板、扩展贴右边。 */
/** 左栏钉住时的宽（finder.css 的 --reader-sidebar-width 换算用）。 */
const SIDEBAR = 300;

/** 右边：什么都没停、停着面板、扩展贴右边；左边：没钉、左栏钉住（2026-11-27）。 */
const RIGHTS = [
  { name: "右边什么都没停", selector: ".reader-react-root", files: ["react-pdf.css"] },
  { name: "停着面板（is-assistant-open）", selector: ".reader-react-root.is-assistant-open", files: DOCK_ONLY },
  { name: "扩展贴右边（data-right-inset）", selector: ".reader-react-root[data-right-inset]", files: DOCK_ONLY },
];
const LEFTS = [
  { name: "左栏没钉", selector: ".reader-react-root", files: ["react-pdf.css"] },
  { name: "左栏钉住（is-sidebar-pinned）", selector: ".reader-react-root.is-sidebar-pinned", files: ["finder.css"] },
];
const STATES = LEFTS.flatMap((left) => RIGHTS.map((right) => ({ name: `${left.name} + ${right.name}`, left, right })));

function insetOf(side, variable) {
  const value = declaration(side.files, side.selector, variable);
  assert.ok(value, `${side.selector} 没有设 ${variable}`);
  return px(value);
}
const stageRightOf = (state) => insetOf(state.right, "--reader-stage-right");
const stageLeftOf = (state) => insetOf(state.left, "--reader-stage-left");

test("三条浮动 chrome 都靠 translateX(-50%) 居中 —— 下面按中心点比才成立", () => {
  for (const selector of CENTERED) {
    const transform = declaration(CHROME_FILES, selector, "transform");
    assert.ok(transform, `${selector} 没有 transform`);
    assert.match(transform, /translateX\(-50%\)/, `${selector}: ${transform}`);
  }
});

test("书页区按 --reader-stage-right / left 让出两边；底栏（连同工具）、滚动壳都在书页区里", () => {
  const inset = declaration(["react-pdf.css"], ".reader-stage", "inset");
  assert.ok(inset, ".reader-stage 没有 inset");
  assert.match(inset, /var\(--reader-stage-right\)/);
  assert.match(inset, /var\(--reader-stage-left\)/);
  assert.equal(declaration(["hud.css"], ".reader-react-hud", "position"), "absolute");
  // 2026-11-27 起右下角的小球并进底栏（ReaderHudTools 放在底栏的 toolsSlot）。
  assert.equal(declaration(["toolball.css"], ".reader-hud-tools", "position"), "relative");
  const app = readFileSync(fileURLToPath(new URL("../../../../frontend/packages/reader/src/ReaderAppReactPdf.tsx", import.meta.url)), "utf8");
  const stage = app.slice(app.indexOf('<div className="reader-stage">'));
  const end = stage.indexOf("</div>");
  assert.ok(end > 0, "没有书页区");
  for (const part of ["<ReaderCompareGrid", "<ReaderZoomHud", "toolsSlot={<ReaderHudTools"]) {
    const at = stage.indexOf(part);
    assert.ok(at > 0 && at < end, `${part} 不在书页区里`);
  }
});

test("三种状态下都居中在书页区，不在分栏线上；两条提示的宽度也收进书页区", () => {
  for (const state of STATES) {
    const right = stageRightOf(state);
    const leftInset = stageLeftOf(state);
    const stageWidth = VIEWPORT - right - leftInset;
    const stageCenter = leftInset + stageWidth / 2;
    for (const selector of CENTERED) {
      const left = declaration(CHROME_FILES, selector, "left");
      assert.ok(left, `${selector} 没有 left`);
      // 书页区里的按书页区算（再加上书页区左边的位置）；外面的 fixed 按视口算。
      const center = IN_STAGE.has(selector)
        ? leftInset + px(left, { percentBase: stageWidth })
        : px(left, { stageRight: right, stageLeft: leftInset });
      assert.equal(center, stageCenter, `${state.name}：${selector} 的中心是 ${center}，书页区中心是 ${stageCenter}`);
    }
    for (const selector of [".reader-react-error", ".reader-error-notice"]) {
      const maxWidth = declaration(["react-pdf.css"], selector, "max-width");
      const fitted = px(maxWidth, { stageRight: right, stageLeft: leftInset });
      assert.ok(fitted <= stageWidth - 32, `${state.name}：${selector} 算出来 ${fitted}，超出书页区可用宽度 ${stageWidth - 32}`);
    }
  }
  // 停着面板时书页区确实让了（不是 0）。
  assert.equal(stageRightOf(STATES[1]), SPLIT);
  assert.equal(stageRightOf(STATES[2]), SPLIT);
  assert.equal(stageLeftOf(STATES[3]), SIDEBAR, "左栏钉住时书页区左边让出一栏");
});
