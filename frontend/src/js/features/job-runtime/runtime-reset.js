import { summarizeStatus } from "../../job.js";
import { resetJobState } from "../../state.js";
import { closeRuntimeDialogs, resetEventsList } from "../app-shell/view.js";
import { stopPolling } from "./runtime-state.js";

export function returnJobRuntimeToHome({
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
}) {
  stopPolling(state);
  closeRuntimeDialogs();
  onReaderDialogClose?.();
  resetJobState(state);
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
  resetEventsList();
  activateDetailTab("overview");
  updateJobWarning("idle");
}
