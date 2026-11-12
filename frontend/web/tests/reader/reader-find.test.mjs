// 阅读页左边的目录、搜索（packages/reader/src/shared/content/reader-find.ts）：从块来，不靠 Markdown 面板。
import test from "node:test";
import assert from "node:assert/strict";

import { currentOutlineIndex, highlightFindTerm, plainMath, readerOutline, searchReaderRegions, stepFindHit } from "../../../packages/reader/src/shared/content/reader-find.ts";
import { isFindShortcut } from "../../../packages/reader/src/hooks/use-find-shortcut.ts";
import { makeDom } from "../helpers/dom.mjs";
import { waitFor } from "../helpers/async.mjs";

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

// ---------------------------------------------------------------- 书页上标命中、回车走、Cmd/Ctrl+F

test("书页文字层标命中：不分大小写、每处都标、先转义；没有词原样（转义后）返回", () => {
  assert.equal(highlightFindTerm("Hartree-Fock and hartree", "hartree"),
    '<mark class="reader-find-mark">Hartree</mark>-Fock and <mark class="reader-find-mark">hartree</mark>');
  assert.equal(highlightFindTerm("a<b & c", "b"), 'a&lt;<mark class="reader-find-mark">b</mark> &amp; c', "PDF 里的字要转义，不能当 HTML");
  assert.equal(highlightFindTerm("<x>", ""), "&lt;x&gt;");
  assert.equal(highlightFindTerm("", "x"), "");
  assert.equal(highlightFindTerm("aaa", "aa"), '<mark class="reader-find-mark">aa</mark>a', "不重叠");
});

test("回车 / Shift+回车在命中之间走，到头绕回；没有命中是 -1", () => {
  assert.equal(stepFindHit(-1, 3, false), 0, "第一次回车到第一处");
  assert.equal(stepFindHit(-1, 3, true), 2, "第一次 Shift+回车到最后一处");
  assert.equal(stepFindHit(0, 3, false), 1);
  assert.equal(stepFindHit(2, 3, false), 0, "到头绕回");
  assert.equal(stepFindHit(0, 3, true), 2, "往回绕");
  assert.equal(stepFindHit(5, 3, false), 0, "旧下标越界了从头来");
  assert.equal(stepFindHit(0, 0, false), -1);
});

test("Cmd/Ctrl+F 才算；带 Shift / Alt 的不算（那是别的快捷键）", () => {
  assert.equal(isFindShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: "f" }), true);
  assert.equal(isFindShortcut({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, key: "F" }), true);
  assert.equal(isFindShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: "f" }), false);
  assert.equal(isFindShortcut({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, key: "f" }), false);
});

test("Cmd/Ctrl+F 打开书内搜索；光标已经在搜索框里时不拦，交还浏览器", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div><input class='reader-finder-input' id='fi'></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useFindShortcut } = await import("../../../packages/reader/src/hooks/use-find-shortcut.ts");
  let opened = 0;
  function Probe() {
    useFindShortcut(React.useCallback(() => { opened += 1; }, []), dom.window);
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  // act 等渲染和 effect 都跑完，键盘监听一定挂上了（只等几毫秒在整套并发跑时不够）。
  await React.act(async () => { root.render(React.createElement(Probe)); });
  const press = () => {
    const event = new dom.window.KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true, bubbles: true });
    dom.window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(press(), true, "接住了，浏览器的查找不弹");
  assert.equal(opened, 1);
  dom.window.document.getElementById("fi").focus();
  assert.equal(press(), false, "光标在搜索框里：不拦");
  assert.equal(opened, 1);
  root.unmount();
  dom.window.close();
});

test("搜索框：回车跳下一处、Shift+回车上一处，写「第 i / n 处」；Esc 收起", async () => {
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const { ReaderFinder } = await import("../../../packages/reader/src/components/react-pdf/ReaderFinder.tsx");
  const { ReaderProvider } = await import("../../../packages/reader/src/components/react-pdf/reader-context.tsx");
  const regions = [
    region("p001-b0001", 1, "barrier one", "势垒一"),
    region("p002-b0001", 2, "barrier two", "势垒二"),
    region("p003-b0001", 3, "barrier three", "势垒三"),
  ];
  const jumps = [];
  let closed = 0;
  const root = createRoot(dom.window.document.getElementById("root"));
  const render = () => root.render(React.createElement(ReaderProvider, { value: { regions }, hud: { currentPage: 1 } },
    React.createElement(ReaderFinder, {
      tab: "search", onTab: () => {}, onClose: () => { closed += 1; }, onJump: (id) => jumps.push(id),
      query: "barrier", onQuery: () => {}, term: "barrier",
    })));
  await act(async () => { render(); });
  const doc = dom.window.document;
  const input = await waitFor(() => doc.querySelector(".reader-finder-input"), "搜索框");
  const key = async (k, shiftKey = false) => {
    await act(async () => { input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true, cancelable: true })); });
  };
  assert.match(doc.querySelector(".reader-finder-count").textContent, /3 处，回车跳到第一处/);
  await key("Enter");
  await key("Enter");
  await key("Enter", true);
  assert.deepEqual(jumps, ["p001-b0001", "p002-b0001", "p001-b0001"]);
  assert.match(doc.querySelector(".reader-finder-count").textContent, /第 1 \/ 3 处/);
  assert.equal(doc.querySelectorAll('.reader-finder-entry.is-hit[aria-current="true"]').length, 1);
  await key("Escape");
  assert.equal(closed, 1);
  root.unmount();
  dom.window.close();
});
