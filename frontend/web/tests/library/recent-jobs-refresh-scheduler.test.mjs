// 最近任务刷新调度器：节流、工作流打开时挂起、恢复后补放、dispose 清理。
// 从原 recent-jobs.test.mjs 拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecentJobsRefreshScheduler,
  LIBRARY_REFRESH_RESUME_DELAY_MS,
} from "../../src/features/library/domain/recent-jobs/refresh-scheduler.js";
import {
  createRecentJobsRefreshEnvironment,
} from "../../src/features/library/domain/recent-jobs/refresh-environment.js";

test("recent jobs refresh scheduler can bypass throttle without forcing suspended state", () => {
  const loads = [];
  const timers = [];
  let now = 10000;

  const environment = createRecentJobsRefreshEnvironment({
    now: () => now,
    clearTimeoutFn() {},
    setTimeoutFn(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    isWorkflowOpen: () => false,
  });

  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment,
  });

  scheduler.scheduleRefresh({ delay: 10 });
  scheduler.scheduleRefresh({ delay: 20 });
  scheduler.scheduleRefresh({ delay: 30, bypassThrottle: true });
  assert.deepEqual(timers.map((timer) => timer.delay), [10, 30]);
  timers.forEach((timer) => timer.callback());
  assert.deepEqual(loads, [
    { reset: true, silent: true },
    { reset: true, silent: true },
  ]);

  const suspendedScheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment,
  });
  suspendedScheduler.setSuspended(true);
  now += 10000;
  suspendedScheduler.scheduleRefresh({ delay: 40, bypassThrottle: true });
  assert.deepEqual(timers.map((timer) => timer.delay), [10, 30]);
});

test("recent jobs refresh scheduler pauses through injected workflow state", () => {
  const timers = [];
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs() {},
    scheduleAutoLoadCheck() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => 10000,
      clearTimeoutFn() {},
      setTimeoutFn(callback, delay) {
        timers.push({ callback, delay });
        return timers.length;
      },
      isWorkflowOpen: () => true,
    }),
  });

  scheduler.scheduleRefresh({ delay: 10 });
  scheduler.scheduleRefresh({ delay: 20, force: true });

  assert.equal(scheduler.isSuspended(), true);
  assert.deepEqual(timers.map((timer) => timer.delay), [20]);
});

test("recent jobs refresh scheduler keeps force pending when plain request arrives later", () => {
  const loads = [];
  const timers = [];
  let now = 10000;
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => now,
      clearTimeoutFn() {},
      setTimeoutFn(callback, delay) {
        timers.push({ callback, delay });
        return timers.length;
      },
      isWorkflowOpen: () => true,
    }),
  });
  scheduler.setSuspended(true);
  scheduler.scheduleRefresh({ delay: 10, force: true });
  scheduler.scheduleRefresh({ delay: 20 });
  scheduler.setSuspended(false);
  now += 10000;
  // force 直达一次（delay 10 保留：后写非 force 不得清除先写 force）；
  // DOM 恒开导致 replay 被重排队时，只追加一次延迟重试，不多发、不自旋
  assert.equal(timers.length, 2);
  assert.equal(timers[0].delay, 10);
  assert.equal(timers[1].delay, LIBRARY_REFRESH_RESUME_DELAY_MS);
  assert.equal(scheduler.hasPendingRefresh(), true);
  timers[1].callback();
  assert.equal(timers.length, 2, "重试仍撞 DOM 只重排队，不再起新 timer");
  assert.equal(scheduler.hasPendingRefresh(), true);
});

test("submit soft fallback queued while suspended replays exactly once on resume", () => {
  const loads = [];
  const timers = [];
  let now = 10000;
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => now,
      clearTimeoutFn() {},
      setTimeoutFn(callback, delay) {
        timers.push({ callback, delay });
        return timers.length;
      },
      isWorkflowOpen: () => false,
    }),
  });

  // 弹窗仍开着（suspend）：提交 800ms 兜底（force:false）只排队，不起 timer
  scheduler.setSuspended(true);
  now += 10000;
  scheduler.scheduleRefresh({ delay: 0, force: false });
  assert.equal(timers.length, 0);
  assert.equal(scheduler.hasPendingRefresh(), true);

  // 关窗（resume）：排队的刷新恰好 replay 一次
  scheduler.setSuspended(false);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 0);
  assert.equal(scheduler.hasPendingRefresh(), false);
  timers.forEach((timer) => timer.callback());
  assert.deepEqual(loads, [{ reset: true, silent: true }]);
});

test("resume replay is retried once when workflow DOM still reports open", () => {
  const loads = [];
  const timers = [];
  let now = 10000;
  // DOM 滞后：suspended 标记已关，但 data-open 还没清（监听器注册顺序）
  let workflowOpen = true;
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => now,
      clearTimeoutFn() {},
      setTimeoutFn(callback, delay) {
        timers.push({ callback, delay });
        return timers.length;
      },
      isWorkflowOpen: () => workflowOpen,
    }),
  });

  scheduler.setSuspended(true);
  now += 10000;
  scheduler.scheduleRefresh({ delay: 0, force: false });
  scheduler.setSuspended(false);
  // replay 撞上滞后的 DOM 被重新排队：不起 load timer，只追加一次延迟重试
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, LIBRARY_REFRESH_RESUME_DELAY_MS);
  assert.equal(scheduler.hasPendingRefresh(), true);

  // DOM 清除后重试触发：真正的刷新恰好发生一次，不丢
  workflowOpen = false;
  now += 10000;
  timers[0].callback();
  assert.equal(timers.length, 2);
  assert.equal(timers[1].delay, 0);
  timers[1].callback();
  assert.deepEqual(loads, [{ reset: true, silent: true }]);
  assert.equal(scheduler.hasPendingRefresh(), false);
});

test("recent jobs refresh scheduler dispose clears timers and drops pending", () => {
  const loads = [];
  const cleared = [];
  const scheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: (options) => loads.push(options),
    scheduleAutoLoadCheck() {},
    environment: createRecentJobsRefreshEnvironment({
      now: () => 10000,
      clearTimeoutFn: (timer) => cleared.push(timer),
      setTimeoutFn(callback, delay) {
        return 7;
      },
      isWorkflowOpen: () => false,
    }),
  });
  scheduler.scheduleRefresh({ delay: 10 });
  scheduler.updateSearch("test1");
  scheduler.dispose();
  assert.deepEqual(cleared.filter((timer) => timer === 7), [7, 7], "refresh 与 search timer 都清除");
  assert.equal(scheduler.hasPendingRefresh(), false);
});
