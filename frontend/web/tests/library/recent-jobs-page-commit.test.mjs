// 最近任务分页结果的提交：page / empty / no-more / error 四种 commit 怎么改状态、交给谁渲染。
// 从原 recent-jobs.test.mjs 拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import { createRecentJobsStatePort } from "../../src/features/library/domain/recent-jobs/state.js";
import {
  commitRecentJobsEmpty,
  commitRecentJobsError,
  commitRecentJobsNoMore,
  commitRecentJobsPage,
} from "../../src/features/library/domain/recent-jobs/commit.js";
import { createRecentJobsRuntimePatches } from "../../src/features/library/domain/recent-jobs/runtime-patches.js";
import { createRecentJobsStoreRenderer } from "../../src/features/library/domain/recent-jobs/store-renderer.js";

test("recent jobs page commit refreshes cards and silently recovers the active job", () => {
  // 列表由 React 订阅 recentJobsStatePort 渲染，commit 只负责写 store、调度刷新与恢复。
  const recovered = [];
  const refreshCalls = [];
  const autoLoads = [];
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
  });

  const result = commitRecentJobsPage({
    reset: true,
    collected: [{ job_id: "job-running", status: "running" }],
    hasMore: true,
    nextOffset: 24,
    recentJobActions: {
      recoverActiveJob: (items) => recovered.push(items.map((item) => item.job_id)),
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({
      schedule: () => refreshCalls.push("schedule"),
      stop: () => refreshCalls.push("stop"),
    }),
    scheduleAutoLoadIfNeeded: () => autoLoads.push("auto"),
    recentJobsStatePort: statePort,
    setTimeoutFn(callback) {
      callback();
      return 1;
    },
  });

  assert.deepEqual(result.nextItems.map((item) => item.job_id), ["job-running"]);
  assert.deepEqual(statePort.getSnapshot().items.map((item) => item.job_id), ["job-running"]);
  assert.deepEqual(recovered, [["job-running"]]);
  assert.deepEqual(refreshCalls, ["schedule"]);
  assert.deepEqual(autoLoads, ["auto"]);
  assert.equal(statePort.getSnapshot().offset, 24);
});

test("recent jobs page commit can delegate page rendering to the store renderer", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
  });
  const storeRenders = [];
  const renderer = createRecentJobsStoreRenderer({
    recentJobsStatePort: statePort,
    renderActions: ["setOffset"],
    renderRecentJobsList: (payload) => {
      storeRenders.push({
        items: payload.items.map((item) => item.job_id),
        invocationSummary: payload.invocationSummary,
        hasMore: payload.hasMore,
      });
    },
  });
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    scheduleActiveRefresh() {},
  });
  const recentJobActions = {
    recoverActiveJob() {},
    selectJob() {},
    deleteJob() {},
    openJobReader() {},
  };

  try {
    const result = commitRecentJobsPage({
      reset: true,
      collected: [{ job_id: "job-store-rendered", status: "succeeded" }],
      hasMore: false,
      invocationSummary: { stage_spec_count: 7, unknown_count: 2 },
      nextOffset: 10,
      recentJobActions,
      runtimePatches,
      activeRefreshLoop: () => ({
        schedule() {},
        stop() {},
      }),
      scheduleAutoLoadIfNeeded() {},
      recentJobsStatePort: statePort,
    });

    assert.deepEqual(result.nextItems.map((item) => item.job_id), ["job-store-rendered"]);
    assert.deepEqual(storeRenders, [
      {
        items: ["job-store-rendered"],
        invocationSummary: { stage_spec_count: 7, unknown_count: 2 },
        hasMore: false,
      },
    ]);
  } finally {
    renderer.unmount();
  }
});

test("recent jobs page commit appends only collected items while preserving state patches", () => {
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

  const result = commitRecentJobsPage({
    reset: false,
    collected: [{ job_id: "job-page-2", status: "succeeded" }],
    hasMore: false,
    nextOffset: 48,
    recentJobActions: {
      recoverActiveJob() {},
      selectJob() {},
      deleteJob() {},
      openJobReader() {},
    },
    runtimePatches,
    activeRefreshLoop: () => ({
      schedule() {},
      stop() {},
    }),
    scheduleAutoLoadIfNeeded() {},
    recentJobsStatePort: statePort,
  });

  assert.deepEqual(result.nextItems.map((item) => item.job_id), [
    "job-created-active",
    "job-existing",
    "job-page-2",
  ]);
  assert.deepEqual(result.renderItems.map((item) => item.job_id), ["job-page-2"]);
});

test("recent jobs empty commit owns empty state and search copy", () => {
  const loadingStates = [];
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [{ job_id: "old" }],
    recentJobsHasMore: true,
  });

  const result = commitRecentJobsEmpty({
    query: "quantum",
    invocationSummary: null,
    homeStatePort: {
      setRecentJobsLoadingState: (...args) => loadingStates.push(args),
    },
    recentJobsStatePort: statePort,
  });

  assert.equal(result.message, "没有匹配的书籍");
  assert.deepEqual(statePort.getSnapshot().items, []);
  assert.equal(statePort.getSnapshot().hasMore, false);
  assert.deepEqual(loadingStates, [["ready"]]);
});

test("recent jobs no-more and error commits own terminal loading state", () => {
  const loadingStates = [];
  const statePort = createRecentJobsStatePort({
    recentJobsHasMore: true,
    recentJobsItems: [{ job_id: "job-existing" }],
  });
  const homeStatePort = {
    setRecentJobsLoadingState: (...args) => loadingStates.push(args),
  };

  commitRecentJobsNoMore({
    homeStatePort,
    recentJobsStatePort: statePort,
  });
  assert.equal(statePort.getSnapshot().hasMore, false);
  assert.deepEqual(loadingStates, [["ready"]]);

  commitRecentJobsError({
    error: new Error("network down"),
    reset: false,
    homeStatePort,
    recentJobsStatePort: statePort,
  });
  assert.deepEqual(loadingStates.at(-1), ["error", "network down"]);
});

