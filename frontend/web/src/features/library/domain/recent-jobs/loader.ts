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
  /** 丢掉在途请求（资源层会把同参数的在途请求合并，挂住的那个不丢掉，重试拿到的还是它）。 */
  reset?: (options?: { keepCache?: boolean }) => void;
}

/** 列表请求多久没回应就算失败。以前没有超时：请求一挂住，书架永远停在「正在加载最近任务…」，
 *  而且加载锁不释放，之后所有刷新都只能排队，后端恢复了也不会再请求。 */
export const RECENT_JOBS_LOAD_TIMEOUT_MS = 20_000;
/** 加载失败后自动重试的间隔（成功后从头算）。后端重启、断网恢复后，书架自己回来。 */
export const RECENT_JOBS_RETRY_DELAYS_MS = [3_000, 6_000, 12_000, 30_000] as const;

class RecentJobsLoadTimeout extends Error {
  constructor() {
    super("recent jobs load timed out");
    this.name = "RecentJobsLoadTimeout";
  }
}

/** 给用户看的失败原因：浏览器的网络错误是英文（Failed to fetch），说中文。 */
export function recentJobsLoadErrorText(error: unknown): string {
  if (error instanceof RecentJobsLoadTimeout) return "后端迟迟没有响应，正在自动重试…";
  const message = `${(error as { message?: string } | null)?.message || ""}`.trim();
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "连不上后端服务，正在自动重试…";
  }
  return message ? `${message}（正在自动重试…）` : "读取最近任务失败，正在自动重试…";
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
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;

  function isLoading() {
    return loading;
  }

  // 卸载后丢弃：回包不再写 store，不再追发 pending，避免已销毁视图被覆写。
  function dispose() {
    disposed = true;
    pendingLoad = null;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry() {
    if (disposed || retryTimer !== null) return;
    const delay = RECENT_JOBS_RETRY_DELAYS_MS[Math.min(retryAttempt, RECENT_JOBS_RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      // 静默重试：失败提示留在原处，成功了直接换成列表，不闪「加载中」。
      void load({ reset: true, silent: true });
    }, delay);
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        libraryBooksResource.reset?.({ keepCache: true });
        reject(new RecentJobsLoadTimeout());
      }, RECENT_JOBS_LOAD_TIMEOUT_MS);
    });
    let snapshot: LibraryBooksResourceSnapshot;
    try {
      snapshot = await Promise.race([libraryBooksResource.load(params, { cache: false }), timeout]);
    } finally {
      clearTimeout(timer);
    }
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

      // 请求成功（哪怕结果是空的）就从头计重试间隔。
      retryAttempt = 0;
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
        error: { message: recentJobsLoadErrorText(err) },
        reset,
        homeStatePort,
        recentJobsStatePort,
      });
      scheduleRetry();
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
