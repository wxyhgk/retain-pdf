// 最近任务的各个 port（runtime / reader / navigation / workflow-open）、事件绑定、
// created 任务补全、runtime 装配与活动任务刷新。
// 从原 recent-jobs.test.mjs 拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { APP_DIALOG_IDS, APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { createRecentJobsStatePort } from "../../src/features/library/domain/recent-jobs/state.js";
import { bindRecentJobsFeatureEvents } from "../../src/features/library/domain/recent-jobs/bindings.js";
import { hydrateCreatedRecentJob } from "../../src/features/library/domain/recent-jobs/created-job-hydration.js";
import {
  createLibraryEventPort,
  requestThrottledLibraryRefresh,
} from "@/platform/contracts/library-event-contract.js";
import {
  createActiveLibraryRefreshLoop,
  recentJobsEligibleForActiveRefresh,
} from "../../src/features/library/domain/recent-jobs/active-refresh.js";
import {
  createRecentJobsRefreshEnvironment,
} from "../../src/features/library/domain/recent-jobs/refresh-environment.js";
import {
  isTranslationWorkflowDialogOpen,
} from "../../src/features/library/domain/recent-jobs/workflow-open-port.js";
import { createRecentJobActions } from "../../src/features/library/domain/recent-jobs/actions.js";
import { createRecentJobsRuntimePort } from "../../src/features/library/domain/recent-jobs/job-runtime-port.js";
import { createRecentJobsReaderPort } from "../../src/features/library/domain/recent-jobs/reader-port.js";
import { createRecentJobsNavigationPort } from "../../src/features/library/domain/recent-jobs/navigation-port.js";
import { createLibraryController } from "../../src/features/library/domain/controller.js";
import { createRecentJobsRuntime } from "../../src/features/library/domain/recent-jobs/runtime.js";

test("created recent job hydration fetches full payload and patches the card", async () => {
  const updates = [];
  const payload = await hydrateCreatedRecentJob({
    job: { job_id: "job-created" },
    apiPrefix: "/api",
    fetchJobPayload: async (jobId, options) => {
      const apiPrefix = typeof options === "string" ? options : options?.apiPrefix;
      return {
        job_id: jobId,
        apiPrefix,
        cover_url: `/api/v1/jobs/${jobId}/cover`,
        progress: { current: 1, total: 9 },
      };
    },
    runtimePatches: {
      update: (job) => updates.push(job),
    },
  });

  assert.equal(payload.job_id, "job-created");
  assert.equal(payload.apiPrefix, "/api");
  assert.deepEqual(updates, [payload]);
});

test("created recent job hydration is best effort", async () => {
  const updates = [];
  const payload = await hydrateCreatedRecentJob({
    job: { job_id: "job-created" },
    fetchJobPayload: async () => {
      throw new Error("not ready");
    },
    runtimePatches: {
      update: (job) => updates.push(job),
    },
  });

  assert.equal(payload, null);
  assert.deepEqual(updates, []);
});

test("recent jobs feature bindings route ui library and workflow events", () => {
  // 旧 DOM 直写 viewPort 已随 cutover 删除,bindEvents 的 handlers 直接从
  // viewPort stub 捕获调用,不再模拟 #load-more-jobs-btn 的 click 事件。
  const listeners = new Map();
  const loadCalls = [];
  const commandCalls = [];
  const schedulerCalls = [];
  const invalidateCalls = [];
  let viewPortHandlers = null;
  const viewPort = {
    bindEvents(handlers) {
      viewPortHandlers = handlers;
    },
  };
  const doc = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const commandPort = {
    subscribe(handlers) {
      this.handlers = handlers;
      return { destroy() {} };
    },
    requestRefresh: (detail) => commandCalls.push(["refresh", detail]),
    publishJobUpdated: (job) => commandCalls.push(["updated", job]),
    publishJobCreated: (job) => commandCalls.push(["created", job]),
  };
  const libraryRefreshPort = {
    subscribe(handlers) {
      this.handlers = handlers;
      return { destroy() {} };
    },
  };
  const refreshScheduler = {
    scheduleRefresh: (options) => schedulerCalls.push(["schedule", options]),
    setSuspended: (value) => schedulerCalls.push(["suspended", value]),
    isSuspended: () => false,
    updateSearch() {},
  };

  bindRecentJobsFeatureEvents({
    commandPort,
    doc,
    libraryBooksResource: { invalidate: () => invalidateCalls.push(true) },
    libraryRefreshPort,
    refreshScheduler,
    runtime: {
      loadRecentJobs: (options) => loadCalls.push(options),
      runtimePatches: {
        insert() {},
        update() {},
      },
    },
    viewPort,
  });

  viewPortHandlers.onLoadMore();
  libraryRefreshPort.handlers.onRefreshRequested({ delay: 80, force: true });
  libraryRefreshPort.handlers.onJobUpdated({ job: { job_id: "job-updated" } });
  libraryRefreshPort.handlers.onJobCreated({ job: { job_id: "job-created" } });
  listeners.get(APP_EVENTS.statusAreaVisibilityChanged)();
  listeners.get(APP_EVENTS.openTranslationWorkflow)();
  listeners.get(APP_EVENTS.closeTranslationWorkflow)();

  assert.deepEqual(loadCalls, [{ reset: false }]);
  assert.deepEqual(commandCalls, [
    ["refresh", { delay: 80, force: true }],
    ["updated", { job_id: "job-updated" }],
    ["created", { job_id: "job-created" }],
  ]);
  assert.deepEqual(schedulerCalls, [
    ["suspended", false],
    ["suspended", true],
    ["suspended", false],
    ["schedule", { delay: 300, force: true }],
  ]);
  // 关闭弹窗必须失效书架资源：否则新上传的文档要整页刷新才出现。
  assert.equal(invalidateCalls.length, 1, "closeTranslationWorkflow 必须 invalidate 书架资源");
});

test("shared library event port publishes and normalizes app events", () => {
  const previousCustomEvent = global.CustomEvent;
  const listeners = new Map();
  const dispatched = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  const target = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type, handler) {
      if (listeners.get(type) === handler) {
        listeners.delete(type);
      }
    },
    dispatchEvent(event) {
      dispatched.push(event);
      listeners.get(event.type)?.(event);
    },
  };

  try {
    const calls = [];
    const port = createLibraryEventPort({ target });
    const subscription = port.subscribe({
      onRefreshRequested: (detail) => calls.push(["refresh", detail]),
      onJobUpdated: (detail) => calls.push(["updated", detail]),
      onJobCreated: (detail) => calls.push(["created", detail]),
    });

    port.requestRefresh({ delay: "350", force: true });
    port.publishJobUpdated({ job_id: "job-updated" });
    port.publishJobCreated({ job_id: "job-created" });
    port.publishJobUpdated(null);

    assert.deepEqual(dispatched.map((event) => event.type), [
      APP_EVENTS.libraryRefreshRequested,
      APP_EVENTS.libraryJobUpdated,
      APP_EVENTS.libraryJobCreated,
    ]);
    assert.deepEqual(calls, [
      ["refresh", { delay: 350, force: true }],
      ["updated", { job: { job_id: "job-updated" } }],
      ["created", { job: { job_id: "job-created" } }],
    ]);

    subscription.destroy();
    assert.equal(listeners.size, 0);
  } finally {
    global.CustomEvent = previousCustomEvent;
  }
});

test("shared library refresh helper throttles non-terminal refreshes", () => {
  const previousCustomEvent = global.CustomEvent;
  const previousDateNow = Date.now;
  const dispatched = [];
  let now = 1000;
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  Date.now = () => now;
  const port = createLibraryEventPort({
    target: {
      dispatchEvent(event) {
        dispatched.push(event);
      },
      addEventListener() {},
      removeEventListener() {},
    },
  });
  const state = { lastLibraryRefreshRequestedAt: 0 };

  try {
    assert.equal(requestThrottledLibraryRefresh(state, { port }), true);
    assert.equal(requestThrottledLibraryRefresh(state, { port }), false);
    now += 4000;
    assert.equal(requestThrottledLibraryRefresh(state, { port }), true);
    assert.equal(requestThrottledLibraryRefresh(state, { port, terminal: true }), true);
    assert.deepEqual(dispatched.map((event) => event.detail), [
      { delay: 800, force: false },
      { delay: 800, force: false },
      { delay: 200, force: false },
    ]);
  } finally {
    Date.now = previousDateNow;
    global.CustomEvent = previousCustomEvent;
  }
});

test("recent jobs runtime port normalizes active job commands", () => {
  const opened = [];
  let current = " job-current ";
  const port = createRecentJobsRuntimePort({
    openJob: (jobId) => opened.push(jobId),
    currentJobId: () => current,
  });

  assert.equal(port.currentJobId(), "job-current");
  assert.equal(port.openJob(" job-1 "), true);
  assert.equal(port.openJob(""), false);
  assert.deepEqual(opened, ["job-1"]);

  current = "";
  assert.equal(port.currentJobId(), "");
});

test("recent jobs reader port normalizes reader commands", () => {
  const opened = [];
  const port = createRecentJobsReaderPort({
    openReader: (jobId) => opened.push(jobId),
  });

  assert.equal(port.openReader(" job-reader "), true);
  assert.equal(port.openReader(""), false);
  assert.deepEqual(opened, ["job-reader"]);
});

test("opening completed book detail does not steal active job polling", () => {
  const polled = [];
  const controller = createLibraryController({
    documentRef: { dispatchEvent() {} },
    startPolling: (jobId) => polled.push(jobId),
    hideStatusArea() {},
  });

  controller.openBookDetail({
    document_id: "doc-finished",
    job_id: "job-finished",
    status: "succeeded",
  });
  assert.deepEqual(polled, []);

  controller.openBookDetail({
    document_id: "doc-running",
    job_id: "job-running",
    status: "running",
  });
  assert.deepEqual(polled, ["job-running"]);
});

test("recent jobs navigation port owns workflow reader and recovery side effects", () => {
  const previousCustomEvent = global.CustomEvent;
  const dispatched = [];
  const opened = [];
  const read = [];
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  const doc = {
    dispatchEvent(event) {
      dispatched.push(event.type);
    },
  };
  try {
    const port = createRecentJobsNavigationPort({
      jobRuntimePort: {
        currentJobId: () => "job-current",
        openJob: (jobId) => {
          opened.push(jobId);
          return true;
        },
      },
      readerPort: {
        openReader: (jobId) => {
          read.push(jobId);
          return true;
        },
      },
    });

    assert.equal(port.currentJobId(), "job-current");
    assert.equal(port.openJob(" job-open "), true);
    assert.equal(port.openReader(" job-reader "), true);
    assert.equal(port.recoverJob(" job-recover "), true);
    assert.equal(port.openJob(""), false);
    // 网格选任务不弹旧工作流窗：进度在书籍详情的「进度」页
    assert.deepEqual(dispatched, []);
    assert.deepEqual(opened, ["job-open", "job-recover"]);
    assert.deepEqual(read, ["job-reader"]);
  } finally {
    global.CustomEvent = previousCustomEvent;
  }
});

test("recent jobs runtime wires loader actions and scheduler callbacks", async () => {
  const previousDocument = global.document;
  const previousCustomEvent = global.CustomEvent;
  const dispatched = [];
  // 最小 stub，方法集同 src/features/library/domain/recent-jobs-react-port.ts。
  const viewPort = {
    bindEvents() {},
    renderEmpty() {},
    renderError() {},
    renderList() {},
    renderLoading() {},
    scheduleAutoLoadCheck() {},
    setLoadMoreLoading() {},
  };
  global.document = {
    dispatchEvent(event) {
      dispatched.push(event);
    },
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  const loadParams = [];
  const opened = [];
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  let scheduler = null;
  const runtime = createRecentJobsRuntime({
    fetchJobList: async () => ({ items: [] }),
    fetchJobPayload: async () => ({}),
    fetchLibraryBookList: async () => ({ items: [] }),
    deleteLibraryBook: async () => ({}),
    apiPrefix: "/api/v1",
    currentJobId: () => "",
    jobRuntimePort: {
      openJob: (jobId) => opened.push(jobId),
    },
    readerPort: {
      openReader() {},
    },
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load(params) {
        loadParams.push(params);
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-runtime", status: "succeeded" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 24,
          },
        };
      },
    },
    refreshSchedulerRef: () => scheduler,
    viewPort,
  });
  scheduler = {
    getQuery: () => "search-term",
    scheduleAutoLoadIfNeeded() {},
  };

  try {
    await runtime.loadRecentJobs({ reset: true });
    runtime.recentJobActions.selectJob("job-runtime");

    assert.equal(loadParams[0].query, "search-term");
    assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), ["job-runtime"]);
    assert.deepEqual(opened, ["job-runtime"]);
    // 进度改在书籍详情 Tab：selectJob 默认不弹 translation-workflow-dialog
    assert.deepEqual(dispatched.map((event) => event.type), []);
  } finally {
    global.document = previousDocument;
    global.CustomEvent = previousCustomEvent;
  }
});

test("recent jobs runtime routes list rendering through the view port", async () => {
  const rendered = [];
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  let scheduler = null;
  const runtime = createRecentJobsRuntime({
    fetchJobList: async () => ({ items: [] }),
    fetchJobPayload: async () => ({}),
    fetchLibraryBookList: async () => ({ items: [] }),
    deleteLibraryBook: async () => ({}),
    apiPrefix: "/api/v1",
    currentJobId: () => "",
    jobRuntimePort: {
      openJob() {},
    },
    readerPort: {
      openReader() {},
    },
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-view-port", status: "running" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 10,
          },
        };
      },
    },
    refreshSchedulerRef: () => scheduler,
    viewPort: {
      renderEmpty() {},
      renderError(message) {
        throw new Error(`unexpected recent jobs error render: ${message}`);
      },
      renderList(payload) {
        rendered.push(payload.items.map((item) => item.job_id));
      },
      renderLoading() {},
      setLoadMoreLoading() {},
    },
  });
  scheduler = {
    getQuery: () => "",
    scheduleAutoLoadIfNeeded() {},
  };

  await runtime.loadRecentJobs({ reset: true });
  runtime.runtimePatches.update({ job_id: "job-view-port", status: "succeeded" });

  assert.deepEqual(rendered.at(-1), ["job-view-port"]);
});

test("recent job actions use navigation port instead of direct polling", () => {
  const opened = [];

  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    deleteLibraryBook: async () => {},
    startPolling: () => {
      throw new Error("recent-jobs actions should use navigationPort.openJob");
    },
    currentJobId: () => "legacy-current",
    navigationPort: {
      currentJobId: () => "",
      openJob: (jobId) => {
        opened.push(["open", jobId]);
        return true;
      },
      recoverJob: (jobId) => {
        opened.push(["recover", jobId]);
        return true;
      },
    },
    renderCurrentRecentJobs: () => {},
    renderRecentJobsEmpty: () => {},
    renderRecentJobsError: () => {},
    statePort: {
      getSnapshot: () => ({ items: [] }),
      removeJobFamily() {},
      setItems() {},
    },
  });

  actions.selectJob(" job-selected ");
  actions.recoverActiveJob([{ job_id: "job-recover", status: "running" }]);
  actions.recoverActiveJob([{ job_id: "job-ignored", status: "running" }]);

  assert.deepEqual(opened, [["open", "job-selected"], ["recover", "job-recover"]]);
});

test("recent job actions use navigation port instead of direct reader callback", () => {
  const opened = [];
  const errors = [];
  const actions = createRecentJobActions({
    apiPrefix: "/api/v1",
    deleteLibraryBook: async () => {},
    startPolling: () => {},
    openReader: () => {
      throw new Error("recent-jobs actions should use readerPort.openReader");
    },
    jobRuntimePort: {
      currentJobId: () => "",
      openJob: () => true,
    },
    navigationPort: {
      currentJobId: () => "",
      openReader: (jobId, documentId) => {
        opened.push([jobId, documentId]);
        return true;
      },
    },
    renderCurrentRecentJobs: () => {},
    renderRecentJobsEmpty: () => {},
    renderRecentJobsError: (message) => errors.push(message),
    statePort: {
      getSnapshot: () => ({ items: [] }),
      removeJobFamily() {},
      setItems() {},
    },
  });

  actions.openJobReader(" job-reader ", " doc-reader ");
  actions.openJobReader("");

  assert.deepEqual(opened, [["job-reader", "doc-reader"]]);
  assert.deepEqual(errors, ["该任务缺少 job_id，无法打开对照阅读。"]);
});

test("recent jobs active refresh skips the current runtime job", async () => {
  const items = [
    { job_id: "job-current", status: "running" },
    { job_id: "job-other", status: "running" },
    { job_id: "job-done", status: "succeeded" },
  ];

  assert.deepEqual(
    recentJobsEligibleForActiveRefresh(items, "job-current").map((item) => item.job_id),
    ["job-other"],
  );

  const timers = [];
  const fetched = [];
  const updates = [];
  const loads = [];
  const environment = createRecentJobsRefreshEnvironment({
    clearTimeoutFn() {},
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    isWorkflowOpen: () => false,
  });

  const loop = createActiveLibraryRefreshLoop({
    getItems: () => items,
    currentJobId: () => "job-current",
    fetchJobPayload: async (jobId) => {
      fetched.push(jobId);
      return { job_id: jobId, status: "running" };
    },
    apiPrefix: "/api/v1",
    updateFromRuntime: (job) => updates.push(job.job_id),
    loadRecentJobs: (options) => loads.push(options),
    isRecentJobsLoading: () => false,
    environment,
  });

  loop.schedule();
  assert.equal(timers.length, 1);
  timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetched, ["job-other"]);
  assert.deepEqual(updates, ["job-other"]);
  // 周期 active-refresh 只单卡 patch，不再全量 loadRecentJobs（避免网格闪）
  assert.deepEqual(loads, []);
  loop.stop();

  timers.length = 0;
  const currentOnlyLoop = createActiveLibraryRefreshLoop({
    getItems: () => [{ job_id: "job-current", status: "running" }],
    currentJobId: () => "job-current",
    fetchJobPayload: async () => {
      throw new Error("current job should not be fetched by active recent jobs refresh");
    },
    updateFromRuntime() {},
    loadRecentJobs() {},
    isRecentJobsLoading: () => false,
    environment,
  });
  currentOnlyLoop.schedule();
  assert.equal(timers.length, 0);
  currentOnlyLoop.stop();
});

test("recent jobs active refresh includes the submitted job on detail page when opted in", async () => {
  const items = [
    { job_id: "job-current", status: "running" },
    { job_id: "job-other", status: "running" },
  ];

  // 默认：排除当前 job，不打扰详情
  assert.deepEqual(
    recentJobsEligibleForActiveRefresh(items, "job-current").map((item) => item.job_id),
    ["job-other"],
  );
  // 放行本次提交的 job：当前 job 也被对齐
  assert.deepEqual(
    recentJobsEligibleForActiveRefresh(items, "job-current", ["job-current"]).map((item) => item.job_id),
    ["job-current", "job-other"],
  );
  // 函数/Set/单值形式等价，且其它 job id 不受影响
  assert.deepEqual(
    recentJobsEligibleForActiveRefresh(items, "job-current", () => new Set([" job-current "])).map((item) => item.job_id),
    ["job-current", "job-other"],
  );
  assert.deepEqual(
    recentJobsEligibleForActiveRefresh(items, "job-current", "job-other").map((item) => item.job_id),
    ["job-other"],
  );

  // loop：仅剩当前 job 时，默认熄火；放行后起轮询并单卡 patch，不全量 load
  const timers = [];
  const fetched = [];
  const updates = [];
  const loads = [];
  const environment = createRecentJobsRefreshEnvironment({
    clearTimeoutFn() {},
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    isWorkflowOpen: () => false,
  });
  const loop = createActiveLibraryRefreshLoop({
    getItems: () => [{ job_id: "job-current", status: "running" }],
    currentJobId: () => "job-current",
    includeJobIds: () => ["job-current"],
    fetchJobPayload: async (jobId) => {
      fetched.push(jobId);
      return { job_id: jobId, status: "running" };
    },
    apiPrefix: "/api/v1",
    updateFromRuntime: (job) => updates.push(job.job_id),
    loadRecentJobs: (options) => loads.push(options),
    isRecentJobsLoading: () => false,
    environment,
  });
  loop.schedule();
  assert.equal(timers.length, 1);
  timers[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fetched, ["job-current"]);
  assert.deepEqual(updates, ["job-current"]);
  assert.deepEqual(loads, []);
  loop.stop();
});

test("recent jobs workflow open port owns translation dialog DOM state", () => {
  const dialog = { dataset: { open: "1" } };
  const doc = {
    getElementById(id) {
      assert.equal(id, APP_DIALOG_IDS.translationWorkflow);
      return dialog;
    },
  };

  assert.equal(isTranslationWorkflowDialogOpen(doc), true);
  dialog.dataset.open = "0";
  assert.equal(isTranslationWorkflowDialogOpen(doc), false);
});
