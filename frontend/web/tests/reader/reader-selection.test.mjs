/** 书页上选字（2026-11-28 用户）：
 *  「对选区 copy 和提问取值做 PDF 断行 / 连字符清洗」
 *  「对照模式按下拖选时锁定当前栏（防左右串栏）+ 把 ::selection 颜色从黄色 --warn 换成浅冷色」
 *  「取消开着 AI 时 selectionchange 自动偷塞出处，并在划词右键 / 轻浮条里补齐『复制 + 收藏 + 提问』闭环」
 *  「尤其是行内公式的选择显示得做好」「类似这样可以真正的选中公式」
 * 真机（VP ≠ VNP 那篇论文）量过的在 docs/ops/planning/reader-redesign/20261128-书页选字.md。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  cleanPdfSelectionText,
  formulaRunAt,
  hasMathChar,
  isFormulaFiller,
  mergeSelectionRects,
} from "../../../packages/reader/src/shared/content/selection-text.ts";
import {
  addReaderFavorite,
  findReaderFavorite,
  readReaderFavorites,
  removeReaderFavorite,
} from "../../../packages/reader/src/shared/state/reader-favorites.ts";

const READER = new URL("../../../packages/reader/", import.meta.url);
const read = (relative) => readFileSync(fileURLToPath(new URL(relative, READER)), "utf8");

test("复制、提问拿到的字：行尾断词接回去、换行接成空格、中文不加空格、空行留成段落", () => {
  assert.equal(cleanPdfSelectionText("approximate compu-\ntation in the sense"), "approximate computation in the sense");
  assert.equal(cleanPdfSelectionText("metic cir-\ncuits; Valiant"), "metic circuits; Valiant");
  // 大写、数字开头的是本来就带连字符的词。
  assert.equal(cleanPdfSelectionText("self-\nConsistent field"), "self-Consistent field");
  assert.equal(cleanPdfSelectionText("first line\nsecond line\n\nnext para"), "first line second line\nnext para");
  assert.equal(cleanPdfSelectionText("中文第一行\n接着第二行"), "中文第一行接着第二行");
  assert.equal(cleanPdfSelectionText("英文 term\n接着"), "英文 term接着");
  assert.equal(cleanPdfSelectionText("the ﬁeld  of   x­"), "the field of x");
  assert.equal(cleanPdfSelectionText("   \n  "), "");
});

test("公式里的字收拾成人读的：数学字母还原、拆开的否定号合回去（⊈、≠），排对了的不动", () => {
  // pdf.js 拿到的就是这样（VP ≠ VNP 那篇论文 Theorem 1.4）。
  assert.equal(cleanPdfSelectionText("In particular VNP̸ ⊆ VP over every field."), "In particular VNP ⊈ VP over every field.");
  assert.equal(cleanPdfSelectionText("PERM\u{1D45A}, respectively HC\u{1D45A}"), "PERMm, respectively HCm");
  assert.equal(cleanPdfSelectionText("x ≠ y"), "x ≠ y");
  assert.equal(cleanPdfSelectionText("a ≠ b"), "a ≠ b");
});

test("行内公式：带数学符号的那几段加上中间夹着的短段（VNP、VP、空格）是一串，选区头尾撑到整串", () => {
  assert.equal(hasMathChar("⊆"), true);
  assert.equal(hasMathChar("\u{1D45A}"), true);
  assert.equal(hasMathChar("over every field."), false);
  assert.equal(isFormulaFiller("VNP"), true);
  assert.equal(isFormulaFiller(" "), true);
  assert.equal(isFormulaFiller("In particular"), false);
  const tokens = ["In particular", " ", "VNP", "̸", " ", "⊆", " ", "VP", " ", "over every field."].map((text) => ({ text, line: 1 }));
  assert.deepEqual(formulaRunAt(tokens, 5), [2, 7], "从 ⊆ 撑到 VNP … VP");
  assert.deepEqual(formulaRunAt(tokens, 2), [2, 7], "从 VNP 也撑到整串");
  assert.equal(formulaRunAt(tokens, 0), null, "正文不是公式");
  assert.equal(formulaRunAt(tokens, 9), null);
  // 只有短段、没有一个数学符号的不算公式（例如正文里的「VP」「(1)」）。
  assert.equal(formulaRunAt(["see", " ", "VP", " ", "and more text"].map((text) => ({ text, line: 1 })), 2), null);
  // 换了行就断开。
  const wrapped = [{ text: "⊆", line: 1 }, { text: "VP", line: 2 }];
  assert.deepEqual(formulaRunAt(wrapped, 0), [0, 0]);
});

test("选区画成每行一条齐整的色带：上下标的小框不把色带撑高；同一行隔得远（双栏的栏缝）分开画", () => {
  const bands = mergeSelectionRects([
    { left: 0, top: 10, right: 50, bottom: 23 },
    { left: 52, top: 15, right: 60, bottom: 24 }, // 下标
    { left: 62, top: 10, right: 80, bottom: 23 },
    { left: 400, top: 10, right: 450, bottom: 23 }, // 另一栏
    { left: 0, top: 30, right: 40, bottom: 43 },
  ]);
  assert.deepEqual(bands, [
    { left: 0, top: 10, right: 80, bottom: 23 },
    { left: 400, top: 10, right: 450, bottom: 23 },
    { left: 0, top: 30, right: 40, bottom: 43 },
  ]);
  assert.deepEqual(mergeSelectionRects([]), []);
});

test("收藏按书存在本机：新收的在前，同一页同一段不收两份，能删", () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  let n = 0;
  const opts = { storage, now: () => "2026-11-28T00:00:00Z", makeId: () => `id${++n}` };
  addReaderFavorite("book", { text: "VNP ⊈ VP", page: 2, pane: "source" }, opts);
  addReaderFavorite("book", { text: "第二段", page: 5, pane: "translated" }, opts);
  addReaderFavorite("book", { text: "VNP ⊈ VP", page: 2, pane: "source" }, opts);
  const list = readReaderFavorites("book", storage);
  assert.deepEqual(list.map((item) => [item.id, item.text, item.page, item.pane]), [["id2", "第二段", 5, "translated"], ["id1", "VNP ⊈ VP", 2, "source"]]);
  assert.ok(findReaderFavorite(list, "VNP ⊈ VP", 2));
  assert.equal(findReaderFavorite(list, "VNP ⊈ VP", 3), null);
  removeReaderFavorite("book", "id1", storage);
  assert.deepEqual(readReaderFavorites("book", storage).map((item) => item.id), ["id2"]);
  assert.deepEqual(readReaderFavorites("other", storage), [], "按书分开");
});

test("浏览器自己的选区在文字层里透明（!important 压过不分层的 pdf_viewer.css），色带是浅冷色，不再是黄色 --warn", () => {
  const pdf = read("styles/react-pdf.css");
  const rule = pdf.slice(pdf.indexOf(".reader-react-pdf-page .textLayer ::selection {"));
  assert.match(rule.slice(0, rule.indexOf("}")), /background: transparent !important;/, "pdf_viewer.css 的选区色会盖过来");
  assert.doesNotMatch(pdf, /textLayer ::selection \{[^}]*--warn/, "又回到黄色");
  const css = read("styles/selection.css");
  assert.match(css, /\.reader-selection-band \{[^}]*background: rgba\(64, 140, 230, 0\.24\);/, "色带不是浅冷色");
  // 对照时按下在哪一栏，另一栏的文字层这一下不让选。
  assert.match(css, /\.reader-react-root\[data-select-pane="source"\] \[data-reader-pane="translated"\] \.textLayer/);
  assert.match(css, /\.reader-react-root\[data-select-pane="translated"\] \[data-reader-pane="source"\] \.textLayer/);
  assert.match(css, /user-select: none;/);
  assert.match(read("styles/entry.css"), /@import "\.\/selection\.css" layer\(pages\);/);
});

test("选字的那一层接在书页区里：复制换成收拾过的字、松手撑公式、按下锁栏、浮条有复制 · 收藏 · 提问；右键最上面是复制、收藏这段", () => {
  const layer = read("src/components/react-pdf/ReaderSelectionLayer.tsx");
  assert.match(layer, /event\.clipboardData\.setData\("text\/plain", picked\.text\)/, "⌘C 拿到的不是收拾过的字");
  assert.match(layer, /snapSelectionToFormulas\(selection\)/, "松手不撑公式");
  assert.match(layer, /root\.dataset\.selectPane = pane/, "按下不锁栏");
  assert.match(layer, /filter\(\(item\) => item\.inSelectionBar\)/, "浮条没接扩展的「提问」");
  assert.match(layer, /<span>\{copied \? "已复制" : "复制"\}<\/span>/);
  assert.match(layer, /<span>\{saved \? "已收藏" : "收藏"\}<\/span>/);
  const app = read("src/ReaderAppReactPdf.tsx");
  const stage = app.slice(app.indexOf('<div className="reader-stage">'), app.indexOf('className="reader-dock"'));
  assert.match(stage, /<ReaderSelectionLayer scope=\{c\.viewStateKey\} menuItemsAt=\{\(context\) => collectMenuItems\(contributions, context\)\} \/>/);
  assert.match(app, /\.\.\.selectionMenuItems\(c\.viewStateKey\),\s*\.\.\.collectMenuItems\(contributions/, "右键最上面不是复制、收藏");
  // 提问扩展的「问这段」在浮条上写「提问」。
  assert.match(read("src/ask/use-reader-ask.tsx"), /inSelectionBar: anchor\.selection \? "提问" : undefined,/);
});

test("提问窗开着时选字不再悄悄带进提问（不听 selectionchange、不问「换成这段 / 再加一段」）；提问取的字也是收拾过的", () => {
  const ask = read("src/ask/use-reader-ask.tsx");
  assert.doesNotMatch(ask.replace(/\/\/[^\n]*/g, ""), /selectionchange/, "又在听选字");
  assert.doesNotMatch(ask, /contextOffer/);
  assert.doesNotMatch(read("src/ask/ReaderAskPanel.tsx"), /contextOffer/);
  // 2026-11-28 下午起和复制走同一份（pdf/page-selection.ts 的 selectionCleanText，HTML 页那两层也认）。
  assert.match(read("src/ask/anchor.ts"), /selectionCleanText\(selection\)/);
});

test("左下角「收藏」是真的列表：点一条翻回那一页，悬停出 × 删掉；没有收藏时说怎么收", () => {
  const control = read("src/components/react-pdf/ReaderBookmarkControl.tsx");
  assert.match(control, /useReaderFavorites\(scope\)/);
  assert.match(control, /goToPage\?\.\(favorite\.page, favorite\.pane\)/);
  assert.match(control, /onClick=\{\(\) => remove\(favorite\.id\)\}/);
  assert.doesNotMatch(control, /还在做/, "还写着功能还在做");
});
