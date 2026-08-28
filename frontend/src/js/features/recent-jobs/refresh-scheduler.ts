import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";

const LIBRARY_SEARCH_DEBOUNCE_MS = 260;
const LIBRARY_REFRESH_MIN_INTERVAL_MS = 5000;

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

  function isSuspended() {
    return suspended || environment.isWorkflowOpen();
  }

  function getQuery() {
    return query;
  }

  function setSuspended(value) {
    suspended = Boolean(value);
  }

  function scheduleRefresh({ delay = 600, force = false, bypassThrottle = false }: any = {}) {
    if (!force && isSuspended()) {
      return;
    }
    const now = environment.now();
    if (!force && !bypassThrottle && now - lastRefreshAt < LIBRARY_REFRESH_MIN_INTERVAL_MS) {
      return;
    }
    lastRefreshAt = now;
    environment.clearTimeout(refreshTimer);
    refreshTimer = environment.setTimeout(() => {
      void loadRecentJobs({ reset: true, silent: true });
    }, delay);
  }

  function updateSearch(nextQuery) {
    query = `${nextQuery || ""}`.trim();
    environment.clearTimeout(searchTimer);
    searchTimer = environment.setTimeout(() => {
      // silent + soft reset: giữ list cũ đến khi kết quả mới tới, tránh gõ tìm kiếm làm cả lưới nhấp nháy rỗng/LOADING.
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
    initialize,
    isSuspended,
    openDialog,
    scheduleAutoLoadIfNeeded,
    scheduleRefresh,
    setSuspended,
    updateSearch,
  };
}
