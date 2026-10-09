import {
  RECENT_JOBS_LOADING_STATES,
} from "./loading-state-contract.js";
import {
  hasActiveRecentJobs,
} from "./active-refresh.js";
import {
  dedupeRecentJobs,
} from "./pagination.js";
import type { HomeStatePort } from "@/platform/contracts/home-view-contract.js";
import type { LibraryJobItem } from "./runtime-item.js";
import type { RecentJobsRuntimePatches } from "./runtime-patches.js";
import type { RecentJobsStatePort } from "./state.js";

export type RecentJobsInvocationSummary = Record<string, unknown> | null;

export interface RecentJobsRenderListOptions {
  items?: LibraryJobItem[];
  allItems?: LibraryJobItem[];
  invocationSummary?: RecentJobsInvocationSummary;
  reset?: boolean;
  hasMore?: boolean;
  onSelect?: (jobId?: string) => void;
  onDelete?: (jobId?: string) => void | Promise<void>;
  onReader?: (jobId?: string) => void;
  [key: string]: unknown;
}

/** Engine-facing viewPort surface used by commit/loader (subset of React viewPort). */
export interface RecentJobsCommitViewPort {
  renderList?: (options?: RecentJobsRenderListOptions) => void;
  renderEmpty?: (message?: string, invocationSummary?: RecentJobsInvocationSummary) => void;
  renderError?: (message?: string, options?: { reset?: boolean }) => void;
  renderLoading?: () => void;
  setLoadMoreLoading?: () => void;
}

export interface RecentJobActionsPort {
  selectJob?: (jobId?: string) => void;
  deleteJob?: (jobId?: string) => void | Promise<void>;
  openJobReader?: (jobId?: string) => void;
  recoverActiveJob?: (items?: LibraryJobItem[]) => void;
}

export interface ActiveRefreshLoopPort {
  schedule: (options?: { resetTimer?: boolean }) => void;
  stop: () => void;
}

export type RecentJobsTimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

export type RecentJobsSetTimeoutFn = (
  callback: () => void,
  delay?: number,
) => RecentJobsTimeoutHandle;

export interface CommitRecentJobsPageOptions {
  reset?: boolean;
  collected?: LibraryJobItem[];
  hasMore?: boolean;
  nextOffset?: number;
  invocationSummary?: RecentJobsInvocationSummary;
  query?: string;
  recentJobActions?: RecentJobActionsPort;
  runtimePatches?: Pick<RecentJobsRuntimePatches, "apply" | "applyExisting">;
  activeRefreshLoop?: (() => ActiveRefreshLoopPort | null | undefined) | null;
  scheduleAutoLoadIfNeeded?: (() => void) | null;
  recentJobsStatePort?: Pick<
    RecentJobsStatePort,
    | "batch"
    | "getSnapshot"
    | "setOffset"
    | "setHasMore"
    | "setInvocationSummary"
    | "setItems"
  >;
  setTimeoutFn?: RecentJobsSetTimeoutFn;
}

export interface CommitRecentJobsEmptyOptions {
  query?: string;
  invocationSummary?: RecentJobsInvocationSummary;
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<RecentJobsStatePort, "setItems" | "setHasMore">;
}

export interface CommitRecentJobsNoMoreOptions {
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<RecentJobsStatePort, "setHasMore">;
}

export interface CommitRecentJobsErrorOptions {
  error?: { message?: string } | Error | null;
  reset?: boolean;
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<RecentJobsStatePort, "setHasMore">;
}

export interface CommitRecentJobsPageResult {
  nextItems: LibraryJobItem[];
  renderItems: LibraryJobItem[];
}

function defaultSetTimeout(
  callback: () => void,
  delay?: number,
): RecentJobsTimeoutHandle {
  const timer = globalThis.window?.setTimeout
    ? globalThis.window.setTimeout(callback, delay)
    : globalThis.setTimeout?.(callback, delay);
  return timer as RecentJobsTimeoutHandle;
}

export function commitRecentJobsPage({
  reset = false,
  collected = [],
  hasMore = false,
  nextOffset = 0,
  invocationSummary = null,
  query = "",
  recentJobActions,
  runtimePatches,
  activeRefreshLoop,
  scheduleAutoLoadIfNeeded,
  recentJobsStatePort,
  setTimeoutFn = defaultSetTimeout,
}: CommitRecentJobsPageOptions = {}): CommitRecentJobsPageResult {
  const latestItems = reset ? [] : recentJobsStatePort.getSnapshot().items;
  const nextItems = runtimePatches.apply(dedupeRecentJobs(reset ? collected : [...latestItems, ...collected]));
  const renderItems = reset
    ? nextItems
    : (runtimePatches.applyExisting?.(collected) || runtimePatches.apply(collected));

  if (typeof recentJobsStatePort.batch === "function") {
    recentJobsStatePort.batch(({ setOffset, setHasMore, setInvocationSummary, setItems }) => {
      setOffset(nextOffset);
      setHasMore(hasMore);
      setInvocationSummary(invocationSummary);
      setItems(nextItems);
    });
  } else {
    recentJobsStatePort.setOffset(nextOffset);
    recentJobsStatePort.setHasMore(hasMore);
    recentJobsStatePort.setInvocationSummary?.(invocationSummary);
    recentJobsStatePort.setItems(nextItems);
  }

  if (hasActiveRecentJobs(nextItems)) {
    activeRefreshLoop()?.schedule();
  } else {
    activeRefreshLoop()?.stop();
  }
  // localStorage 不可用或没有记录时，以首屏服务端列表作为冷启动兜底。
  // recoverActiveJob 内部只执行一次，且使用 silent polling，不会自动打开任务弹窗。
  recentJobActions?.recoverActiveJob?.(nextItems);
  // 列表由 React 直接订阅 recentJobsStatePort 渲染，这里不再推给 viewPort。

  // 服务端已按 query 过滤，首屏不满同样自动补拉；搜索多页不再依赖手点“更多”。
  if (hasMore) {
    setTimeoutFn(() => scheduleAutoLoadIfNeeded?.(), 0);
  }

  return {
    nextItems,
    renderItems,
  };
}

export function commitRecentJobsEmpty({
  query = "",
  homeStatePort,
  recentJobsStatePort,
}: CommitRecentJobsEmptyOptions = {}): { message: string } {
  recentJobsStatePort.setItems([]);
  recentJobsStatePort.setHasMore(false);
  homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
  const message = `${query || ""}`.trim() ? "没有匹配的书籍" : "暂无最近任务";
  return { message };
}

export function commitRecentJobsNoMore({
  homeStatePort,
  recentJobsStatePort,
}: CommitRecentJobsNoMoreOptions = {}): void {
  recentJobsStatePort.setHasMore(false);
  homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
}

export function commitRecentJobsError({
  error,
  reset = false,
  homeStatePort,
  recentJobsStatePort,
}: CommitRecentJobsErrorOptions = {}): { message: string } {
  const message = error?.message || "读取最近任务失败";
  if (!reset) {
    recentJobsStatePort.setHasMore(false);
  }
  homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.ERROR, message);
  return { message };
}
