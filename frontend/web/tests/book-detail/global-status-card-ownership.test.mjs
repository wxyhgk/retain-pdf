// 书籍详情「进度」页「查看实时译文」只能打开属于这本书的任务。
//
// 全局 statusCard 只有一张，播的是最近一次被轮询的任务 —— 可能是另一本书的。
// TranslateProgress 原来优先用卡片的 jobId（cardJobId || jobId），另一本书在跑时点它会
// 打开另一本书。修法：只有卡片的 jobId 在本书的 documentJobs.jobs 里时才用。
// （结果操作行同类问题见 processing-result-actions-ownership.test.mjs。）
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";

function fakeServices(cardSnapshot) {
  return {
    library: { actions: { attachJobProgress() {} } },
    statusCard: { store: { getSnapshot: () => ({ snapshot: cardSnapshot }), subscribe: () => () => {} } },
    statusDetail: { controller: { openStatusDetailDialog: () => {} } },
    reader: { openReader: () => {} },
  };
}

async function mountProgressPanel(dom, { cardSnapshot, props }) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { withHomeProviders } = await import("../helpers/home-providers.mjs");
  const { BookTranslateProgressPanel } = await import(
    "../../src/features/book-detail/ui/panels/translate/TranslateProgress.js"
  );
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  root.render(await withHomeProviders(React, fakeServices(cardSnapshot), React.createElement(BookTranslateProgressPanel, props)));
  const button = await waitFor(
    () => host.querySelector(".home-book-live-translation-entry"),
    "「查看实时译文」就位",
  );
  return { root, host, button };
}

const RUNNING_ITEM = { job_id: "job-this-book", document_id: "doc-this", status: "running" };

test("查看实时译文：全局卡片在播另一本书的任务时，打开本书自己的任务", async () => {
  const dom = makeDom();
  const opened = [];
  const { root, host, button } = await mountProgressPanel(dom, {
    cardSnapshot: { jobId: "job-other-book", status: "running" },
    props: {
      item: RUNNING_ITEM,
      documentJobIds: ["job-this-book"],
      onOpenLiveReader: (jobId) => opened.push(jobId),
    },
  });
  button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert.deepEqual(opened, ["job-this-book"], "点本书的「查看实时译文」打开了另一本书的任务");
  root.unmount(); host.remove();
});

test("查看实时译文：全局卡片的任务属于本书（如刚提交的重试）时，仍跟卡片", async () => {
  const dom = makeDom();
  const opened = [];
  const { root, host, button } = await mountProgressPanel(dom, {
    cardSnapshot: { jobId: "job-this-book-retry", status: "running" },
    props: {
      item: RUNNING_ITEM,
      documentJobIds: ["job-this-book", "job-this-book-retry"],
      onOpenLiveReader: (jobId) => opened.push(jobId),
    },
  });
  button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert.deepEqual(opened, ["job-this-book-retry"]);
  root.unmount(); host.remove();
});
