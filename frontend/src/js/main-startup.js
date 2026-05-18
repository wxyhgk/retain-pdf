import { API_PREFIX } from "./constants.js";
import { mountRecentJobsFeature } from "./features/recent-jobs/controller.js";
import {
  ensureReaderDialogFeature,
  getRequestedJobIdFromLocation,
  getRequestedReaderJobIdFromLocation,
} from "./main-helpers.js";

export function initializeIdleAndRecentJobs({
  appShellFeature,
  fetchJobList,
  fetchLibraryBookList,
  deleteLibraryBook,
  jobRuntimeFeature,
}) {
  appShellFeature?.initializeIdleView();
  mountRecentJobsFeature({
    fetchJobList,
    fetchLibraryBookList,
    deleteLibraryBook,
    apiPrefix: API_PREFIX,
    startPolling: (jobId) => jobRuntimeFeature?.startPolling(jobId),
  });
}

export function bootstrapStartupRoute({
  state,
  fetchProtected,
  jobRuntimeFeature,
  setText,
}) {
  const startupReaderJobId = getRequestedReaderJobIdFromLocation();
  const startupJobId = startupReaderJobId || getRequestedJobIdFromLocation();
  if (startupJobId) {
    jobRuntimeFeature?.startPolling(startupJobId);
  }
  if (!startupReaderJobId) {
    return;
  }
  window.setTimeout(async () => {
    try {
      const feature = await ensureReaderDialogFeature({
        state,
        fetchProtected,
        setText,
      });
      feature.open({ jobId: startupReaderJobId });
    } catch (error) {
      setText("error-box", error.message || String(error));
    }
  }, 0);
}
