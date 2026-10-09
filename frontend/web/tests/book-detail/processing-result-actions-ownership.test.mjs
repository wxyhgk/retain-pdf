// 书籍详情「进度」页的结果操作行（下载 / 对照阅读）读的是全局 statusCard，只能挂属于
// 这本书的任务。
//
// 全局 statusCard 只有一张，播的是最近一次被轮询的任务 —— 可能是另一本书的。打开一本
// 已完成的书时详情不会 attach 它自己的任务，旧代码就把另一本书的产物按钮挂了上来。
// 修法：只有卡片的 jobId 在本书的 documentJobs.jobs 里时才渲染。
//
// 单独一个文件：和直接挂组件的用例放在同一个文件里时，后挂的 HomeApp 会停摆。
import test from "node:test";
import assert from "node:assert/strict";
import { wait, waitFor } from "../helpers/async.mjs";
import { byId, clickWithMouseDown, makeDom } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

const RESULT_ACTIONS = ".book-detail-processing-result-actions";

async function pollUntilReady(services, jobId) {
  services.features.jobRuntimeFeature.startPolling(jobId);
  await waitFor(() => {
    const snapshot = services.statusCard.store.getSnapshot().snapshot;
    return `${snapshot?.jobId || ""}` === jobId && Boolean(snapshot?.pdfReady || snapshot?.readerReady);
  }, "全局卡片拿到该任务的就绪产物");
}

async function openProcessingTabOf(dom, services, item) {
  services.library.actions.openBookDetail(item);
  await waitFor(() => byId(dom, "book-detail-dialog"), "书籍详情弹窗打开");
  clickWithMouseDown(dom, byId(dom, "book-detail-tab-processing"), { cancelable: true });
  await waitFor(() => byId(dom, "book-detail-panel-processing")?.hidden === false, "切到「进度」Tab");
}

const libraryItems = (services) => services.library.recentJobsStore.getSnapshot?.().items || [];

test("进度页结果操作行：全局卡片是另一本书的任务时，不把它的下载 / 对照阅读挂到这本书上", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom, { readyId: "library-add-pdf-btn" });
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const runningJobId = getMockJobId();
  await pollUntilReady(services, runningJobId);

  const runningDocumentId = () => `${libraryItems(services).find((row) => `${row?.job_id || ""}` === runningJobId)?.document_id || ""}`;
  const otherBook = await waitFor(
    () => libraryItems(services).find((row) => (
      `${row?.status || ""}` === "succeeded"
      && `${row?.job_id || ""}`.trim()
      && `${row?.job_id || ""}` !== runningJobId
      && `${row?.document_id || ""}` !== runningDocumentId()
    )),
    "书架上有另一本已完成的书",
  );
  await openProcessingTabOf(dom, services, otherBook);
  await waitFor(
    () => byId(dom, "book-detail-panel-processing")?.querySelector("[data-processing-unified-status]")?.textContent?.includes("已完成"),
    "本书任务列表已加载",
  );
  await wait(100);

  assert.equal(
    services.statusCard.store.getSnapshot().snapshot?.jobId,
    runningJobId,
    "前提：全局卡片仍是另一本书的任务",
  );
  assert.equal(Boolean(dom.window.document.querySelector(RESULT_ACTIONS)), false, "另一本书的结果操作行挂到了这本书的进度页");
  assert.equal(Boolean(byId(dom, "pdf-btn")), false, "另一本书的「下载 PDF」挂到了这本书的进度页");

  root.unmount();
  services.dispose();
  host.remove();
});

test("进度页结果操作行：全局卡片就是本书的任务时照常显示", async () => {
  const dom = makeDom("?mock=done");
  const { services, root, host } = await bootHomeApp(dom, { readyId: "library-add-pdf-btn" });
  const { getMockJobId } = await import("@/platform/mock/index.js");
  const runningJobId = getMockJobId();
  await pollUntilReady(services, runningJobId);

  const ownBook = await waitFor(
    () => libraryItems(services).find((row) => `${row?.job_id || ""}` === runningJobId),
    "书架出现被轮询任务所属的书",
  );
  await openProcessingTabOf(dom, services, ownBook);
  await waitFor(() => dom.window.document.querySelector(RESULT_ACTIONS), "本书自己的结果操作行显示");
  assert.ok(byId(dom, "pdf-btn"), "本书自己的「下载 PDF」应在");

  root.unmount();
  services.dispose();
  host.remove();
});
