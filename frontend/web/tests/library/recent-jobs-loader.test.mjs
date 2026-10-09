// 最近任务 loader 与 command handlers：加载更多期间的运行时补丁、dispose 后丢弃迟到响应。
// 从原 recent-jobs.test.mjs 拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { createRecentJobsStatePort } from "../../src/features/library/domain/recent-jobs/state.js";
import { bindRecentJobsCommandHandlers } from "../../src/features/library/domain/recent-jobs/command-handlers.js";
import { createRecentJobsLoader } from "../../src/features/library/domain/recent-jobs/loader.js";
import { createRecentJobsRuntimePatches } from "../../src/features/library/domain/recent-jobs/runtime-patches.js";
import { createRecentJobsStoreRenderer } from "../../src/features/library/domain/recent-jobs/store-renderer.js";
import { adaptJobStageSnapshot } from "@retainpdf/domain/job-status";

const recentJobsStageAdapterPort = { adaptJobStageSnapshot };

test("recent jobs loader preserves runtime patches that arrive during load-more", async () => {
  // loader 经 viewPort 只发「加载中 / 加载更多中」两个信号，渲染结果走下方 items 断言。
  const viewPort = {
    renderLoading() {},
    setLoadMoreLoading() {},
    renderList() {},
    renderEmpty() {},
    renderError() {},
  };

  let resolveLoad;
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 24,
    recentJobsHasMore: true,
    recentJobsItems: [{ job_id: "job-existing", status: "succeeded" }],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
  });
  const loader = createRecentJobsLoader({
    apiPrefix: "/api/v1",
    fetchJobList: async () => ({ items: [] }),
    getQuery: () => "",
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    scheduleAutoLoadIfNeeded() {},
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        await new Promise((resolve) => {
          resolveLoad = resolve;
        });
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-page-2", status: "succeeded" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 48,
          },
        };
      },
    },
    viewPort,
  });

  const loadPromise = loader.load({ reset: false });
  await new Promise((resolve) => setImmediate(resolve));
  runtimePatches.insert({
    job_id: "job-created-during-load",
    document_id: "doc-created-during-load",
    title: "created-during-load.pdf",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });
  resolveLoad();
  await loadPromise;

  assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), [
    "job-created-during-load",
    "job-existing",
    "job-page-2",
  ]);
});

test("recent jobs loader does not append runtime-created cards during load-more rendering", async () => {
  const viewPort = {
    renderLoading() {},
    setLoadMoreLoading() {},
    renderList() {},
    renderEmpty() {},
    renderError() {},
  };

  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 24,
    recentJobsHasMore: true,
    recentJobsItems: [
      { job_id: "job-created-active", status: "running" },
      { job_id: "job-existing", status: "succeeded" },
    ],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
  });
  runtimePatches.insert({
    job_id: "job-created-active",
    status: "running",
    display_stage: "ocr",
    progress: { current: 1, total: 10, unit: "page" },
  });

  const loader = createRecentJobsLoader({
    apiPrefix: "/api/v1",
    fetchJobList: async () => ({ items: [] }),
    getQuery: () => "",
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    scheduleAutoLoadIfNeeded() {},
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        return {
          status: "success",
          data: {
            collected: [{ job_id: "job-page-2", status: "succeeded" }],
            hasMore: false,
            latestInvocationSummary: null,
            nextOffset: 48,
          },
        };
      },
    },
    viewPort,
  });

  await loader.load({ reset: false });

  assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), [
    "job-created-active",
    "job-existing",
    "job-page-2",
  ]);
});

test("recent jobs command handlers invalidate list resource before patching and refreshing", async () => {
  const handlers = {};
  const invalidations = [];
  const updates = [];
  const inserts = [];
  const refreshes = [];
  const fetches = [];
  const subscription = bindRecentJobsCommandHandlers({
    apiPrefix: "/api",
    commandPort: {
      subscribe(nextHandlers) {
        Object.assign(handlers, nextHandlers);
        return { destroy() {} };
      },
    },
    fetchJobPayload: async (jobId, options) => {
      const apiPrefix = typeof options === "string" ? options : options?.apiPrefix;
      fetches.push([jobId, apiPrefix]);
      return { job_id: jobId, status: "running", hydrated: true };
    },
    libraryBooksResource: {
      invalidate: () => invalidations.push("invalidate"),
    },
    runtimePatches: {
      update: (job) => updates.push(job.job_id),
      insert: (job) => inserts.push(job.job_id),
    },
    refreshScheduler: {
      scheduleRefresh: (options) => refreshes.push(options),
    },
  });

  handlers.onRefreshRequested({ delay: 50, force: true });
  // 运行中补丁：只 update 单卡，不整页 refresh（避免轮询期间主页闪烁）
  handlers.onJobUpdated({ job: { job_id: "job-updated", status: "running" } });
  handlers.onJobCreated({ job: { job_id: "job-created" } });
  // 终态才触发整页 scheduleRefresh
  handlers.onJobUpdated({ job: { job_id: "job-done", status: "succeeded" } });
  await Promise.resolve();
  subscription.destroy();

  // running update 不 invalidate；refresh / create / 终态 update 各一次
  assert.deepEqual(invalidations, ["invalidate", "invalidate", "invalidate"]);
  assert.deepEqual(fetches, [["job-created", "/api"]]);
  // hydrateCreatedRecentJob 异步补丁 job-created，可能排在终态 update 之后
  assert.deepEqual(updates, ["job-updated", "job-done", "job-created"]);
  assert.deepEqual(inserts, ["job-created"]);
  // onJobCreated 不再 force 整页 refresh；仅 onRefreshRequested + 终态 update
  // 终态 refresh 带 force:true，无视 5s 节流即时对齐
  assert.deepEqual(refreshes, [
    { delay: 50, force: true },
    { delay: 400, bypassThrottle: true, force: true },
  ]);
});

test("recent jobs command update refreshes the current card without opening detail", async () => {
  const handlers = {};
  const renders = [];
  const opened = [];
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      {
        job_id: "job-current",
        status: "running",
        display_stage: "translation",
        progress: { unit: "batch", current: 1, total: 10 },
      },
    ],
    recentJobsHasMore: true,
  });
  const renderer = createRecentJobsStoreRenderer({
    recentJobsStatePort: statePort,
    renderRecentJobsList: (payload) => renders.push(payload.items.map((item) => ({
      job_id: item.job_id,
      status: item.status,
      progress: item.progress,
    }))),
    actions: {
      selectJob: (jobId) => opened.push(["select", jobId]),
      deleteJob() {},
      openJobReader: (jobId) => opened.push(["reader", jobId]),
    },
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
    stageAdapterPort: recentJobsStageAdapterPort,
  });

  try {
    bindRecentJobsCommandHandlers({
      apiPrefix: "/api",
      commandPort: {
        subscribe(nextHandlers) {
          Object.assign(handlers, nextHandlers);
          return { destroy() {} };
        },
      },
      fetchJobPayload: async () => {
        throw new Error("updated jobs should not need hydration");
      },
      libraryBooksResource: {
        invalidate() {},
      },
      runtimePatches,
      refreshScheduler: {
        scheduleRefresh() {},
      },
    });

    handlers.onJobUpdated({
      job: {
        job_id: "job-current",
        status: "running",
        display_stage: "translation",
        substage: "translation_batches",
        progress: { unit: "batch", current: 5, total: 10, percent: 50 },
      },
    });

    const updated = statePort.getSnapshot().items[0];
    assert.equal(updated.job_id, "job-current");
    assert.equal(updated.status, "running");
    assert.equal(updated.progress.current, 5);
    assert.equal(updated.progress.total, 10);
    assert.equal(updated.progress.unit, "batch");
    assert.deepEqual(opened, []);
    assert.equal(renders.length, 1);
    assert.equal(renders[0][0].progress.current, 5);
  } finally {
    renderer.unmount();
  }
});

test("recent jobs loader dispose drops in-flight response and pending load", async () => {
  const rendered = [];
  const viewPort = {
    renderLoading() {},
    setLoadMoreLoading() {},
    renderList: ({ items }) => {
      rendered.push(...items.map((item) => item.job_id));
    },
    renderEmpty() {},
    renderError() {},
  };
  let resolveLoad;
  const statePort = (await import("../../src/features/library/domain/recent-jobs/state.js")).createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  const loader = createRecentJobsLoader({
    apiPrefix: "/api/v1",
    fetchJobList: async () => ({ items: [] }),
    getQuery: () => "",
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches: {
      apply() {},
      applyExisting() {},
    },
    activeRefreshLoop: () => ({ schedule() {}, stop() {} }),
    scheduleAutoLoadIfNeeded() {},
    homeStatePort: {
      setRecentJobsLoadingState() {},
    },
    recentJobsStatePort: statePort,
    libraryBooksResource: {
      async load() {
        await new Promise((resolve) => {
          resolveLoad = resolve;
        });
        return {
          status: "success",
          data: { collected: [{ job_id: "job-late", status: "succeeded" }], hasMore: false, latestInvocationSummary: null, nextOffset: 24 },
        };
      },
    },
    viewPort,
  });
  const loadPromise = loader.load({ reset: true });
  await new Promise((resolve) => setImmediate(resolve));
  loader.dispose();
  resolveLoad();
  await loadPromise;
  assert.deepEqual(rendered, [], "卸载后回包不渲染");
  assert.deepEqual(statePort.getSnapshot().items, [], "卸载后回包不写 store");
});
