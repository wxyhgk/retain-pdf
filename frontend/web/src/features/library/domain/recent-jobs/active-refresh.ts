import { isRecentJobActive } from "./card-presenter.js";
import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";

export const LIBRARY_ACTIVE_REFRESH_MS = 2500;
export const LIBRARY_ACTIVE_REFRESH_MAX_CARDS_PER_TICK = 6;

export function hasActiveRecentJobs(items = []) {
  return (Array.isArray(items) ? items : []).some(isRecentJobActive);
}

export function recentJobsEligibleForActiveRefresh(items = [], currentJobId = "") {
  const activeJobId = `${currentJobId || ""}`.trim();
  return (Array.isArray(items) ? items : [])
    .filter(isRecentJobActive)
    .filter((item) => {
      const jobId = `${item?.job_id || ""}`.trim();
      return jobId && jobId !== activeJobId;
    });
}

/**
 * 仅轮询「其它活跃任务」详情并单卡 patch。
 * 不再周期 loadRecentJobs 全量列表——那会与 soft/silent reload 叠成网格闪烁。
 * 全量对齐留给：首屏、搜索、删除/创建后、手动刷新、scheduleRefresh。
 *
 * 状态机：idle --schedule(有可轮询卡)--> armed --timer触发--> fetching --完成--> armed
 *   fetching --stop/dispose/新一轮schedule--> idle（在途 fetch 按 gen 丢弃，不写卡）
 *   armed --timer已存在--> armed（pending合并，不重复起 timer，即 throttle）
 *   armed --loading中--> armed（suspend：重约一拍，不发网）
 *   armed --无可轮询卡--> idle（自然熄火）
 */
export function createActiveLibraryRefreshLoop({
  getItems,
  currentJobId = () => "",
  fetchJobPayload,
  apiPrefix,
  updateFromRuntime,
  // 保留参数兼容旧调用方，周期路径不再使用
  loadRecentJobs: _loadRecentJobs,
  isRecentJobsLoading,
  environment = defaultRecentJobsRefreshEnvironment,
}: any) {
  let activeLibraryRefreshTimer = null;
  let loopGen = 0;
  let stopped = false;
  let disposed = false;

  function stop() {
    stopped = true;
    loopGen += 1;
    environment.clearTimeout(activeLibraryRefreshTimer);
    activeLibraryRefreshTimer = null;
  }

  function dispose() {
    disposed = true;
    stop();
  }

  function isStopped() {
    return stopped || disposed;
  }

  // 规则1 bypass/失活：非当前 gen 的在途 fetch 一律丢弃，不写卡。
  function isCurrentGeneration(gen) {
    return gen === loopGen && !isStopped();
  }

  // 规则2 pending队列/throttle：timer 已存在则合并，不重复起 timer。
  function hasPendingTick() {
    return Boolean(activeLibraryRefreshTimer);
  }

  // 规则3 suspend：全量 loading 中挂起本拍，重约一拍后再试。
  function shouldSuspendWhileLoading() {
    return isRecentJobsLoading();
  }

  // 规则4 idle熄火：无其它活跃卡则不 arm，自然停轮询。
  function shouldIdleWithoutEligible() {
    return recentJobsEligibleForActiveRefresh(getItems(), currentJobId()).length === 0;
  }

  function selectCardsForTick(gen) {
    if (!isCurrentGeneration(gen)) {
      return [];
    }
    return recentJobsEligibleForActiveRefresh(getItems(), currentJobId())
      .slice(0, LIBRARY_ACTIVE_REFRESH_MAX_CARDS_PER_TICK);
  }

  async function refreshActiveRecentJobDetails(gen) {
    if (!fetchJobPayload) {
      return;
    }
    if (!isCurrentGeneration(gen)) {
      return;
    }
    const activeItems = selectCardsForTick(gen);
    await Promise.allSettled(activeItems.map(async (item) => {
      if (!isCurrentGeneration(gen)) {
        return;
      }
      const jobId = `${item?.job_id || ""}`.trim();
      if (!jobId) {
        return;
      }
      const payload = await fetchJobPayload(jobId, { apiPrefix });
      if (!isCurrentGeneration(gen)) {
        return;
      }
      updateFromRuntime(payload);
    }));
  }

  function schedule({ resetTimer = true }: any = {}) {
    if (disposed) {
      return;
    }
    stopped = false;
    if (resetTimer) {
      // 新一轮调度使上一轮在途 fetch 失活（gen 校验丢弃旧写）。
      loopGen += 1;
      environment.clearTimeout(activeLibraryRefreshTimer);
      activeLibraryRefreshTimer = null;
    }
    if (hasPendingTick()) {
      return;
    }
    if (shouldIdleWithoutEligible()) {
      return;
    }
    const gen = loopGen;
    activeLibraryRefreshTimer = environment.setTimeout(() => {
      activeLibraryRefreshTimer = null;
      if (!isCurrentGeneration(gen)) {
        return;
      }
      if (shouldSuspendWhileLoading()) {
        schedule();
        return;
      }
      void refreshActiveRecentJobDetails(gen).finally(() => {
        if (!isCurrentGeneration(gen)) {
          return;
        }
        schedule();
      });
    }, LIBRARY_ACTIVE_REFRESH_MS);
  }

  return {
    dispose,
    isStopped,
    schedule,
    stop,
  };
}
