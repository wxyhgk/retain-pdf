import { $ } from "../../dom.js";
import { normalizeJobPayload, summarizeStatus, isTerminalStatus } from "../../job.js";

export function mountJobRuntimeFeature({
  state,
  apiBase,
  apiPrefix,
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
  const JOB_EVENTS_PAGE_SIZE = 200;

  function stopPolling() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  async function fetchAllJobEvents(jobId) {
    const items = [];
    let offset = 0;
    while (true) {
      const payload = await fetchJobEvents(jobId, apiPrefix, JOB_EVENTS_PAGE_SIZE, offset);
      const batch = Array.isArray(payload?.items) ? payload.items : [];
      items.push(...batch);
      if (batch.length < JOB_EVENTS_PAGE_SIZE) {
        return {
          ...payload,
          items,
          offset: 0,
          limit: items.length,
        };
      }
      offset += batch.length;
    }
  }

  async function fetchJob(jobId) {
    const payload = await fetchJobPayload(jobId, apiPrefix);
    let eventsPayload = { items: [], limit: 0, offset: 0 };
    let manifestPayload = { items: [] };
    try {
      eventsPayload = await fetchAllJobEvents(jobId);
    } catch (_err) {
      // Event stream is secondary; keep main status usable even if events fail.
    }
    try {
      manifestPayload = await fetchJobArtifactsManifest(jobId, apiPrefix);
    } catch (_err) {
      // Artifacts manifest is secondary; keep main status usable even if manifest fails.
    }
    renderJob(payload, eventsPayload, manifestPayload);
    if ($("reader-dialog")?.open) {
      onReaderDialogSync?.();
    }
    const job = normalizeJobPayload(payload);
    if (isTerminalStatus(job.status)) {
      stopPolling();
    }
  }

  function startPolling(jobId) {
    stopPolling();
    state.currentJobId = jobId;
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
    }, 3000);
  }

  function returnToHome() {
    stopPolling();
    $("status-detail-dialog")?.close();
    onReaderDialogClose?.();
    $("page-range-dialog")?.close();
    state.currentJobId = "";
    state.currentJobSnapshot = null;
    state.currentJobManifest = null;
    state.currentJobStartedAt = "";
    state.currentJobFinishedAt = "";
    state.appliedPageRange = "";
    setWorkflowSections(null);
    resetUploadProgress();
    resetUploadedFile();
    applyWorkflowMode();
    setText("job-summary", summarizeStatus("idle"));
    setText("job-stage-detail", "-");
    setText("job-id", "-");
    setText("query-job-duration", "-");
    setText("job-finished-at", "-");
    clearPageRanges();
    setText("runtime-current-stage", "-");
    setText("runtime-stage-elapsed", "-");
    setText("runtime-total-elapsed", "-");
    setText("runtime-retry-count", "0");
    setText("runtime-last-transition", "-");
    setText("runtime-terminal-reason", "-");
    setText("runtime-input-protocol", "-");
    setText("runtime-stage-spec-version", "-");
    setText("runtime-math-mode", "-");
    setText("status-detail-job-id", "-");
    setText("failure-summary", "-");
    setText("failure-category", "-");
    setText("failure-stage", "-");
    setText("failure-root-cause", "-");
    setText("failure-suggestion", "-");
    setText("failure-last-log-line", "-");
    setText("failure-retryable", "-");
    setText("events-status", "全部事件");
    $("events-empty")?.classList.remove("hidden");
    $("events-list")?.classList.add("hidden");
    if ($("events-list")) {
      $("events-list").innerHTML = "";
    }
    activateDetailTab("overview");
    updateJobWarning("idle");
  }

  async function cancelCurrentJob() {
    const jobId = state.currentJobId;
    if (!jobId) {
      setText("error-box", "当前没有可取消的任务");
      return;
    }
    $("cancel-btn").disabled = true;
    try {
      await submitJson(`${apiBase()}${apiPrefix}/jobs/${jobId}/cancel`, {});
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
