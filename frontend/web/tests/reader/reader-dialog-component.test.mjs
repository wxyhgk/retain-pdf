import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// ReaderDialog 已改为「跳转 reader.html」，不再挂 iframe 对话框。

function makeDom(search = "") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `http://localhost/index.html${search}`,
  });
  for (const key of [
    "window",
    "document",
    "DocumentFragment",
    "HTMLElement",
    "HTMLButtonElement",
    "HTMLFormElement",
    "CustomEvent",
    "Event",
    "Node",
    "MutationObserver",
    "NodeFilter",
  ]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      writable: true,
      configurable: true,
    });
  }
  globalThis.window = dom.window;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  return dom;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await wait(15);
  }
  assert.fail(`等待超时：${description}`);
}

async function bootHomeApp(dom) {
  const { createRoot } = await import("react-dom/client");
  const React = await import("react");
  const { createHomeComposition } = await import("../../src/app/home/create-home-composition.js");
  const { HomeApp } = await import("../../src/app/home/HomeApp.jsx");

  const host = dom.window.document.createElement("div");
  host.id = "home-root";
  dom.window.document.body.appendChild(host);

  const services = createHomeComposition({
    fetchGlossaries: async () => ({ items: [] }),
    loadPersistedDeveloperConfig: () => ({}),
    loadPersistedBrowserConfig: () => ({}),
  });
  services.initialize();

  const root = createRoot(host);
  root.render(React.createElement(HomeApp, { services }));
  await waitFor(() => dom.window.document.getElementById("app-shell"), "HomeApp 首帧");
  await wait(0);
  return { services, root, host };
}

afterEach(async () => {
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests(null);
});

test("openReaderRequested：跳转到 reader.html?job_id=（非 iframe）", async () => {
  const dom = makeDom("?mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);
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
  const dom = makeDom("?mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);
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
  const dom = makeDom("?mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);
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
  const dom = makeDom("?view=reader&job_id=job-deep&mock=parallel");
  const hits = { assign: [], replace: [] };
  const { setReaderNavigateForTests } = await import(
    "../../src/features/reader/domain.ts"
  );
  // 必须在 boot 前注入：深链在 ReaderDialog mount effect 里触发
  setReaderNavigateForTests((url, { replace } = {}) => {
    if (replace) hits.replace.push(url);
    else hits.assign.push(url);
  });

  const { root, host, services } = await bootHomeApp(dom);

  await waitFor(() => hits.replace.length > 0, "深链应 replace");
  assert.match(hits.replace[0], /reader\.html\?.*job_id=job-deep/);

  root.unmount();
  services.dispose();
  host.remove();
});

test("retry-stage handoff replaces the open soft Reader job and preserves its anchor", async () => {
  const dom = makeDom("?mock=parallel");
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
  const dom = makeDom("?mock=parallel");
  const { root, host, services } = await bootHomeApp(dom);
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
  const dom = makeDom("?mock=parallel");
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
