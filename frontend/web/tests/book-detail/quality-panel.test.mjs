// 「译文质量」卡组件：显示几行、展开明细、点一条打开阅读页并跳到那一块。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { clickWithMouseDown, makeDom as makeDomWith } from "../helpers/dom.mjs";

test("展开「排版」明细（通用取数接口），点一条打开阅读页对应的页和块", async () => {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "HTMLButtonElement", "Element", "SVGElement", "Event", "MouseEvent", "Node", "MutationObserver"],
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QualityPanel } = await import("../../src/features/book-detail/ui/panels/overview/QualityPanel.jsx");
  const mocks = await import("../../src/platform/api/mocks/quality.js");
  const jobData = await import("../../src/platform/api/mocks/job-data.js");
  const { createQualityListLoader } = await import("../../src/features/book-detail/ui/quality-list-loader.js");
  const { setReaderNavigateForTests } = await import("../../src/features/reader/domain.js");
  const opened = [];
  setReaderNavigateForTests((url) => opened.push(url));
  const kinds = [];
  const loadList = createQualityListLoader(jobData.fetchJobData);
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(QualityPanel, {
    jobId: "job-1",
    documentId: "doc-1",
    loadSummary: mocks.fetchQualitySummary,
    loadItems: (jobId, kind) => { kinds.push(kind); return loadList(jobId, kind); },
  }));
  const doc = dom.window.document;
  await waitFor(() => doc.querySelector('[data-quality-row="layout"]'), "排版一行");
  assert.match(doc.querySelector(".book-detail-quality-attention").textContent, /要看/);
  assert.equal(doc.querySelectorAll(".book-detail-quality-warnings li").length, 2);

  clickWithMouseDown(dom, doc.querySelector('[data-quality-row="layout"] [data-quality-toggle="layout"]'));
  const first = await waitFor(() => doc.querySelector('[data-quality-list="layout"] .book-detail-quality-list-item'), "明细");
  assert.match(first.textContent, /第 12 页.*溢出/);
  assert.deepEqual(kinds, ["layout"]);
  clickWithMouseDown(dom, first);
  assert.equal(opened.length, 1);
  const url = new URL(opened[0], "http://x/");
  assert.equal(url.searchParams.get("job_id"), "job-1");
  assert.equal(url.searchParams.get("page_idx"), "11", "页码从 1 数，page_idx 从 0 数");
  assert.equal(url.searchParams.get("block_id"), "p012-b0004");
  setReaderNavigateForTests(null);
  root.unmount();
});

test("还没有报告（读失败以外）时整张卡不出现", async () => {
  const dom = makeDomWith("", {
    html: "<!doctype html><html><body><div id='root'></div></body></html>",
    keys: ["window", "document", "HTMLElement", "Element", "SVGElement", "Event", "Node", "MutationObserver"],
  });
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QualityPanel } = await import("../../src/features/book-detail/ui/panels/overview/QualityPanel.jsx");
  const root = createRoot(dom.window.document.getElementById("root"));
  let resolved = false;
  root.render(React.createElement(QualityPanel, {
    jobId: "job-2", documentId: "doc-2",
    loadSummary: async () => { resolved = true; return { job_id: "job-2", preparation: null, qa: null, layout: null, refine: null, untranslated: { failed: 0, formula: 0, model_kept: 0, other: 0 } }; },
  }));
  await waitFor(() => resolved, "读过摘要");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(dom.window.document.querySelector("[data-book-quality]"), null);
  root.unmount();
});
