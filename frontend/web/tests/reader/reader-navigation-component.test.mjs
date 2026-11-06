import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "../helpers/async.mjs";
import { makeDom } from "../helpers/dom.mjs";
import { bootHomeApp } from "../helpers/home-app.mjs";

// ReaderNavigation 已改为「跳转 reader.html」，不再挂 iframe 对话框。

// 这组用例一直只装下面这些全局、也没装 getComputedStyle；保持原样，免得多装的全局
// 改变被测组件走的分支。
const NAV_DOM = {
  keys: [
    "window", "document", "DocumentFragment", "HTMLElement", "HTMLButtonElement",
    "HTMLFormElement", "CustomEvent", "Event", "Node", "MutationObserver", "NodeFilter",
  ],
  computedStyle: false,
};

// 用 act 渲染，保证 useAppEvent 的订阅 effect 已挂上；只在这一次渲染期间打开 act 环境，
// 免得同文件里不走 act 的整页用例刷「not wrapped in act」警告。
async function renderFlushingEffects(React, root, element) {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await React.act(async () => root.render(element));
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

afterEach(async () => {
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests(null);
});

test("openReaderRequested：一本书翻译过多次时，打开后端给的合并结果而不是 active_job_id", async () => {
  const dom = makeDom("", NAV_DOM);
  const hits = { assign: [], replace: [] };
  const asked = [];
  const merged = `merged-${"a".repeat(64)}-0123456789abcdef`;
  const { setReaderNavigateForTests } = await import("../../src/features/reader/domain.ts");
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { ReaderNavigation } = await import("../../src/features/reader/index.js");
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  // 等 useAppEvent 的订阅 effect 真的挂上再派发事件（固定 wait 在全量并发跑时会丢事件）。
  await renderFlushingEffects(React, root,
    React.createElement(ReaderNavigation, {
      fetchReading: async (documentId) => {
        asked.push(documentId);
        return { job_id: merged };
      },
    }),
  );
  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { jobId: "job-latest-range", documentId: "doc-1", pageIdx: null, blockId: "" },
    }),
  );

  await waitFor(() => hits.assign.length > 0, "应导航到阅读页");
  assert.deepEqual(asked, ["doc-1"]);
  assert.match(hits.assign[0], new RegExp(`job_id=${merged}`));
  assert.doesNotMatch(hits.assign[0], /job-latest-range/);

  root.unmount();
  host.remove();
});

test("openReaderRequested：pinJob 点名的任务原样打开，不去问 /documents/:id/reading", async () => {
  const dom = makeDom("", NAV_DOM);
  const hits = { assign: [], replace: [] };
  const asked = [];
  const { setReaderNavigateForTests } = await import("../../src/features/reader/domain.ts");
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { ReaderNavigation } = await import("../../src/features/reader/index.js");
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await renderFlushingEffects(React, root,
    React.createElement(ReaderNavigation, {
      fetchReading: async (documentId) => {
        asked.push(documentId);
        return { job_id: "job-translate-old" };
      },
    }),
  );
  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { jobId: "job-ocr-1", documentId: "doc-1", pageIdx: null, blockId: "", pinJob: true },
    }),
  );

  await waitFor(() => hits.assign.length > 0, "应导航到阅读页");
  assert.deepEqual(asked, [], "点名任务时不该去问后端");
  assert.match(hits.assign[0], /job_id=job-ocr-1/);
  assert.doesNotMatch(hits.assign[0], /job-translate-old/, "被换成了整本最新译文");

  root.unmount();
  host.remove();
});

test("openReaderRequested：跳转到 reader.html?job_id=（非 iframe）", async () => {
  const dom = makeDom("?mock=parallel", NAV_DOM);
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom, { readyDescription: "HomeApp 首帧" });
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  assert.equal(dom.window.document.getElementById("reader-dialog"), null, "不再挂阅读对话框");

  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { jobId: "job-demo-1", pageIdx: null, blockId: "" },
    }),
  );

  await waitFor(() => hits.assign.length > 0, "应导航到阅读页");
  assert.match(hits.assign[0], /reader\.html\?.*job_id=job-demo-1/);
  assert.equal(hits.replace.length, 0, "事件打开用 assign 不是 replace");

  root.unmount();
  services.dispose();
  host.remove();
});

test("openReaderRequested：馆藏 document_id 跳转读原文", async () => {
  const dom = makeDom("?mock=parallel", NAV_DOM);
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom, { readyDescription: "HomeApp 首帧" });
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");

  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { documentId: "doc-abc", pageIdx: null, blockId: "" },
    }),
  );

  await waitFor(() => hits.assign.length > 0, "应导航到 document 阅读");
  assert.match(hits.assign[0], /reader\.html\?.*document_id=doc-abc/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("openReaderRequested：同时有 document/job 时以 job 路由打开对照与实时译文", async () => {
  const dom = makeDom("?mock=parallel", NAV_DOM);
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom, { readyDescription: "HomeApp 首帧" });
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");
  dom.window.document.dispatchEvent(
    new dom.window.CustomEvent(APP_EVENTS.openReaderRequested, {
      detail: { documentId: "doc-stable", jobId: "job-attempt", pageIdx: 3 },
    }),
  );

  await waitFor(() => hits.assign.length > 0, "应导航到任务阅读页");
  const opened = new URL(hits.assign[0]);
  assert.equal(opened.searchParams.get("job_id"), "job-attempt");
  assert.equal(opened.searchParams.get("document_id"), null);
  assert.equal(opened.searchParams.get("page_idx"), "3");

  root.unmount();
  services.dispose();
  host.remove();
});

test("深链 ?view=reader&job_id=：replace 到 reader.html", async () => {
  const dom = makeDom("?view=reader&job_id=job-deep&mock=parallel", NAV_DOM);
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  // 必须在 boot 前注入：深链在 ReaderNavigation mount effect 里触发
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom, { readyDescription: "HomeApp 首帧" });

  await waitFor(() => hits.replace.length > 0, "深链应 replace");
  assert.match(hits.replace[0], /reader\.html\?.*job_id=job-deep/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("retry-stage handoff replaces the open soft Reader job and preserves its anchor", async () => {
  const dom = makeDom("?mock=parallel", NAV_DOM);
  const appShell = dom.window.document.createElement("div");
  appShell.id = "app-shell";
  dom.window.document.body.appendChild(appShell);
  const {
    SOFT_READER_HISTORY_FLAG,
    SOFT_READER_OPEN_EVENT,
    handoffSoftReaderJob,
  } = await import("../../src/platform/navigation/soft-reader.ts");
  const currentReaderUrl = "http://localhost/reader.html?job_id=job-old&page_idx=6&block_id=p007-b0002&mock=parallel";
  dom.window.history.replaceState({
    [SOFT_READER_HISTORY_FLAG]: true,
    readerUrl: currentReaderUrl,
  }, "", currentReaderUrl);
  const opened = [];
  dom.window.addEventListener(SOFT_READER_OPEN_EVENT, (event) => opened.push(event.detail.url));

  assert.equal(handoffSoftReaderJob({
    previousJobId: "job-old",
    nextJobId: "job-new",
    documentId: "doc-1",
  }), true);
  const next = new URL(dom.window.history.state.readerUrl);
  assert.equal(next.searchParams.get("job_id"), "job-new");
  assert.equal(next.searchParams.get("page_idx"), "6");
  assert.equal(next.searchParams.get("block_id"), "p007-b0002");
  assert.equal(next.searchParams.get("mock"), "parallel");
  assert.equal(opened.length, 1);
  assert.equal(new URL(opened[0]).searchParams.get("job_id"), "job-new");
  dom.window.close();
});

test("library job replacement automatically hands an open Reader to the new job", async () => {
  const dom = makeDom("?mock=parallel", NAV_DOM);
  const { root, host, services } = await bootHomeApp(dom, { readyDescription: "HomeApp 首帧" });
  const { APP_EVENTS } = await import("@/platform/contracts/app-contract.js");
  const {
    SOFT_READER_HISTORY_FLAG,
    SOFT_READER_OPEN_EVENT,
  } = await import("../../src/platform/navigation/soft-reader.ts");
  const currentReaderUrl = "http://localhost/reader.html?job_id=job-retry-source&page_idx=2&mock=parallel";
  dom.window.history.replaceState({
    [SOFT_READER_HISTORY_FLAG]: true,
    readerUrl: currentReaderUrl,
  }, "", currentReaderUrl);
  const opened = [];
  dom.window.addEventListener(SOFT_READER_OPEN_EVENT, (event) => opened.push(event.detail.url));

  dom.window.document.dispatchEvent(new dom.window.CustomEvent(APP_EVENTS.libraryJobUpdated, {
    detail: {
      job: {
        job_id: "job-retry-next",
        active_job_id: "job-retry-next",
        source_job_id: "job-retry-source",
        document_id: "doc-1",
        status: "queued",
      },
    },
  }));

  await waitFor(() => opened.length === 1, "Reader 应接管 retry-stage 返回的新 job");
  const next = new URL(opened[0]);
  assert.equal(next.searchParams.get("job_id"), "job-retry-next");
  assert.equal(next.searchParams.get("page_idx"), "2");

  root.unmount();
  services.dispose();
  host.remove();
  dom.window.close();
});

test("retry-stage handoff keeps a canonical document Reader URL", async () => {
  const dom = makeDom("?mock=parallel", NAV_DOM);
  const appShell = dom.window.document.createElement("div");
  appShell.id = "app-shell";
  dom.window.document.body.appendChild(appShell);
  const {
    SOFT_READER_HISTORY_FLAG,
    SOFT_READER_OPEN_EVENT,
    handoffSoftReaderJob,
  } = await import("../../src/platform/navigation/soft-reader.ts");
  const currentReaderUrl = "http://localhost/reader.html?document_id=doc-1&page_idx=4&mock=parallel";
  dom.window.history.replaceState({
    [SOFT_READER_HISTORY_FLAG]: true,
    readerUrl: currentReaderUrl,
  }, "", currentReaderUrl);
  const opened = [];
  dom.window.addEventListener(SOFT_READER_OPEN_EVENT, (event) => opened.push(event.detail.url));

  assert.equal(handoffSoftReaderJob({
    previousJobId: "job-old",
    nextJobId: "job-new",
    documentId: "doc-1",
  }), true);
  const next = new URL(opened[0]);
  assert.equal(next.searchParams.get("document_id"), "doc-1");
  assert.equal(next.searchParams.get("job_id"), null);
  assert.equal(next.searchParams.get("page_idx"), "4");
  dom.window.close();
});
