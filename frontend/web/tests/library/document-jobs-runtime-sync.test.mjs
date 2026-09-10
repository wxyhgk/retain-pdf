import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { createStore } from "../../src/platform/store/store.js";
import {
  mergeRuntimeDocumentJob,
  runtimeDocumentJob,
  selectLatestDocumentJob,
  upsertDocumentJob,
  useDocumentJobs,
} from "../../src/features/book-detail/ui/use-document-jobs.js";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await wait(10);
  }
  assert.fail(`等待超时：${description}`);
}

test("documentJobs upsert 保留任务身份并合并 runtime 状态", () => {
  const queued = upsertDocumentJob([], {
    job_id: "job-sync",
    workflow: "translate",
    status: "queued",
  }, "doc-sync");
  const runtime = runtimeDocumentJob({
    jobId: "job-sync",
    snapshot: { job_id: "job-sync", status: "running", display_stage: "translation" },
  });
  const merged = upsertDocumentJob(queued, runtime, "doc-sync");

  assert.equal(merged.length, 1);
  assert.equal(merged[0].document_id, "doc-sync");
  assert.equal(merged[0].workflow, "translate");
  assert.equal(merged[0].status, "running");
  assert.equal(merged[0].display_stage, "translation");
});

test("同 job runtime 不可把 OCR 身份改写成翻译任务", () => {
  const [job] = upsertDocumentJob(
    [{ job_id: "job-ocr", document_id: "doc-ocr", workflow: "ocr", status: "queued" }],
    { job_id: "job-ocr", workflow: "book", status: "succeeded" },
    "doc-ocr",
  );
  assert.equal(job.workflow, "ocr");
  assert.equal(job.status, "succeeded");
});

test("latest document job 以 created_at 决定，旧 failed 不覆盖新提交", () => {
  const selected = selectLatestDocumentJob([
    {
      job_id: "job-old-failed",
      workflow: "book",
      status: "failed",
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-02T12:00:00Z",
    },
    {
      job_id: "job-new-running",
      workflow: "translate",
      status: "running",
      created_at: "2026-09-02T10:00:00Z",
      updated_at: "2026-09-02T10:00:01Z",
    },
  ], (job) => ["book", "translate"].includes(job.workflow));

  assert.equal(selected?.job_id, "job-new-running");
});

test("轮询首帧占位不能把已完成 OCR 降级为处理中", () => {
  const completed = [{
    job_id: "job-ocr-completed",
    document_id: "doc-ocr-completed",
    workflow: "ocr",
    status: "succeeded",
  }];
  const bootstrap = runtimeDocumentJob({
    jobId: "job-ocr-completed",
    snapshot: {
      job_id: "job-ocr-completed",
      status: "queued",
      stage_detail: "正在读取任务状态...",
    },
  });

  const preserved = mergeRuntimeDocumentJob(
    completed,
    bootstrap,
    "doc-ocr-completed",
  );
  assert.equal(preserved[0].status, "succeeded");

  const running = mergeRuntimeDocumentJob(completed, {
    ...bootstrap,
    status: "running",
    stage_detail: "OCR 处理中",
  }, "doc-ocr-completed");
  assert.equal(running[0].status, "running", "真实 runtime 状态仍应覆盖旧终态");
});

test("useDocumentJobs 以 runtime 为活态真相，提交竞态不丢任务，终态只对账一次", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of ["window", "document", "HTMLElement", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const runtimeStore = createStore({
    name: "documentJobsRuntimeTest",
    initialState: { jobId: "", snapshot: null },
    actions: {
      setCurrent(_state, payload) {
        return payload;
      },
    },
  });

  let documentRequestCount = 0;
  const succeededJobs = [];
  const actions = {
    async getDocumentJobs() {
      documentRequestCount += 1;
      if (documentRequestCount >= 3) {
        return {
          items: [{
            job_id: "job-sync",
            document_id: "doc-sync",
            workflow: "translate",
            status: "succeeded",
            stages: {
              ocr: { state: "reused" },
              translation: { state: "completed" },
              render: { state: "completed" },
            },
          }],
        };
      }
      // 模拟提交后 document-scoped API 尚未看到新任务。
      return { items: [] };
    },
  };

  let hookState = null;
  function Harness() {
    hookState = useDocumentJobs({
      open: true,
      documentId: "doc-sync",
      actions,
      initialJob: { document_id: "doc-sync", job_id: "doc:doc-sync", library_only: true },
      runtimeStore,
      refreshIntervalMs: 0,
      onJobSucceeded(job) {
        succeededJobs.push(job.job_id);
      },
    });
    return React.createElement("output", null, hookState.latestTranslation?.status || "idle");
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  await waitFor(() => documentRequestCount === 1 && hookState, "初始文档任务读取");

  hookState.upsert({
    job_id: "job-sync",
    document_id: "doc-sync",
    workflow: "translate",
    status: "queued",
  });
  await waitFor(() => hookState.latestTranslation?.status === "queued", "提交结果即时 upsert");

  await hookState.refresh({ quiet: true });
  assert.equal(documentRequestCount, 2);
  assert.equal(hookState.latestTranslation?.status, "queued", "空的竞态响应不能冲掉刚提交任务");

  runtimeStore.actions.setCurrent({
    jobId: "job-sync",
    snapshot: {
      job_id: "job-sync",
      document_id: "doc-sync",
      workflow: "translate",
      status: "running",
      display_stage: "translation",
    },
  });
  await waitFor(() => hookState.latestTranslation?.status === "running", "runtime 推进外层面板");

  runtimeStore.actions.setCurrent({
    jobId: "job-sync",
    snapshot: {
      job_id: "job-sync",
      document_id: "doc-sync",
      workflow: "translate",
      status: "succeeded",
      display_stage: "done",
    },
  });
  await waitFor(
    () => documentRequestCount === 3 && hookState.latestTranslation?.stages?.render?.state === "completed",
    "终态触发一次 document-scoped 对账",
  );
  await wait(40);
  assert.equal(documentRequestCount, 3, "终态稳定后不能继续独立轮询");
  assert.equal(hookState.latestTranslation.status, "succeeded");
  assert.equal(hookState.succeededRevision, 1, "成功转换发布一次调用方刷新修订");
  assert.equal(hookState.lastSucceededJobId, "job-sync");
  assert.deepEqual(succeededJobs, ["job-sync"]);

  root.unmount();
  dom.window.close();
});

test("useDocumentJobs 持续对账 document jobs 并在服务端成功时只发一次信号", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of ["window", "document", "HTMLElement", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  let requestCount = 0;
  let successCount = 0;
  let hookState = null;
  const actions = {
    async getDocumentJobs() {
      requestCount += 1;
      return {
        items: [{
          job_id: "job-polled",
          document_id: "doc-polled",
          workflow: "translate",
          status: requestCount === 1 ? "running" : "succeeded",
          created_at: "2026-09-02T11:00:00Z",
        }],
      };
    },
  };

  function Harness() {
    hookState = useDocumentJobs({
      open: true,
      documentId: "doc-polled",
      actions,
      refreshIntervalMs: 15,
      onJobSucceeded() {
        successCount += 1;
      },
    });
    return React.createElement("output", null, hookState.latestTranslation?.status || "idle");
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  await waitFor(
    () => requestCount >= 3 && hookState?.latestTranslation?.status === "succeeded",
    "持续 GET 推进到成功",
  );
  await wait(35);
  assert.ok(requestCount >= 4, "打开期间继续静默刷新 document jobs");
  assert.equal(hookState.succeededRevision, 1);
  assert.equal(successCount, 1, "重复成功响应不能重复通知调用方");

  root.unmount();
  dom.window.close();
});

test("静默轮询接管慢速首请求后会结束首次 loading", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of ["window", "document", "HTMLElement", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  let requestCount = 0;
  let resolveFirst;
  let hookState = null;
  const actions = {
    getDocumentJobs() {
      requestCount += 1;
      if (requestCount === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ items: [] });
    },
  };

  function Harness() {
    hookState = useDocumentJobs({
      open: true,
      documentId: "doc-slow",
      actions,
      refreshIntervalMs: 15,
    });
    return React.createElement("output", null, hookState.loading ? "loading" : "ready");
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  await waitFor(() => hookState?.loading && requestCount === 1, "首次读取进入 loading");
  await waitFor(() => requestCount >= 2 && hookState?.loading === false, "静默轮询结束首次 loading");
  resolveFirst?.({ items: [] });

  root.unmount();
  dom.window.close();
});

test("全局加号提交的 runtime 缺少 document_id 时会反查归属并立即显示进度", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/index.html",
  });
  for (const key of ["window", "document", "HTMLElement", "Node", "MutationObserver"]) {
    Object.defineProperty(globalThis, key, {
      value: dom.window[key] ?? dom.window,
      configurable: true,
      writable: true,
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const runtimeStore = createStore({
    name: "ownerlessDocumentJobRuntimeTest",
    initialState: {
      jobId: "job-from-plus",
      snapshot: {
        job_id: "job-from-plus",
        workflow: "book",
        status: "running",
        display_stage: "translation",
        progress: { current: 3, total: 10, percent: 30 },
      },
    },
    actions: {},
  });

  let ownerRequestCount = 0;
  let hookState = null;
  const actions = {
    async getDocumentJobs() {
      // 模拟 document-scoped 投影还没看到刚提交的任务。
      return { items: [] };
    },
    async getDocumentByJobId(jobId) {
      ownerRequestCount += 1;
      assert.equal(jobId, "job-from-plus");
      return { document_id: "doc-from-plus" };
    },
  };

  function Harness() {
    hookState = useDocumentJobs({
      open: true,
      documentId: "doc-from-plus",
      actions,
      initialJob: {
        document_id: "doc-from-plus",
        job_id: "doc:doc-from-plus",
        library_only: true,
      },
      runtimeStore,
      refreshIntervalMs: 0,
    });
    return React.createElement("output", null, hookState.latestTranslation?.status || "idle");
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(React.createElement(Harness));
  await waitFor(
    () => hookState?.latestTranslation?.job_id === "job-from-plus",
    "通过 job_id 解析文档归属后合并运行进度",
  );

  assert.equal(ownerRequestCount, 1);
  assert.equal(hookState.latestTranslation.document_id, "doc-from-plus");
  assert.equal(hookState.latestTranslation.status, "running");
  assert.equal(hookState.latestTranslation.progress.percent, 30);

  root.unmount();
  dom.window.close();
});
