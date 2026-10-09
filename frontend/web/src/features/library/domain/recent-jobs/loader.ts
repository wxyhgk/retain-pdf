import {
  RECENT_JOBS_LOADING_STATES,
} from "./loading-state-contract.js";
import type { RecentJobsPageFetcher } from "./pagination.js";
import {
  RECENT_JOBS_PAGE_SIZE,
} from "./pagination.js";
import { createLibraryBooksResource } from "./library-books-resource.js";
import {
  commitRecentJobsEmpty,
  commitRecentJobsError,
  commitRecentJobsNoMore,
  commitRecentJobsPage,
  type ActiveRefreshLoopPort,
  type RecentJobActionsPort,
  type RecentJobsCommitViewPort,
  type RecentJobsInvocationSummary,
} from "./commit.js";
import type { HomeStatePort } from "@/platform/contracts/home-view-contract.js";
import type { LibraryJobItem } from "./runtime-item.js";
import type { RecentJobsRuntimePatches } from "./runtime-patches.js";
import type { RecentJobsStatePort } from "./state.js";
import { libraryCardIdentityAliases } from "./library-card-identity.js";

export interface LoadRecentJobsOptions {
  reset?: boolean;
  silent?: boolean;
  query?: string;
}

export interface LibraryBooksPageData {
  collected?: LibraryJobItem[];
  hasMore?: boolean;
  latestInvocationSummary?: RecentJobsInvocationSummary;
  nextOffset?: number;
}

export interface LibraryBooksResourceSnapshot {
  status?: string;
  error?: unknown;
  data?: LibraryBooksPageData | null;
}

export interface LibraryBooksResourcePort {
  load: (
    params?: {
      startOffset?: number;
      pageSize?: number;
      existingJobIds?: Set<string> | string[];
      query?: string;
      onPreview?: (page: LibraryBooksPageData) => void;
    },
    options?: { cache?: boolean },
  ) => Promise<LibraryBooksResourceSnapshot>;
  invalidate?: () => void;
}

export interface CreateRecentJobsLoaderOptions {
  fetchJobList?: RecentJobsPageFetcher;
  fetchLibraryBookList?: RecentJobsPageFetcher;
  apiPrefix: string;
  getQuery?: () => string;
  recentJobActions?: RecentJobActionsPort;
  runtimePatches: RecentJobsRuntimePatches;
  activeRefreshLoop: () => ActiveRefreshLoopPort | null | undefined;
  scheduleAutoLoadIfNeeded?: (() => void) | null;
  homeStatePort: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort: Pick<
    RecentJobsStatePort,
    | "getSnapshot"
    | "resetPagination"
    | "batch"
    | "setOffset"
    | "setHasMore"
    | "setInvocationSummary"
    | "setItems"
  >;
  /** 只剩「加载中 / 加载更多中」两个信号还经 viewPort；列表本身由 React 订阅 store。 */
  viewPort: Required<Pick<RecentJobsCommitViewPort, "renderLoading" | "setLoadMoreLoading">>;
  libraryBooksResource?: LibraryBooksResourcePort;
}

export interface RecentJobsLoader {
  dispose: () => void;
  isLoading: () => boolean;
  load: (options?: LoadRecentJobsOptions) => Promise<void>;
}

export function createRecentJobsLoader({
  fetchJobList,
  fetchLibraryBookList,
  apiPrefix,
  getQuery,
  recentJobActions,
  runtimePatches,
  activeRefreshLoop,
  scheduleAutoLoadIfNeeded,
  homeStatePort,
  recentJobsStatePort,
  viewPort,
  libraryBooksResource = createLibraryBooksResource({
    fetchJobList,
    fetchLibraryBookList,
    apiPrefix,
  }) as LibraryBooksResourcePort,
}: CreateRecentJobsLoaderOptions): RecentJobsLoader {
  let loading = false;
  let pendingLoad: LoadRecentJobsOptions | null = null;
  let disposed = false;

  function isLoading() {
    return loading;
  }

  // 卸载后丢弃：回包不再写 store，不再追发 pending，避免已销毁视图被覆写。
  function dispose() {
    disposed = true;
    pendingLoad = null;
  }

  async function loadLibraryBooksPage(params: {
    startOffset?: number;
    pageSize?: number;
    existingJobIds?: Set<string> | string[];
    query?: string;
    onPreview?: (page: LibraryBooksPageData) => void;
  }): Promise<{
    collected: LibraryJobItem[];
    hasMore: boolean;
    latestInvocationSummary: RecentJobsInvocationSummary;
    nextOffset: number;
  }> {
    const snapshot = await libraryBooksResource.load(params, {
      cache: false,
    });
    if (snapshot.status === "error") {
      throw snapshot.error || new Error("读取最近任务失败");
    }
    return (snapshot.data || {
      collected: [],
      hasMore: false,
      latestInvocationSummary: null,
      nextOffset: params.startOffset || 0,
    }) as {
      collected: LibraryJobItem[];
      hasMore: boolean;
      latestInvocationSummary: RecentJobsInvocationSummary;
      nextOffset: number;
    };
  }

  async function load({
    reset = false,
    silent = false,
    query = getQuery?.() || "",
  }: LoadRecentJobsOptions = {}): Promise<void> {
    if (disposed) {
      return;
    }
    if (loading) {
      pendingLoad = {
        reset: reset || Boolean(pendingLoad?.reset),
        silent: silent && pendingLoad?.silent !== false,
        query,
      };
      return;
    }
    loading = true;
    if (!silent) {
      homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.LOADING);
    }
    if (reset) {
      recentJobsStatePort.resetPagination();
      if (!silent) {
        viewPort.renderLoading();
      }
    } else {
      viewPort.setLoadMoreLoading();
    }

    try {
      const { offset, items: previousItems } = recentJobsStatePort.getSnapshot();
      const existingJobIds = new Set(
        (reset ? [] : previousItems)
          .flatMap((item) => libraryCardIdentityAliases(item))
          .filter(Boolean),
      );
      const {
        collected,
        hasMore,
        latestInvocationSummary,
        nextOffset,
      } = await loadLibraryBooksPage({
        startOffset: reset ? 0 : offset,
        pageSize: RECENT_JOBS_PAGE_SIZE,
        existingJobIds,
        query,
        onPreview: ({ collected = [] }) => {
          if (disposed || pendingLoad?.reset || !collected.length) return;
          // Initial empty view only: refreshes retain already hydrated cards.
          if (recentJobsStatePort.getSnapshot().items.length) return;
          const items = runtimePatches.applyExisting?.(collected) || collected;
          recentJobsStatePort.setItems(items);
          homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
        },
      });

      if (disposed || pendingLoad?.reset) {
        return;
      }
      if (reset && collected.length === 0) {
        commitRecentJobsEmpty({
          query,
          invocationSummary: latestInvocationSummary,
          homeStatePort,
          recentJobsStatePort,
        });
        return;
      }
      if (!reset && collected.length === 0) {
        commitRecentJobsNoMore({
          homeStatePort,
          recentJobsStatePort,
        });
        return;
      }

      commitRecentJobsPage({
        reset,
        collected,
        hasMore,
        nextOffset,
        invocationSummary: latestInvocationSummary,
        query,
        recentJobActions,
        runtimePatches,
        activeRefreshLoop,
        scheduleAutoLoadIfNeeded,
        recentJobsStatePort,
      });
      homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
    } catch (err) {
      commitRecentJobsError({
        error: err as { message?: string } | Error | null,
        reset,
        homeStatePort,
        recentJobsStatePort,
      });
    } finally {
      loading = false;
      if (!disposed && pendingLoad) {
        const nextLoad = pendingLoad;
        pendingLoad = null;
        window.setTimeout(() => {
          void load(nextLoad);
        }, 0);
      } else {
        pendingLoad = null;
      }
    }
  }

  return {
    dispose,
    isLoading,
    load,
  };
}
