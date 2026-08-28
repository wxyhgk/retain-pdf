import {
  RECENT_JOBS_LOADING_STATES,
} from "./loading-state-contract.js";
import {
  hasActiveRecentJobs,
} from "./active-refresh.js";
import {
  dedupeRecentJobs,
} from "./pagination.js";
import type { HomeStatePort } from "../home/state.js";
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
  hasView?: () => boolean;
  renderList?: (options?: RecentJobsRenderListOptions) => void;
  renderEmpty?: (message?: string, invocationSummary?: RecentJobsInvocationSummary) => void;
  renderError?: (message?: string, options?: { reset?: boolean }) => void;
  renderLoading?: () => void;
  replaceCard?: (item?: LibraryJobItem) => boolean;
  setLoadMoreLoading?: () => void;
}

export interface RecentJobActionsPort {
  selectJob?: (jobId?: string) => void;
  deleteJob?: (jobId?: string) => void | Promise<void>;
  openJobReader?: (jobId?: string) => void;
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
  storeDrivenRendering?: boolean;
  viewPort?: Pick<RecentJobsCommitViewPort, "renderList">;
}

export interface CommitRecentJobsEmptyOptions {
  query?: string;
  invocationSummary?: RecentJobsInvocationSummary;
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<RecentJobsStatePort, "setItems" | "setHasMore">;
  storeDrivenRendering?: boolean;
  /** Legacy unused callback kept for call-site compatibility. */
  renderEmpty?: (message?: string, invocationSummary?: RecentJobsInvocationSummary) => void;
  viewPort?: Pick<RecentJobsCommitViewPort, "renderEmpty">;
}

export interface CommitRecentJobsNoMoreOptions {
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<RecentJobsStatePort, "setHasMore">;
  storeDrivenRendering?: boolean;
  /** Legacy unused callback kept for call-site compatibility. */
  renderError?: (message?: string, options?: { reset?: boolean }) => void;
  viewPort?: Pick<RecentJobsCommitViewPort, "renderError">;
}

export interface CommitRecentJobsErrorOptions {
  error?: { message?: string } | Error | null;
  reset?: boolean;
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<RecentJobsStatePort, "setHasMore">;
  storeDrivenRendering?: boolean;
  /** Legacy unused callback kept for call-site compatibility. */
  renderError?: (message?: string, options?: { reset?: boolean }) => void;
  viewPort?: Pick<RecentJobsCommitViewPort, "renderError">;
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
  storeDrivenRendering = false,
  viewPort,
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
  if (!storeDrivenRendering) {
    viewPort.renderList({
      items: renderItems,
      allItems: nextItems,
      invocationSummary,
      reset,
      hasMore,
      onSelect: recentJobActions.selectJob,
      onDelete: recentJobActions.deleteJob,
      onReader: recentJobActions.openJobReader,
    });
  }

  if (hasMore && !`${query || ""}`.trim()) {
    setTimeoutFn(() => scheduleAutoLoadIfNeeded?.(), 0);
  }

  return {
    nextItems,
    renderItems,
  };
}

export function commitRecentJobsEmpty({
  query = "",
  invocationSummary = null,
  homeStatePort,
  recentJobsStatePort,
  storeDrivenRendering = false,
  renderEmpty: _renderEmpty,
  viewPort,
}: CommitRecentJobsEmptyOptions = {}): { message: string } {
  recentJobsStatePort.setItems([]);
  recentJobsStatePort.setHasMore(false);
  homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
  const message = `${query || ""}`.trim() ? "Không có sách phù hợp" : "Chưa có tác vụ gần đây";
  if (!storeDrivenRendering) {
    viewPort.renderEmpty(message, invocationSummary);
  }
  return { message };
}

export function commitRecentJobsNoMore({
  homeStatePort,
  recentJobsStatePort,
  storeDrivenRendering = false,
  renderError: _renderError,
  viewPort,
}: CommitRecentJobsNoMoreOptions = {}): void {
  recentJobsStatePort.setHasMore(false);
  homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
  if (!storeDrivenRendering) {
    viewPort.renderError("", { reset: false });
  }
}

export function commitRecentJobsError({
  error,
  reset = false,
  homeStatePort,
  recentJobsStatePort,
  storeDrivenRendering = false,
  renderError: _renderError,
  viewPort,
}: CommitRecentJobsErrorOptions = {}): { message: string } {
  const message = error?.message || "Không đọc được tác vụ gần đây";
  if (!reset) {
    recentJobsStatePort.setHasMore(false);
  }
  homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.ERROR, message);
  if (!storeDrivenRendering) {
    viewPort.renderError(message, { reset });
  }
  return { message };
}
