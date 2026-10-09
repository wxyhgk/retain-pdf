import type { LibraryJobItem } from "./state.js";
import { isRecentJobActive } from "./card-presenter.js";
import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";

export const LIBRARY_ACTIVE_REFRESH_MS = 2500;
export const LIBRARY_ACTIVE_REFRESH_MAX_CARDS_PER_TICK = 6;

type JobIdSetSource = string | string[] | Set<string> | null | undefined;
type JobIdSetInput = JobIdSetSource | (() => JobIdSetSource);

export function hasActiveRecentJobs(items = []) {
  return (Array.isArray(items) ? items : []).some(isRecentJobActive);
}

export function recentJobsEligibleForActiveRefresh(items = [], currentJobId = "", includeJobIds: JobIdSetInput = []) {
  const activeJobId = `${currentJobId || ""}`.trim();
  const included = normalizeJobIdSet(includeJobIds);
  return (Array.isArray(items) ? items : [])
    .filter(isRecentJobActive)
    .filter((item) => {
      const jobId = `${item?.job_id || ""}`.trim();
      if (!jobId) {
        return false;
      }
      // 默认排除当前 job：详情页自有 job-runtime 轮询，避免双路 patch 打扰详情。
      // 例外：本次提交的新 job（调用方经 includeJobIds 声明）在详情页仍需单卡对齐，
      // 只 patch、不全量 loadRecentJobs，不破坏“不打扰详情”初衷。
      if (jobId === activeJobId && !included.has(jobId)) {
        return false;
      }
      return true;
    });
}

function normalizeJobIdSet(source: JobIdSetInput) {
  const raw = typeof source === "function" ? source() : source;
  const list = raw instanceof Set ? [...raw] : (Array.isArray(raw) ? raw : (raw ? [raw] : []));
  return new Set(
    list.map((id) => `${id || ""}`.trim()).filter((id) => id),
  );
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
type ActiveLibraryRefreshLoopOptions = {
  getItems: () => LibraryJobItem[];
  currentJobId?: () => string;
  fetchJobPayload?: (jobId: string, options: { apiPrefix?: string }) => Promise<unknown>;
  apiPrefix?: string;
  updateFromRuntime: (payload: unknown) => void;
  loadRecentJobs?: unknown;
  isRecentJobsLoading: () => boolean;
  environment?: typeof defaultRecentJobsRefreshEnvironment;
  includeJobIds?: JobIdSetInput;
  detailOwnsCurrentJob?: () => boolean;
};

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
  // 本次提交的新 job id（函数或静态集合）：缺省空，等价于旧行为（排除当前 job）。
  // 接线方（如 runtime）在提交后传入，使新 job 在详情页也能被单卡对齐。
  includeJobIds = [],
  // 详情弹窗此刻是否正持有当前 job 的展示权。
  //
  // 下面那条「排除 currentJobId」的规则，理由写在它自己的注释里：「详情页自有
  // job-runtime 轮询」。可那个前提只在弹窗开着时成立——attachJobProgress 抢走
  // 全局轮询插槽后不会在关窗时归还，于是 currentJobId 一直占着，排除也一直生效。
  //
  // 后果是用户可见的：打开一本正在跑的书的详情，它的网格卡就从「2.5s 全量对齐」
  // 降级成「只在 status/stage 变化时被推一次」（silent 模式下 shouldPublishLibrary
  // 的判据），同一阶段内进度条冻结；关掉弹窗也不恢复。
  //
  // 缺省 true = 旧行为，接线方传入真实信号后，关窗即把卡片还给书架。
  detailOwnsCurrentJob = () => true,
}: ActiveLibraryRefreshLoopOptions) {
  // 弹窗没开着就当没有「当前 job」——排除规则随之失效，卡片回到书架的 2.5s 覆盖。
  function ownedCurrentJobId() {
    return detailOwnsCurrentJob() ? currentJobId() : "";
  }

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
  // （includeJobIds 放行的提交 job 计入可轮询卡，避免详情页新任务零对齐。）
  function shouldIdleWithoutEligible() {
    return recentJobsEligibleForActiveRefresh(getItems(), ownedCurrentJobId(), includeJobIds).length === 0;
  }

  function selectCardsForTick(gen) {
    if (!isCurrentGeneration(gen)) {
      return [];
    }
    return recentJobsEligibleForActiveRefresh(getItems(), ownedCurrentJobId(), includeJobIds)
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

  function schedule({ resetTimer = true }: { resetTimer?: boolean } = {}) {
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
