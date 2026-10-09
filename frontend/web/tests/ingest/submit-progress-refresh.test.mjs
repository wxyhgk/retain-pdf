import test from "node:test";
import assert from "node:assert/strict";

import { publishSubmitSuccess } from "../../src/features/ingest/domain/actions/submit/progress.js";
import { createRecentJobsRefreshScheduler } from "../../src/features/library/domain/recent-jobs/refresh-scheduler.js";
import { createRecentJobsRefreshEnvironment } from "../../src/features/library/domain/recent-jobs/refresh-environment.js";

function createWindowRef(timers) {
  return {
    setTimeout: (handler, delay) => {
      timers.push({ handler, delay });
      return timers.length;
    },
    clearTimeout: (id) => {
      timers[id - 1] = null;
    },
  };
}

const documentRef = { defaultView: null, dispatchEvent: () => true };

test("publishSubmitSuccess arms 800ms soft and 5s force refresh fallbacks", () => {
  const created = [];
  const refreshes = [];
  const timers = [];
  const cancel = publishSubmitSuccess({
    payload: { job_id: "job-new" },
    state: {},
    renderJob() {},
    syncCurrentJobSnapshot() {},
    startJobPolling() {},
    libraryEventPort: {
      publishJobCreated: (job) => created.push(job?.job_id),
      requestRefresh: (options) => refreshes.push(options),
    },
    documentRef,
    windowRef: createWindowRef(timers),
    now: () => new Date(0).toISOString(),
  });

  assert.deepEqual(created, ["job-new"]);
  assert.deepEqual(timers.map((timer) => timer.delay), [800, 5000]);
  timers[0].handler();
  assert.deepEqual(refreshes, [{ delay: 0, force: false }]);
  timers[1].handler();
  assert.deepEqual(refreshes, [{ delay: 0, force: false }, { delay: 0, force: true }]);
  assert.equal(typeof cancel, "function");
  cancel();
});

test("submit while workflow open queues soft fallback and replays once on close", () => {
  const loads = [];
  const refreshTimers = [];
  let now = 10000;
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => now,
      clearTimeoutFn() {},
      setTimeoutFn(callback, delay) {
        refreshTimers.push({ callback, delay });
        return refreshTimers.length;
      },
      isWorkflowOpen: () => false,
    }),
  });

  // 弹窗仍开着时提交：800ms 兜底（force:false）经 requestRefresh 进入 scheduler，只排队
  scheduler.setSuspended(true);
  now += 10000;
  const submitTimers = [];
  publishSubmitSuccess({
    payload: { job_id: "job-new" },
    state: {},
    renderJob() {},
    syncCurrentJobSnapshot() {},
    startJobPolling() {},
    libraryEventPort: {
      publishJobCreated() {},
      requestRefresh: (options) => scheduler.scheduleRefresh(options),
    },
    documentRef,
    windowRef: createWindowRef(submitTimers),
    now: () => new Date(0).toISOString(),
  });
  submitTimers[0].handler();
  assert.equal(refreshTimers.length, 0);
  assert.equal(scheduler.hasPendingRefresh(), true);

  // 关窗（resume）：排队的刷新恰好发生一次
  scheduler.setSuspended(false);
  assert.equal(refreshTimers.length, 1);
  assert.equal(refreshTimers[0].delay, 0);
  refreshTimers.forEach((timer) => timer.callback());
  assert.deepEqual(loads, [{ reset: true, silent: true }]);
});
