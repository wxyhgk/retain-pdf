/** 阅读页「对比版本」和底栏「待处理」：左栏换成另一份译文的数据怎么拼、正在读哪一份、「用这一份」改地址；问题段落怎么挑、N 怎么走。 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  asComparePaneRegions,
  readerUrlWithJob,
  readingVersionOf,
} from "../../../packages/reader/src/hooks/use-reader-version-compare.ts";
import { stepIssue } from "../../../packages/reader/src/hooks/use-reader-issues.ts";
import { versionTimeText } from "../../../packages/reader/src/components/react-pdf/ReaderVersionCompare.tsx";
import { readerIssuesFromRows } from "../../src/features/reader/domain/reader-issues-port.ts";
import { readerVersionOption } from "../../src/features/reader/domain/translation-versions-port.ts";

const box = (page, text) => ({ page, bbox: [10, 20, 300, 80], text });

test("对比版本：左栏当原文栏用，块的 source 换成那一份的译文（位置不变）", () => {
  const regions = [{ itemId: "p001-b0001", source: box(1, "Hello"), translated: box(1, "你好（另一份）"), markdown: "", regionType: "text", status: "translated", assetIds: [], assetUrls: [] }];
  const [left] = asComparePaneRegions(regions);
  assert.equal(left.source.text, "你好（另一份）");
  assert.deepEqual(left.source.bbox, regions[0].source.bbox);
  assert.equal(regions[0].source.text, "Hello", "不改原来的块");
});

test("正在读的是哪一份：任务落在哪一份；找不到（合并出来的虚拟任务）用书的当前版本", () => {
  const versions = [
    { versionId: "tv-a", name: "A", createdAt: "", status: "succeeded", jobIds: ["job-a"] },
    { versionId: "tv-b", name: "B", createdAt: "", status: "succeeded", jobIds: ["job-b", "job-b2"] },
  ];
  assert.equal(readingVersionOf(versions, "job-b2", null), "tv-b");
  assert.equal(readingVersionOf(versions, "doc:xyz", "tv-a"), "tv-a");
  assert.equal(readingVersionOf(versions, "doc:xyz", null), "");
});

test("「用这一份」换地址里的 job_id，读到的页留着，块锚点去掉", () => {
  assert.equal(
    readerUrlWithJob("http://127.0.0.1:40001/reader.html?job_id=old&page_idx=30&block_id=p031-b0002", "new-job"),
    "/reader.html?job_id=new-job&page_idx=30",
  );
});

test("版本列表：名字用户改的优先，带时间；时间写成「11月18日 18:31」", () => {
  const option = readerVersionOption({ version_id: "tv-1", name: "精翻 · qwen3.8-flash", label: "", created_at: "2026-11-18T10:31:00Z", status: "succeeded", job_ids: ["j1"], hidden: false });
  assert.deepEqual([option.name, option.jobIds], ["精翻 · qwen3.8-flash", ["j1"]]);
  assert.equal(readerVersionOption({ version_id: "tv-2", name: "精翻 · x", label: "最好的那份", job_ids: [] }).name, "最好的那份");
  assert.match(versionTimeText("2026-11-18T10:31:00Z"), /^11月18日 \d\d:31$/);
  assert.equal(versionTimeText(""), "");
});

test("待处理：没翻成、内容问题都列；版面放不下只列 critical；同一段同一类只列一次；按页排", () => {
  const issues = readerIssuesFromRows(
    [{ reader_item_id: "p072-b0001", page: 72, source_text: "Three years prior to the closure, the majority of puppeteers working on the show voted" }],
    [
      { reader_item_id: "p010-b0002", page: 10, check: "numbers", severity: "major", message: "原文 1977 年，译文写成 1979 年" },
      { reader_item_id: "p010-b0002", page: 10, check: "numbers", severity: "major", message: "重复的一条" },
      { reader_item_id: "p004-b0002", page: 4, check: "layout_fit", severity: "major", message: "溢出 3pt" },
      { reader_item_id: "p005-b0001", page: 5, check: "layout_fit", severity: "critical", message: "放不下一大截" },
      { reader_item_id: "p020-b0003", page: 20, check: "brand_new", severity: "critical", message: "后端新加的检查" },
      { reader_item_id: "", page: 1, check: "terms", severity: "major", message: "没有块号的不列" },
    ],
  );
  assert.deepEqual(issues.map((i) => [i.page, i.kind, i.title]), [
    [5, "layout", "版面放不下"],
    [10, "content", "数字对不上"],
    [20, "content", "后端新加的检查"],
    [72, "failed", "没翻成，先显示原文"],
  ]);
  assert.match(issues[3].detail, /^Three years prior/);
});

test("N / Shift+N：接着上一次跳到的走，到头绕回；还没跳过从眼下这一页往后（往前）找", () => {
  const issues = [5, 10, 20, 72].map((page) => ({ readerItemId: `p${page}`, page, kind: "content", title: "", detail: "" }));
  assert.equal(stepIssue(issues, -1, 12, false), 2, "第 12 页往后第一处是第 20 页");
  assert.equal(stepIssue(issues, -1, 12, true), 1, "往前第一处是第 10 页");
  assert.equal(stepIssue(issues, -1, 100, false), 0, "后面没有了绕回第一处");
  assert.equal(stepIssue(issues, 3, 1, false), 0);
  assert.equal(stepIssue(issues, 0, 1, true), 3);
  assert.equal(stepIssue([], -1, 1, false), -1);
});

test("顶栏、底栏的工具（2026-11-28 三行壳层）：顶栏右边只有面板（Markdown），「对比版本」是「对照」后面的 ▾，点了往下弹版本列表、点外面收起，只有一份译文时没有；底栏只有放在底栏的（● 画笔 ▾，带字），▾ 弹出它的选项", async () => {
  const { makeDom } = await import("../helpers/dom.mjs");
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div><div id='page'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const { ReaderBarTools } = await import("../../../packages/reader/src/components/react-pdf/ReaderBarTools.tsx");
  // 「对比版本」是扩展：按钮经贡献表进「对照」后面（place "compare"）。这里用扩展自己的那颗按钮登记进一张表；再登记一颗放底栏、带 ▾ 的。
  const { compareToolbarItem } = await import("../../../packages/reader/src/extensions/builtin/compare.tsx");
  const { createContributionStore, ReaderExtensionsProvider } = await import("../../../packages/reader/src/extensions/registry.tsx");
  const { PenLine } = await import("lucide-react");
  const store = createContributionStore();
  const api = { documentId: "d", jobId: "j1", versionId: "tv-a", translationVersions: [], regions: [], metadata: null, bookmarks: [], pageCount: 1, resetKey: "k",
    hoveredItemId: () => null, goToPage() {}, sourceOnly: false, activePanel: null, closePanel() {}, visibleMode: "source", setWorkspace() {} };
  let pen = 0;
  const bars = (available) => {
    const item = compareToolbarItem(compare(available));
    store.set("compare", "对比版本", { toolbarItems: item ? [item] : [] });
    store.set("ink", "画笔", { toolbarItems: [{ key: "ink", label: "画笔", Icon: PenLine, mark: React.createElement("span", { className: "dot" }), place: "bottom", onClick: () => { pen += 1; }, dropdown: () => React.createElement("div", { className: "pen-options" }, "笔和颜色") }] });
    return React.createElement(ReaderExtensionsProvider, { api, store },
      React.createElement("header", { id: "top" }, React.createElement(ReaderBarTools, { place: "top", active: null }), React.createElement("div", { id: "tabs" }, React.createElement(ReaderBarTools, { place: "compare" }))),
      React.createElement("footer", { id: "bottom" }, React.createElement(ReaderBarTools, { place: "bottom" })));
  };
  const compare = (available) => ({
    available,
    versions: [{ versionId: "tv-a", name: "精翻 · a", createdAt: "", status: "succeeded", jobIds: ["j1"] }],
    readingVersionId: "tv-a", compared: null, loading: "", error: "",
    choose() {}, clear() {}, adopt: async () => {},
  });
  const root = createRoot(dom.window.document.getElementById("root"));
  const doc = dom.window.document;
  const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };
  await act(async () => { root.render(bars(true)); });
  const top = doc.getElementById("top");
  const bottom = doc.getElementById("bottom");
  assert.ok(top.querySelector(".reader-bar-tools.is-top .reader-panel-toggle"), "Markdown 在顶栏");
  assert.equal(top.querySelector('[data-bar-tool="ink"]'), null, "放底栏的不出在顶栏");
  assert.equal(bottom.querySelector(".reader-panel-toggle"), null, "面板按钮不出在底栏");
  assert.equal(top.querySelector('.reader-bar-tools.is-top [data-bar-tool="compare"]'), null, "顶栏右边不再有对比版本");
  const tabs = doc.getElementById("tabs");
  await click(tabs.querySelector('.reader-bar-tools.is-compare [data-bar-tool="compare"]'));
  assert.ok(tabs.querySelector(".reader-bar-tools-popup .reader-version-compare-menu"), "版本列表从「对照」后面弹出来");
  assert.equal(tabs.querySelector('[data-bar-tool="compare"]').getAttribute("aria-expanded"), "true");
  await act(async () => { doc.getElementById("page").dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })); });
  assert.equal(doc.querySelector(".reader-version-compare-menu"), null, "点外面收起");
  const inkButton = bottom.querySelector('[data-bar-tool="ink"]');
  assert.ok(inkButton.querySelector(".dot") && !inkButton.querySelector("svg"), "画笔前面是小圆点，不是钢笔图标");
  assert.equal(inkButton.querySelector(".reader-bar-tool-label").textContent, "画笔", "底栏带字");
  await click(inkButton);
  assert.equal(pen, 1, "主按钮照旧进出画笔");
  assert.equal(doc.querySelector(".pen-options"), null, "平时不展开选项");
  await click(bottom.querySelector('[data-bar-tool-caret="ink"]'));
  assert.ok(bottom.querySelector(".reader-bar-tools-popup .pen-options"), "▾ 弹出画笔的选项");
  await act(async () => { root.render(bars(false)); });
  assert.equal(doc.querySelector('[data-bar-tool="compare"]'), null, "只有一份译文时没有对比");
  root.unmount();
  dom.window.close();
});
