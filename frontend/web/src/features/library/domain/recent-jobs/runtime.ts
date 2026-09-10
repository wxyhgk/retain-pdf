import { createRecentJobActions } from "./actions.js";
import {
  createActiveLibraryRefreshLoop,
} from "./active-refresh.js";
import { createRecentJobsLoader } from "./loader.js";
import { createRecentJobsRuntimePatches } from "./runtime-patches.js";
import { createRecentJobsNavigationPort } from "./navigation-port.js";
import { createRecentJobsStoreRenderer } from "./store-renderer.js";
import type { HomeStatePort } from "@/platform/contracts/home-view-contract.js";
import type {
  ActiveRefreshLoopPort,
  RecentJobActionsPort,
  RecentJobsCommitViewPort,
  RecentJobsInvocationSummary,
  RecentJobsRenderListOptions,
} from "./commit.js";
import type {
  CreateRecentJobsLoaderOptions,
  LoadRecentJobsOptions,
  RecentJobsLoader,
} from "./loader.js";
import type { LibraryJobItem, StageAdapterPort } from "./runtime-item.js";
import type { RecentJobsRuntimePatches } from "./runtime-patches.js";
import type { RecentJobsStatePort } from "./state.js";

export interface RecentJobsRefreshSchedulerRef {
  closeDialog?: () => void;
  getQuery?: () => string;
  scheduleAutoLoadIfNeeded?: () => void;
}

export interface RecentJobsNavigationPort {
  openJob?: (jobId?: string) => void;
  openReader?: (jobId?: string) => void;
  [key: string]: unknown;
}

export interface RecentJobsRuntimeViewPort extends RecentJobsCommitViewPort {
  replaceCard?: (item?: LibraryJobItem) => boolean;
  renderList?: (options?: RecentJobsRenderListOptions) => void;
  renderEmpty?: (message?: string, invocationSummary?: RecentJobsInvocationSummary) => void;
  renderError?: (message?: string, options?: { reset?: boolean }) => void;
}

export interface CreateRecentJobsRuntimeOptions {
  fetchJobList?: (
    apiPrefix?: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  fetchJobPayload?: (
    jobId: string,
    options?: { apiPrefix?: string } | string,
  ) => Promise<LibraryJobItem | Record<string, unknown> | null | undefined>;
  fetchLibraryBookList?: (
    apiPrefix?: string,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  deleteLibraryBook?: (apiPrefix: string, jobId: string) => Promise<unknown>;
  apiPrefix?: string;
  currentJobId?: () => string;
  jobRuntimePort?: unknown;
  activeJobRecoveryPort?: unknown;
  navigationPort?: RecentJobsNavigationPort;
  readerPort?: unknown;
  homeStatePort?: Pick<HomeStatePort, "setRecentJobsLoadingState">;
  recentJobsStatePort?: RecentJobsStatePort;
  libraryBooksResource?: {
    load?: (...args: unknown[]) => Promise<unknown>;
    invalidate?: () => void;
  };
  refreshSchedulerRef?: () => RecentJobsRefreshSchedulerRef | null | undefined;
  stageAdapterPort?: StageAdapterPort;
  viewPort?: RecentJobsRuntimeViewPort;
}

export interface RenderCurrentRecentJobsOptions {
  reset?: boolean;
  invocationSummary?: RecentJobsInvocationSummary;
}

export interface RecentJobsRuntime {
  activeRefreshLoop: ActiveRefreshLoopPort | null;
  loadRecentJobs: (options?: LoadRecentJobsOptions) => Promise<void> | undefined;
  recentJobActions: RecentJobActionsPort;
  recentJobsLoader: RecentJobsLoader | null;
  renderCurrentRecentJobs: (options?: RenderCurrentRecentJobsOptions) => void;
  storeRenderer: ReturnType<typeof createRecentJobsStoreRenderer> | null;
  runtimePatches: RecentJobsRuntimePatches;
}

export function createRecentJobsRuntime({
  fetchJobList,
  fetchJobPayload,
  fetchLibraryBookList,
  deleteLibraryBook,
  apiPrefix,
  currentJobId = () => "",
  jobRuntimePort,
  activeJobRecoveryPort,
  navigationPort,
  readerPort,
  homeStatePort,
  recentJobsStatePort,
  libraryBooksResource,
  refreshSchedulerRef,
  stageAdapterPort,
  viewPort,
}: CreateRecentJobsRuntimeOptions = {}): RecentJobsRuntime {
  let recentJobsLoader: RecentJobsLoader | null = null;
  let activeRefreshLoop: ActiveRefreshLoopPort | null = null;

  function refreshScheduler() {
    return refreshSchedulerRef?.();
  }

  function renderCurrentRecentJobs({
    reset = true,
    invocationSummary = null,
  }: RenderCurrentRecentJobsOptions = {}) {
    const { items, hasMore } = recentJobsStatePort.getSnapshot();
    viewPort.renderList({
      items,
      allItems: items,
      invocationSummary,
      reset,
      hasMore,
      onSelect: recentJobActions.selectJob,
      onDelete: recentJobActions.deleteJob,
      onReader: recentJobActions.openJobReader,
    });
  }

  let storeRenderer: ReturnType<typeof createRecentJobsStoreRenderer> | null = null;
  const runtimePatches = createRecentJobsRuntimePatches({
    renderCurrentRecentJobs,
    replaceRecentJobCard: viewPort.replaceCard,
    scheduleActiveRefresh: (options) => activeRefreshLoop?.schedule(options),
    stageAdapterPort,
    statePort: recentJobsStatePort,
    storeDrivenRendering: true,
  });

  activeRefreshLoop = createActiveLibraryRefreshLoop({
    getItems: () => recentJobsStatePort.getSnapshot().items,
    currentJobId,
    fetchJobPayload,
    apiPrefix,
    updateFromRuntime: runtimePatches.update,
    loadRecentJobs,
    isRecentJobsLoading: () => recentJobsLoader?.isLoading?.() || false,
  });

  const recentJobNavigationPort = navigationPort || createRecentJobsNavigationPort({
    closeDialog: () => refreshScheduler()?.closeDialog?.(),
    currentJobId,
    jobRuntimePort,
    readerPort,
  });

  const recentJobActions = createRecentJobActions({
    apiPrefix,
    deleteLibraryBook,
    activeJobRecoveryPort,
    navigationPort: recentJobNavigationPort,
    renderCurrentRecentJobs,
    renderRecentJobsEmpty: viewPort.renderEmpty,
    renderRecentJobsError: viewPort.renderError,
    statePort: recentJobsStatePort,
  });

  storeRenderer = createRecentJobsStoreRenderer({
    recentJobsStatePort,
    renderRecentJobsList: viewPort.renderList,
    actions: recentJobActions,
    renderActions: ["prependItem", "replaceItem", "removeJobFamily", "setOffset"],
  });

  function loadRecentJobs(options?: LoadRecentJobsOptions) {
    return recentJobsLoader?.load(options);
  }

  recentJobsLoader = createRecentJobsLoader({
    fetchJobList,
    fetchLibraryBookList,
    apiPrefix,
    getQuery: () => refreshScheduler()?.getQuery?.() || "",
    recentJobActions,
    runtimePatches,
    activeRefreshLoop: () => activeRefreshLoop,
    scheduleAutoLoadIfNeeded: () => refreshScheduler()?.scheduleAutoLoadIfNeeded(),
    homeStatePort,
    recentJobsStatePort,
    libraryBooksResource: libraryBooksResource as CreateRecentJobsLoaderOptions["libraryBooksResource"],
    storeDrivenRendering: true,
    viewPort,
  });

  return {
    activeRefreshLoop,
    loadRecentJobs,
    recentJobActions,
    recentJobsLoader,
    renderCurrentRecentJobs,
    storeRenderer,
    runtimePatches,
  };
}
