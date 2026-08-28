export function resetStatusDetailRuntimeView({ setText, resetEventsList, activateDetailTab }: any) {
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
  setText("events-status", "Tất cả sự kiện");
  resetEventsList();
  activateDetailTab("overview");
}

export function initializeIdleAppView({
  configPort,
  jobPresentationPort = {},
  setText,
  setWorkflowSections,
  setLinearProgress,
  updateActionButtons,
  renderPageRangeSummary,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  updateJobWarning,
  resetEventsList,
  activateDetailTab,
}: any) {
  const normalizeJobPayload = jobPresentationPort.normalizeJobPayload || ((payload) => payload);
  const summarizeStatus = jobPresentationPort.summarizeStatus || ((status) => status);

  updateActionButtons(normalizeJobPayload({}));
  setWorkflowSections(null);
  setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
  setText("job-summary", summarizeStatus("idle"));
  setText("job-stage-detail", "-");
  setText("query-job-duration", "-");
  resetStatusDetailRuntimeView({ setText, resetEventsList, activateDetailTab });
  if (configPort?.isMock?.()) {
    setText("error-box", "-");
  }
  renderPageRangeSummary();
  resetUploadProgress();
  resetUploadedFile();
  applyWorkflowMode();
  updateJobWarning("idle");
}
