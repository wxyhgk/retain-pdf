// 阅读页左边的目录、搜索（packages/reader/src/shared/content/reader-find.ts）：从块来，不靠 Markdown 面板。
import test from "node:test";
import assert from "node:assert/strict";

import { currentOutlineIndex, plainMath, readerOutline, searchReaderRegions } from "../../../packages/reader/src/shared/content/reader-find.ts";

const box = (page, text) => ({ page, text });
const region = (itemId, page, source, translated, extra = {}) => ({
  itemId,
  source: box(page, source),
  translated: box(page, translated),
  markdown: "",
  regionType: "text",
  status: "translated",
  assetIds: [],
  assetUrls: [],
  ...extra,
});

const REGIONS = [
  region("p001-b0000", 1, "Chapter 15", "第 15 章", { subType: "title", headingLevel: 1 }),
  region("p001-b0001", 1, "The ethane barrier.", "乙烷的旋转势垒。"),
  region("p003-b0000", 3, "15.1 Ab initio", "15.1 从头算方法", { subType: "heading", headingLevel: 2 }),
  // 跨栏拆开的同一个标题：只要一条。
  region("p003-b0001", 3, "15.1 Ab initio", "15.1 从头算方法", { subType: "heading", headingLevel: 2 }),
  region("p004-b0002", 4, "Hartree-Fock gives poor barriers.", null),
  region("p009-b0000", 9, "15.2 Semiempirical", "", { subType: "heading", headingLevel: 2 }),
];

test("目录：标题块按顺序，译文优先，跨栏重复的去掉，带原文的页", () => {
  assert.deepEqual(readerOutline(REGIONS), [
    { itemId: "p001-b0000", level: 1, page: 1, text: "第 15 章" },
    { itemId: "p003-b0000", level: 2, page: 3, text: "15.1 从头算方法" },
    { itemId: "p009-b0000", level: 2, page: 9, text: "15.2 Semiempirical" },
  ]);
  assert.deepEqual(readerOutline([REGIONS[1]]), [], "没有标题块就是空的");
});

test("目录里眼下这一页在哪一节：页在它之后（含）的最后一条", () => {
  const outline = readerOutline(REGIONS);
  assert.equal(currentOutlineIndex(outline, 1), 0);
  assert.equal(currentOutlineIndex(outline, 5), 1);
  assert.equal(currentOutlineIndex(outline, 40), 2);
  assert.equal(currentOutlineIndex([{ itemId: "x", level: 1, page: 3, text: "t" }], 1), -1);
});

test("搜索：译文、原文都找，不分大小写，标出命中；空的不找；有上限", () => {
  const ethane = searchReaderRegions(REGIONS, "势垒");
  assert.equal(ethane.length, 1);
  assert.equal(ethane[0].itemId, "p001-b0001");
  assert.equal(ethane[0].side, "translated");
  assert.equal(ethane[0].snippet.slice(ethane[0].at, ethane[0].at + ethane[0].length), "势垒");

  const hf = searchReaderRegions(REGIONS, "hartree-FOCK");
  assert.deepEqual(hf.map((hit) => [hit.itemId, hit.page, hit.side]), [["p004-b0002", 4, "source"]]);

  assert.deepEqual(searchReaderRegions(REGIONS, "   "), []);
  assert.equal(searchReaderRegions(REGIONS, "15", 2).length, 2);
});

test("目录里标题的公式读成字：H₂O、E²、希腊字母；认不出的去掉记号", () => {
  assert.equal(plainMath("15.5 $\\mathrm{H}_{2}\\mathrm{O}$ 的 SCF MO 处理"), "15.5 H₂O 的 SCF MO 处理");
  assert.equal(plainMath("能量 $E^{2}$ 与 $\\alpha$、$\\pi$ 键"), "能量 E² 与 α、π 键");
  assert.equal(plainMath("$\\frac{1}{2}$ 的"), "12 的", "认不出的去掉记号");
  assert.equal(plainMath("没有公式"), "没有公式");
  const outline = readerOutline([region("p014-b0000", 14, "15.5 SCF MO Treatment of $\\mathrm{H}_{2}\\mathrm{O}$", "15.5 $\\mathrm{H}_{2}\\mathrm{O}$ 的 SCF MO 处理", { subType: "heading", headingLevel: 2 })]);
  assert.equal(outline[0].text, "15.5 H₂O 的 SCF MO 处理");
});
