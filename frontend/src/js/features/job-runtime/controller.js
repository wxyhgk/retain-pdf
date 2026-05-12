import { normalizeJobPayload, isTerminalStatus } from "../../job.js";
import { resetJobSecondaryState } from "../../state.js";
import { isReaderDialogOpen, setCancelButtonDisabled } from "../app-shell/view.js";
import {
  cachedEventsFor,
  cachedManifestFor,
  fetchAllJobEvents,
  JOB_EVENTS_REFRESH_MS,
  JOB_MANIFEST_REFRESH_MS,
  JOB_POLL_INTERVAL_MS,
  shouldRefreshSecondary,
  stopPolling,
} from "./runtime-state.js";
import { returnJobRuntimeToHome } from "./runtime-reset.js";

export function mountJobRuntimeFeature({
  state,
  apiPrefix,
  buildJobDetailEndpoint,
  fetchJobPayload,
  fetchJobEvents,
  fetchJobArtifactsManifest,
  submitJson,
  renderJob,
  setText,
  setWorkflowSections,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  clearPageRanges,
  updateJobWarning,
  activateDetailTab,
  onReaderDialogSync,
  onReaderDialogClose,
}) {
  async function fetchJob(jobId) {
    const payload = await fetchJobPayload(jobId, apiPrefix);
    const cachedEvents = cachedEventsFor(state, jobId);
    const cachedManifest = cachedManifestFor(state, jobId);
    renderJob(payload, cachedEvents, cachedManifest);
    if (isReaderDialogOpen()) {
      onReaderDialogSync?.();
    }
    const job = normalizeJobPayload(payload);
    const terminal = isTerminalStatus(job.status);
    if (isTerminalStatus(job.status)) {
      stopPolling();
    }
    if (shouldRefreshSecondary(state.currentJobEventsFetchedAt, JOB_EVENTS_REFRESH_MS, terminal || !cachedEvents)) {
      void fetchAllJobEvents({ fetchJobEvents, apiPrefix, jobId })
        .then((eventsPayload) => {
          if (state.currentJobId !== jobId) {
            return;
          }
          state.currentJobEvents = eventsPayload;
          state.currentJobEventsJobId = jobId;
          state.currentJobEventsFetchedAt = Date.now();
          renderJob(payload, eventsPayload, cachedManifestFor(state, jobId));
        })
        .catch(() => {
          // Event stream is secondary; keep main status usable even if events fail.
        });
    }
    if (shouldRefreshSecondary(state.currentJobManifestFetchedAt, JOB_MANIFEST_REFRESH_MS, terminal || !cachedManifest)) {
      void fetchJobArtifactsManifest(jobId, apiPrefix)
        .then((manifestPayload) => {
          if (state.currentJobId !== jobId) {
            return;
          }
          state.currentJobManifest = manifestPayload;
          state.currentJobManifestJobId = jobId;
          state.currentJobManifestFetchedAt = Date.now();
          renderJob(payload, cachedEventsFor(state, jobId), manifestPayload);
        })
        .catch(() => {
          // Artifacts manifest is secondary; keep main status usable even if manifest fails.
        });
    }
  }

  function startPolling(jobId) {
    stopPolling();
    state.currentJobId = jobId;
    resetJobSecondaryState(state);
    if (!state.currentJobStartedAt) {
      state.currentJobStartedAt = new Date().toISOString();
    }
    setWorkflowSections({ job_id: jobId, status: "queued" });
    fetchJob(jobId).catch((err) => {
      setText("error-box", err.message);
    });
    state.timer = setInterval(() => {
      fetchJob(jobId).catch((err) => {
        setText("error-box", err.message);
      });
    }, JOB_POLL_INTERVAL_MS);
  }

  function returnToHome() {
    returnJobRuntimeToHome({
      state,
      onReaderDialogClose,
      setWorkflowSections,
      resetUploadProgress,
      resetUploadedFile,
      applyWorkflowMode,
      clearPageRanges,
      setText,
      updateJobWarning,
      activateDetailTab,
    });
  }

  async function cancelCurrentJob() {
    const jobId = state.currentJobId;
    if (!jobId) {
      setText("error-box", "当前没有可取消的任务");
      return;
    }
    setCancelButtonDisabled(true);
    try {
      await submitJson(`${buildJobDetailEndpoint(jobId, apiPrefix)}/cancel`, {});
      await fetchJob(jobId);
    } catch (err) {
      setText("error-box", err.message);
    }
  }

  return {
    cancelCurrentJob,
    fetchJob,
    returnToHome,
    startPolling,
    stopPolling,
  };
}
