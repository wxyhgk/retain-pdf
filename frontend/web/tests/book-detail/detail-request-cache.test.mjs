// 书籍详情少发请求：覆盖情况等任务列表回来再取、再打开同一本书用缓存；跑完任务的流程图读一次就记住。
import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom as makeDomWith } from "../helpers/dom.mjs";
import { createBookDetailCaches } from "../../src/features/book-detail/domain/book-detail-caches.js";

const makeDom = () => makeDomWith("", {
  html: "<!doctype html><html><body><div id='root'></div></body></html>",
  keys: ["window", "document", "HTMLElement", "Element", "Event", "Node", "MutationObserver"],
});
const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

test("覆盖情况：任务列表没回来不请求；回来请求一次；关掉再开同一本书直接显示、不再请求", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useTranslationCoverage } = await import("../../src/features/book-detail/ui/use-translation-coverage.js");
  const caches = createBookDetailCaches();
  let calls = 0;
  const fetchCoverage = async () => { calls += 1; return { page_count: 6, translated_pages: 6 }; };
  let seen = null;
  function Host(props) {
    seen = useTranslationCoverage({ documentId: "doc-1", cache: caches.coverage, fetchCoverage, ...props });
    return null;
  }
  const jobs = [{ job_id: "j1", status: "succeeded" }];
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Host, { open: true, jobs: [{ job_id: "j1" }], ready: false }));
  await tick();
  assert.equal(calls, 0, "任务列表还没回来，不请求");
  root.render(React.createElement(Host, { open: true, jobs, ready: true }));
  await waitFor(() => seen?.translated_pages === 6, "拿到覆盖");
  assert.equal(calls, 1);

  root.render(React.createElement(Host, { open: false, jobs, ready: true }));
  await tick();
  root.render(React.createElement(Host, { open: true, jobs, ready: false }));
  await tick();
  assert.equal(seen?.translated_pages, 6, "再打开先显示上次的结果");
  root.render(React.createElement(Host, { open: true, jobs, ready: true }));
  await tick();
  assert.equal(calls, 1, "任务状态没变，不再请求");
  root.render(React.createElement(Host, { open: true, jobs: [{ job_id: "j1", status: "succeeded" }, { job_id: "j2", status: "succeeded" }], ready: true }));
  await waitFor(() => calls === 2, "多了一个任务，重新请求");
  root.unmount();
});

test("编辑部流程图：跑完的任务读一次就记住，再挂载不再拉事件", async () => {
  const dom = makeDom();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useEditorialFlow } = await import("../../src/features/book-detail/ui/use-editorial-flow.js");
  const caches = createBookDetailCaches();
  let calls = 0;
  const fetchEvents = async () => {
    calls += 1;
    return { items: [{ substage: "refining", stage_detail: "完成", payload: { observation: { refine_phase: "done", refine_mode: "editorial" } } }] };
  };
  let seen = null;
  function Host() {
    seen = useEditorialFlow("job-done", { enabled: true, poll: false, jobActive: false, cache: caches.settledFlows, fetchEvents });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Host));
  await waitFor(() => seen?.finished === true, "第一次读到");
  root.unmount();
  const root2 = createRoot(dom.window.document.getElementById("root"));
  root2.render(React.createElement(Host));
  await tick();
  assert.equal(seen?.finished, true, "再挂载直接有");
  assert.equal(calls, 1, "没有再拉事件");
  root2.unmount();
});
