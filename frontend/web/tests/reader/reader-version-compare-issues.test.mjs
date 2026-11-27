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

test("悬浮小球：点开是 Markdown 和「对比版本」两颗图标；点对比弹版本列表；只有一份译文时没有对比；点外面收起", async () => {
  const { makeDom } = await import("../helpers/dom.mjs");
  const dom = makeDom("", { html: "<!doctype html><html><body><div id='root'></div><div id='page'></div></body></html>" });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const { ReaderToolBall } = await import("../../../packages/reader/src/components/react-pdf/ReaderToolBall.tsx");
  // 2026-11-27 起「对比版本」是扩展：按钮经贡献表进小球。这里用扩展自己的那颗按钮登记进一张表。
  const { compareToolbarItem } = await import("../../../packages/reader/src/extensions/builtin/compare.tsx");
  const { createContributionStore, ReaderExtensionsProvider } = await import("../../../packages/reader/src/extensions/registry.tsx");
  const store = createContributionStore();
  const api = { documentId: "d", jobId: "j1", versionId: "tv-a", translationVersions: [], regions: [], metadata: null, bookmarks: [], pageCount: 1, resetKey: "k",
    hoveredItemId: () => null, goToPage() {}, sourceOnly: false, activePanel: null, closePanel() {}, visibleMode: "source", setWorkspace() {} };
  const ball = (available) => {
    const item = compareToolbarItem(compare(available));
    store.set("compare", "对比版本", { toolbarItems: item ? [item] : [] });
    return React.createElement(ReaderExtensionsProvider, { api, store }, React.createElement(ReaderToolBall, { active: null }));
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
  await act(async () => { root.render(ball(true)); });
  assert.equal(doc.querySelector(".reader-toolball-stack"), null, "一开始收着");
  await click(doc.querySelector(".reader-toolball-ball"));
  assert.ok(doc.querySelector(".reader-toolball-stack .reader-panel-toggle"), "Markdown 在小球里");
  await click(doc.querySelector('[data-toolball-item="compare"]'));
  assert.ok(doc.querySelector(".reader-version-compare-menu"), "版本列表弹出来");
  await act(async () => { doc.getElementById("page").dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })); });
  assert.equal(doc.querySelector(".reader-toolball-stack"), null, "点外面收起");
  await act(async () => { root.render(ball(false)); });
  await click(doc.querySelector(".reader-toolball-ball"));
  assert.equal(doc.querySelector('[data-toolball-item="compare"]'), null, "只有一份译文时没有对比");
  root.unmount();
  dom.window.close();
});
