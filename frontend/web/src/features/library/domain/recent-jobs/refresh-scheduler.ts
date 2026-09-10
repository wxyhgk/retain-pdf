import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";

export const LIBRARY_SEARCH_DEBOUNCE_MS = 260;
export const LIBRARY_REFRESH_MIN_INTERVAL_MS = 5000;
export const LIBRARY_REFRESH_DEFAULT_DELAY_MS = 600;
export const LIBRARY_REFRESH_TERMINAL_DELAY_MS = 400;
export const LIBRARY_REFRESH_RESUME_DELAY_MS = 300;

export function createRecentJobsRefreshScheduler({
  loadRecentJobs,
  scheduleAutoLoadCheck,
  setDialogOpen,
  environment = defaultRecentJobsRefreshEnvironment,
}: any) {
  let refreshTimer = null;
  let searchTimer = null;
  let query = "";
  let suspended = false;
  let lastRefreshAt = 0;
  let pendingRefresh = null;

  // 状态机：
  //   idle --scheduleRefresh--> armed --timer触发--> idle
  //   armed --scheduleRefresh--> armed（旧 timer 被覆盖）
  //   * --suspend--> suspended（pending队列长度<=1，后写覆盖先写）
  //   suspended --resume+pending--> armed（replay一次）/ --resume无pending--> idle
  //   armed请求命中 throttle 则直接丢弃（不入pending、不改lastRefreshAt）

  function isSuspended() {
    return suspended || environment.isWorkflowOpen();
  }

  function getQuery() {
    return query;
  }

  // 规则1 suspend：非 force 请求在挂起态只入队，不起 timer。
  function shouldQueueWhileSuspended({ force = false }: any = {}) {
    return !force && isSuspended();
  }

  function queuePendingRefresh(request: any) {
    pendingRefresh = request;
  }

  function takePendingRefresh() {
    const replay = pendingRefresh;
    pendingRefresh = null;
    return replay;
  }

  // 规则2 pending队列：resume 时若有积压则 replay 恰好一次。
  function replayPendingRefreshOnResume(was: boolean, next: boolean) {
    if (was && !next && pendingRefresh) {
      scheduleRefresh(takePendingRefresh());
    }
  }

  function setSuspended(value) {
    const next = Boolean(value);
    const was = suspended;
    suspended = next;
    replayPendingRefreshOnResume(was, next);
  }

  function hasPendingRefresh() {
    return pendingRefresh !== null;
  }

  // 规则3 bypass：force 跳过 suspend+throttle；bypassThrottle 只跳过 throttle。
  function shouldBypassThrottle({ force = false, bypassThrottle = false }: any = {}) {
    return Boolean(force || bypassThrottle);
  }

  // 规则4 throttle：距上次 armed 不足 MIN_INTERVAL 的普通请求直接丢弃。
  function shouldDropByThrottle({ force = false, bypassThrottle = false }: any, now: number) {
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

  function scheduleRefresh({ delay = LIBRARY_REFRESH_DEFAULT_DELAY_MS, force = false, bypassThrottle = false }: any = {}) {
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

  function updateSearch(nextQuery) {
    query = `${nextQuery || ""}`.trim();
    environment.clearTimeout(searchTimer);
    searchTimer = environment.setTimeout(() => {
      // silent + soft reset：保留旧列表到新结果到达，避免敲搜索整格闪空/LOADING
      void loadRecentJobs({ reset: true, silent: true, query });
    }, LIBRARY_SEARCH_DEBOUNCE_MS);
  }

  function openDialog() {
    setDialogOpen(true);
    loadRecentJobs({ reset: true });
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  function initialize() {
    loadRecentJobs({ reset: true });
  }

  function scheduleAutoLoadIfNeeded() {
    scheduleAutoLoadCheck({ isSuspended });
  }

  return {
    closeDialog,
    getQuery,
    hasPendingRefresh,
    initialize,
    isSuspended,
    openDialog,
    scheduleAutoLoadIfNeeded,
    scheduleRefresh,
    setSuspended,
    updateSearch,
  };
}
