import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";
import type { AutoLoadCheckOptions } from "../types.js";
import type { LoadRecentJobsOptions } from "./loader.js";
import type { RecentJobsRefreshRequest } from "./commands.js";

export const LIBRARY_SEARCH_DEBOUNCE_MS = 260;
export const LIBRARY_REFRESH_MIN_INTERVAL_MS = 5000;
export const LIBRARY_REFRESH_DEFAULT_DELAY_MS = 600;
export const LIBRARY_REFRESH_TERMINAL_DELAY_MS = 400;
export const LIBRARY_REFRESH_RESUME_DELAY_MS = 300;

export type RecentJobsRefreshSchedulerEnvironment = typeof defaultRecentJobsRefreshEnvironment;

/** environment.setTimeout 的返回值（默认环境是 window.setTimeout，即 number）。 */
type RecentJobsRefreshTimer = ReturnType<RecentJobsRefreshSchedulerEnvironment["setTimeout"]>;

export type CreateRecentJobsRefreshSchedulerOptions = {
  loadRecentJobs: (options?: LoadRecentJobsOptions) => Promise<void> | undefined;
  scheduleAutoLoadCheck: (options?: AutoLoadCheckOptions) => void;
  environment?: RecentJobsRefreshSchedulerEnvironment;
};

export function createRecentJobsRefreshScheduler({
  loadRecentJobs,
  scheduleAutoLoadCheck,
  environment = defaultRecentJobsRefreshEnvironment,
}: CreateRecentJobsRefreshSchedulerOptions) {
  let refreshTimer: RecentJobsRefreshTimer | null = null;
  let searchTimer: RecentJobsRefreshTimer | null = null;
  let query = "";
  let suspended = false;
  let lastRefreshAt = 0;
  let pendingRefresh: RecentJobsRefreshRequest | null = null;
  let resumeRetryTimer: RecentJobsRefreshTimer | null = null;

  // 状态机：
  //   idle --scheduleRefresh--> armed --timer触发--> idle
  //   armed --scheduleRefresh--> armed（旧 timer 被覆盖）
  //   * --suspend--> suspended（pending队列长度<=1；force 粘滞：后写非 force
  //     不得清除先写 force，保证终态对齐 replay 时仍带 force 跳过节流）
  //   suspended --resume+pending--> armed（replay一次）/ --resume无pending--> idle
  //   armed请求命中 throttle 则直接丢弃（不入pending、不改lastRefreshAt）
  //   resume瞬间若 DOM data-open 仍滞后为开（见下），replay 会被重新排队，
  //   此时追加一次 RESUME_DELAY 延迟重试（单发、不叠加）。

  function isSuspended() {
    return suspended || environment.isWorkflowOpen();
  }

  function getQuery() {
    return query;
  }

  // 规则1 suspend：非 force 请求在挂起态只入队，不起 timer。
  function shouldQueueWhileSuspended({ force = false }: { force?: boolean } = {}) {
    return !force && isSuspended();
  }

  function queuePendingRefresh(request: RecentJobsRefreshRequest) {
    if (pendingRefresh?.force && !request.force) return;
    pendingRefresh = request;
  }

  function takePendingRefresh() {
    const replay = pendingRefresh;
    pendingRefresh = null;
    return replay;
  }

  // 规则2 pending队列：resume 时若有积压则 replay 恰好一次。
  // DOM 竞态兜底：resume 瞬间 environment.isWorkflowOpen()（DOM data-open）可能
  // 仍为真——dialog-runtime 的同步写与 document 监听器注册顺序决定了 bindings 的
  // onClose 不一定能看到已清掉的 data-open。此时 replay 会被 shouldQueueWhileSuspended
  // 重新排进 pending，而本机 suspended 标记已是 false，再无 resume 来消费 → 丢刷新。
  // 若重排后本机标记已为 false（只剩 DOM 一侧滞后），则追加一次 RESUME_DELAY 延迟
  // 重试（单发：retry timer 已存在不再叠加；重试仍挂起则保留 pending，等下一次
  // resume/force 覆盖，不自旋）。force 的 replay 不受 DOM 影响，不会走到这里。
  function replayPendingRefreshOnResume(was: boolean, next: boolean) {
    if (was && !next && pendingRefresh) {
      scheduleRefresh(takePendingRefresh());
      if (pendingRefresh && !suspended && !resumeRetryTimer) {
        resumeRetryTimer = environment.setTimeout(() => {
          resumeRetryTimer = null;
          if (pendingRefresh && !suspended) {
            scheduleRefresh(takePendingRefresh());
          }
        }, LIBRARY_REFRESH_RESUME_DELAY_MS);
      }
    }
  }

  function setSuspended(value: unknown) {
    const next = Boolean(value);
    const was = suspended;
    suspended = next;
    replayPendingRefreshOnResume(was, next);
  }

  function hasPendingRefresh() {
    return pendingRefresh !== null;
  }

  // 规则3 bypass：force 跳过 suspend+throttle；bypassThrottle 只跳过 throttle。
  function shouldBypassThrottle({ force = false, bypassThrottle = false }: { force?: boolean; bypassThrottle?: boolean } = {}) {
    return Boolean(force || bypassThrottle);
  }

  // 规则4 throttle：距上次 armed 不足 MIN_INTERVAL 的普通请求直接丢弃。
  function shouldDropByThrottle({ force = false, bypassThrottle = false }: { force?: boolean; bypassThrottle?: boolean }, now: number) {
    if (shouldBypassThrottle({ force, bypassThrottle })) {
      return false;
    }
    return now - lastRefreshAt < LIBRARY_REFRESH_MIN_INTERVAL_MS;
  }

  function armRefreshTimer(delay: number, now: number) {
    lastRefreshAt = now;
    environment.clearTimeout(refreshTimer);
    refreshTimer = environment.setTimeout(() => {
      void loadRecentJobs({ reset: true, silent: true });
    }, delay);
  }

  function scheduleRefresh({ delay = LIBRARY_REFRESH_DEFAULT_DELAY_MS, force = false, bypassThrottle = false }: RecentJobsRefreshRequest = {}) {
    const request = { delay, force, bypassThrottle };
    if (shouldQueueWhileSuspended(request)) {
      queuePendingRefresh(request);
      return;
    }
    pendingRefresh = null;
    const now = environment.now();
    if (shouldDropByThrottle(request, now)) {
      return;
    }
    armRefreshTimer(delay, now);
  }

  function updateSearch(nextQuery: string | null | undefined) {
    query = `${nextQuery || ""}`.trim();
    environment.clearTimeout(searchTimer);
    searchTimer = environment.setTimeout(() => {
      // silent + soft reset：保留旧列表到新结果到达，避免敲搜索整格闪空/LOADING
      void loadRecentJobs({ reset: true, silent: true, query });
    }, LIBRARY_SEARCH_DEBOUNCE_MS);
  }

  function initialize() {
    loadRecentJobs({ reset: true });
  }

  function dispose() {
    environment.clearTimeout(refreshTimer);
    environment.clearTimeout(searchTimer);
    environment.clearTimeout(resumeRetryTimer);
    refreshTimer = null;
    searchTimer = null;
    resumeRetryTimer = null;
    pendingRefresh = null;
  }

  function scheduleAutoLoadIfNeeded() {
    scheduleAutoLoadCheck({ isSuspended });
  }

  return {
    dispose,
    getQuery,
    hasPendingRefresh,
    initialize,
    isSuspended,
    scheduleAutoLoadIfNeeded,
    scheduleRefresh,
    setSuspended,
    updateSearch,
  };
}
