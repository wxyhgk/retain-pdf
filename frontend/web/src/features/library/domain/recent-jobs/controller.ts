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
}: any) {
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
    setDialogOpen: viewPort.setDialogOpen,
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
    openRecentJobsDialog: refreshScheduler.openDialog,
    closeRecentJobsDialog: refreshScheduler.closeDialog,
    loadRecentJobs: runtime.loadRecentJobs,
    initializeLibraryView: refreshScheduler.initialize,
    disposeFeatureEvents: () => featureEvents?.dispose?.(),
  };
}
