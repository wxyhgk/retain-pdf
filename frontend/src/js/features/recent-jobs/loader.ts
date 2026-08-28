import {
  RECENT_JOBS_LOADING_STATES,
} from "./loading-state-contract.js";
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
import type { HomeStatePort } from "../home/state.js";
import type { LibraryJobItem } from "./runtime-item.js";
import type { RecentJobsRuntimePatches } from "./runtime-patches.js";
import type { RecentJobsStatePort } from "./state.js";

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
    },
    options?: { cache?: boolean },
  ) => Promise<LibraryBooksResourceSnapshot>;
  invalidate?: () => void;
}

export interface CreateRecentJobsLoaderOptions {
  fetchJobList?: (
    apiPrefix?: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  fetchLibraryBookList?: (
    apiPrefix?: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  apiPrefix?: string;
  getQuery?: () => string;
  recentJobActions?: RecentJobActionsPort;
  runtimePatches?: RecentJobsRuntimePatches;
  activeRefreshLoop?: (() => ActiveRefreshLoopPort | null | undefined) | null;
  scheduleAutoLoadIfNeeded?: (() => void) | null;
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: Pick<
    RecentJobsStatePort,
    | "getSnapshot"
    | "resetPagination"
    | "batch"
    | "setOffset"
    | "setHasMore"
    | "setInvocationSummary"
    | "setItems"
  >;
  storeDrivenRendering?: boolean;
  viewPort?: RecentJobsCommitViewPort;
  libraryBooksResource?: LibraryBooksResourcePort;
}

export interface RecentJobsLoader {
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
  storeDrivenRendering = false,
  viewPort,
  libraryBooksResource = createLibraryBooksResource({
    fetchJobList,
    fetchLibraryBookList,
    apiPrefix,
  }) as LibraryBooksResourcePort,
}: CreateRecentJobsLoaderOptions): RecentJobsLoader {
  let loading = false;
  let pendingLoad: LoadRecentJobsOptions | null = null;

  function isLoading() {
    return loading;
  }

  async function loadLibraryBooksPage(params: {
    startOffset?: number;
    pageSize?: number;
    existingJobIds?: Set<string> | string[];
    query?: string;
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
      throw snapshot.error || new Error("Không đọc được tác vụ gần đây");
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
    if (loading) {
      pendingLoad = {
        reset: reset || Boolean(pendingLoad?.reset),
        silent: silent && pendingLoad?.silent !== false,
        query,
      };
      return;
    }
    if (!viewPort.hasView()) {
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
          .map((item) => `${item?.job_id || ""}`.trim())
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
      });

      if (reset && collected.length === 0) {
        commitRecentJobsEmpty({
          query,
          invocationSummary: latestInvocationSummary,
          homeStatePort,
          recentJobsStatePort,
          storeDrivenRendering,
          viewPort,
        });
        return;
      }
      if (!reset && collected.length === 0) {
        commitRecentJobsNoMore({
          homeStatePort,
          recentJobsStatePort,
          storeDrivenRendering,
          viewPort,
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
        storeDrivenRendering,
        viewPort,
      });
      homeStatePort.setRecentJobsLoadingState(RECENT_JOBS_LOADING_STATES.READY);
    } catch (err) {
      commitRecentJobsError({
        error: err as { message?: string } | Error | null,
        reset,
        homeStatePort,
        recentJobsStatePort,
        storeDrivenRendering,
        viewPort,
      });
    } finally {
      loading = false;
      if (pendingLoad) {
        const nextLoad = pendingLoad;
        pendingLoad = null;
        window.setTimeout(() => {
          void load(nextLoad);
        }, 0);
      }
    }
  }

  return {
    isLoading,
    load,
  };
}
