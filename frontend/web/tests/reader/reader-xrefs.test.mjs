/** 书里的引用（「图 2.1」「式 (3.21)」）：从图注、\tag 认去处；文字层里包 <mark>；悬停预览；Alt+← / Alt+→ 前进后退。 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildXrefIndex, findXrefs, normalizeXrefLabel, renderXrefText, xrefTitle } from "../../../packages/reader/src/shared/content/reader-xrefs.ts";
import { pushXrefHistory, stepXrefHistory } from "../../../packages/reader/src/hooks/use-reader-xrefs.ts";
import { placeXrefPreview } from "../../../packages/reader/src/components/react-pdf/ReaderXrefPreview.tsx";

const region = (itemId, regionType, text, page = 5, extra = {}) => ({
  itemId, regionType, assetIds: [], assetUrls: [], markdown: "", source: { page, text, bbox: [0, 0, 1, 1] }, translated: { page, text: "" }, ...extra,
});

const REGIONS = [
  region("p5-b0", "paragraph", "As shown in Figure 2.1, the energy …"),
  region("p5-b1", "image", "", 5, { assetUrls: ["x.png"] }),
  region("p5-b2", "text", "Figure 2.1 A molecular coordinate system.", 5, { subType: "figure_caption" }),
  region("p6-b0", "text", "Table 2.1 Conversion of atomic units", 6, { subType: "table_caption" }),
  region("p6-b1", "table", "<table><tr><td>1</td></tr></table>", 6),
  region("p7-b0", "display_formula", "$$ F \\psi = \\varepsilon \\psi \\tag {3.11} $$", 7),
  region("p7-b1", "display_formula", "$$ E = mc^2 $$", 7),
  region("p8-b0", "text", "Figure 9.9 is on another page", 8, { subType: "figure_caption" }),
  region("p9-b0", "text", "Figure 2.1 (continued)", 9, { subType: "figure_caption" }),
];

test("去处：图注 → 同页旁边的图 / 表；\\tag → 那个公式；没有图的图注指自己；同一编号只认第一次", () => {
  const index = buildXrefIndex(REGIONS);
  assert.equal(index.get("figure:2.1").itemId, "p5-b1");
  assert.equal(index.get("figure:2.1").captionId, "p5-b2");
  assert.equal(index.get("table:2.1").itemId, "p6-b1");
  assert.equal(index.get("equation:3.11").itemId, "p7-b0");
  assert.equal(index.get("figure:9.9").itemId, "p8-b0");
  assert.equal(index.size, 4, "没有 \\tag 的公式不进索引，(continued) 不覆盖第一次");
  assert.equal(normalizeXrefLabel(" 3 – 2 "), "3-2");
  assert.deepEqual(index.get("figure:2.1").itemIds, ["p5-b1", "p5-b2"], "预览画图 + 图注");
});

test("表被 OCR 认成一串公式：表注往下连着的公式都算这张表，碰到正文停；图往上找，没有再往下", () => {
  const index = buildXrefIndex([
    region("p83-b0", "text", "Table 2.2 Notations for integrals", 83, { subType: "table_caption" }),
    region("p83-b1", "display_formula", "$$ [i|h|j] $$", 83),
    region("p83-b2", "display_formula", "$$ (ij|kl) $$", 83),
    region("p83-b3", "paragraph", "For one-electron integrals …", 83),
    region("p83-b4", "display_formula", "$$ x $$", 83),
    region("p90-b0", "text", "Figure 3.1 Below the caption", 90, { subType: "figure_caption" }),
    region("p90-b1", "image", "", 90, { assetUrls: ["y.png"] }),
    region("p91-b0", "image", "", 91, { assetUrls: ["z.png"] }),
  ]);
  assert.deepEqual(index.get("table:2.2").itemIds, ["p83-b0", "p83-b1", "p83-b2"]);
  assert.equal(index.get("table:2.2").itemId, "p83-b1", "没有表格块就跳到第一块");
  assert.deepEqual(index.get("figure:3.1").itemIds, ["p90-b0", "p90-b1"], "下一页的图不算");
});

test("认引用：英文、中文，只认索引里有的；不重叠", () => {
  const index = buildXrefIndex(REGIONS);
  const keys = (text) => findXrefs(text, index).map((match) => [text.slice(match.start, match.end), match.key]);
  assert.deepEqual(keys("see Fig. 2.1 and Table 2.1, also Eq. (3.11) and Eq. (3.12)"), [
    ["Fig. 2.1", "figure:2.1"], ["Table 2.1", "table:2.1"], ["Eq. (3.11)", "equation:3.11"],
  ]);
  assert.deepEqual(keys("如图 2.1 所示，代入式 (3.11)，见表 2.1；式（3.11）"), [
    ["图 2.1", "figure:2.1"], ["式 (3.11)", "equation:3.11"], ["表 2.1", "table:2.1"], ["式（3.11）", "equation:3.11"],
  ]);
  assert.deepEqual(keys("Figures 7.7 and 2.10"), [], "索引里没有的不标；2.10 不能当成 2.1");
  assert.deepEqual(findXrefs("Figure 2.1", new Map()), []);
});

test("文字层 HTML：引用包 <mark class=reader-xref>（不用 span，文字层的 span 是绝对定位），搜索词照旧 <mark>，转义", () => {
  const index = buildXrefIndex(REGIONS);
  assert.equal(
    renderXrefText("a<b Figure 2.1 x", index, ""),
    'a&lt;b <mark class="reader-xref" data-xref="figure:2.1">Figure 2.1</mark> x',
  );
  assert.match(renderXrefText("Figure 2.1 energy", index, "energy"), /<mark class="reader-find-mark">energy<\/mark>/);
  assert.equal(renderXrefText("no refs", index, ""), "no refs");
  assert.equal(xrefTitle(index.get("equation:3.11")), "式 (3.11)");
  assert.equal(xrefTitle(index.get("table:2.1")), "表 2.1");
});

test("前进后退：跳之前压进后退栈、清空前进；后退时当前位置进前进栈；空的走不了", () => {
  const a = { page: 3, fraction: 0.4 };
  const b = { page: 40, fraction: 0 };
  let history = pushXrefHistory({ back: [], forward: [{ page: 99, fraction: 0 }] }, a);
  assert.deepEqual(history, { back: [a], forward: [] });
  const back = stepXrefHistory(history, b, "back");
  assert.deepEqual(back.to, a);
  assert.deepEqual(back.history, { back: [], forward: [b] });
  const forward = stepXrefHistory(back.history, a, "forward");
  assert.deepEqual(forward.to, b);
  assert.equal(stepXrefHistory(forward.history, b, "forward"), null);
  history = { back: [], forward: [] };
  for (let page = 1; page <= 60; page += 1) history = pushXrefHistory(history, { page, fraction: 0 });
  assert.equal(history.back.length, 50, "最多记 50 步");
});

test("预览放哪：下面放得下放下面，否则放上面；左右不出屏", () => {
  const viewport = { width: 1000, height: 800 };
  assert.deepEqual(placeXrefPreview({ left: 100, top: 100, right: 160, bottom: 120 }, { width: 300, height: 200 }, viewport), { left: 100, top: 128 });
  assert.deepEqual(placeXrefPreview({ left: 900, top: 700, right: 960, bottom: 720 }, { width: 300, height: 200 }, viewport), { left: 692, top: 492 });
});

test("接线：页面文字层用 renderXrefText；Alt+← 只有真的走了才拦（不然照旧是浏览器后退）；点之前选了字不跳", () => {
  const slot = readFileSync(new URL("../../../packages/reader/src/pdf/PdfPageSlot.tsx", import.meta.url), "utf8");
  assert.match(slot, /renderXrefText\(str, xrefIndex, findTerm\)/);
  const hook = readFileSync(new URL("../../../packages/reader/src/hooks/use-reader-xrefs.ts", import.meta.url), "utf8");
  assert.match(hook, /if \(moved\) event\.preventDefault\(\);/);
  assert.match(hook, /getSelection\?\.\(\) \|\| ""\}`\.trim\(\)\) return;/);
});
