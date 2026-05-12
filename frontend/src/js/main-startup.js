import { API_PREFIX } from "./constants.js";
import { mountRecentJobsFeature } from "./features/recent-jobs/controller.js";
import {
  ensureReaderDialogFeature,
  getRequestedReaderJobIdFromLocation,
} from "./main-helpers.js";

export function initializeIdleAndRecentJobs({
  appShellFeature,
  fetchJobList,
  jobRuntimeFeature,
}) {
  appShellFeature?.initializeIdleView();
  mountRecentJobsFeature({
    fetchJobList,
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
  if (!startupReaderJobId) {
    return;
  }
  jobRuntimeFeature?.startPolling(startupReaderJobId);
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
