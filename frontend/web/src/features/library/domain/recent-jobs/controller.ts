import { createRecentJobsRefreshScheduler } from "./refresh-scheduler.js";
import { createRecentJobsLibraryRefreshPort } from "./library-refresh-port.js";
import { createRecentJobsCommandPort } from "./commands.js";
import {
  createLibraryBooksResource,
} from "./library-books-resource.js";
import { bindRecentJobsFeatureEvents } from "./bindings.js";
import { createRecentJobsRuntime } from "./runtime.js";
import { createRecentJobsRuntimePort } from "./job-runtime-port.js";
import { createRecentJobsReaderPort } from "./reader-port.js";
import { createRecentJobsNavigationPort } from "./navigation-port.js";
import {
  createRecentJobsStatePort,
} from "./state.js";
import { createNoopRecentJobsHomeStatePort } from "./loading-state-contract.js";
import type { CreateRecentJobsRuntimeOptions } from "./runtime.js";
import type { RecentJobsReactViewPort } from "../types.js";

/** 运行时的选项照搬，外加本层自己装配的几样（事件端口、命令端口、视图端口）。 */
export type MountRecentJobsFeatureOptions = Omit<
  CreateRecentJobsRuntimeOptions,
  "refreshSchedulerRef" | "viewPort" | "libraryBooksResource"
> & {
  startPolling?: (jobId: string) => void;
  openReader?: (jobId: string, anchor: unknown, documentId: string, options: { pinJob?: boolean }) => void;
  viewPort: RecentJobsReactViewPort;
  libraryRefreshPort?: ReturnType<typeof createRecentJobsLibraryRefreshPort>;
  commandPort?: ReturnType<typeof createRecentJobsCommandPort>;
  libraryBooksResource?: ReturnType<typeof createLibraryBooksResource>;
};

export function mountRecentJobsFeature({
  fetchJobList,
  fetchJobPayload,
  fetchLibraryBookList,
  deleteLibraryBook,
  apiPrefix,
  startPolling,
  openReader,
  activeJobRecoveryPort,
  currentJobId = () => "",
  jobRuntimePort = createRecentJobsRuntimePort({
    openJob: startPolling,
    currentJobId,
  }),
  readerPort = createRecentJobsReaderPort({
    openReader,
  }),
  navigationPort,
  stageAdapterPort,
  homeStatePort = createNoopRecentJobsHomeStatePort(),
  recentJobsStatePort = createRecentJobsStatePort(),
  viewPort,
  libraryRefreshPort = createRecentJobsLibraryRefreshPort(),
  commandPort = createRecentJobsCommandPort(),
  libraryBooksResource = createLibraryBooksResource({
    fetchJobList,
    fetchLibraryBookList,
    apiPrefix,
  }),
}: MountRecentJobsFeatureOptions) {
  let refreshScheduler = null;
  const runtime = createRecentJobsRuntime({
    fetchJobList,
    fetchJobPayload,
    fetchLibraryBookList,
    deleteLibraryBook,
    apiPrefix,
    currentJobId,
    activeJobRecoveryPort,
    jobRuntimePort,
    navigationPort,
    readerPort,
    stageAdapterPort,
    homeStatePort,
    recentJobsStatePort,
    libraryBooksResource,
    refreshSchedulerRef: () => refreshScheduler,
    viewPort,
  });

  refreshScheduler = createRecentJobsRefreshScheduler({
    loadRecentJobs: runtime.loadRecentJobs,
    scheduleAutoLoadCheck: viewPort.scheduleAutoLoadCheck,
  });

  const featureEvents = bindRecentJobsFeatureEvents({
    apiPrefix,
    commandPort,
    doc: document,
    fetchJobPayload,
    libraryBooksResource,
    libraryRefreshPort,
    refreshScheduler,
    runtime,
    viewPort,
  });
  refreshScheduler.initialize();

  return {
    loadRecentJobs: runtime.loadRecentJobs,
    initializeLibraryView: refreshScheduler.initialize,
    disposeFeatureEvents: () => featureEvents?.dispose?.(),
  };
}
