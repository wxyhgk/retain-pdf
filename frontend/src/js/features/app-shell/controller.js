import { $ } from "../../dom.js";
import { normalizeJobPayload, summarizeStatus } from "../../job.js";
import {
  bindDialogBackdropClose,
  bindInfoBubbles,
  bindUploadTilePicker,
  resetEventsList,
} from "./view.js";

export function mountAppShellFeature({
  isMockMode,
  prepareFilePicker,
  setText,
  setWorkflowSections,
  setLinearProgress,
  updateActionButtons,
  renderPageRangeSummary,
  resetUploadProgress,
  resetUploadedFile,
  applyWorkflowMode,
  updateJobWarning,
  activateDetailTab,
}) {
  function bindChrome() {
    [
      "query-dialog",
      "developer-auth-dialog",
      "developer-dialog",
      "browser-credentials-dialog",
      "page-range-dialog",
      "status-detail-dialog",
      "reader-dialog",
    ].forEach(bindDialogBackdropClose);
    bindInfoBubbles();
    bindUploadTilePicker(prepareFilePicker);
  }

  function initializeIdleView() {
    updateActionButtons(normalizeJobPayload({}));
    setWorkflowSections(null);
    setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
    setText("job-summary", summarizeStatus("idle"));
    setText("job-stage-detail", "-");
    setText("query-job-duration", "-");
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
    if (isMockMode()) {
      setText("error-box", "-");
    }
    setText("failure-retryable", "-");
    setText("events-status", "全部事件");
    resetEventsList();
    activateDetailTab("overview");
    renderPageRangeSummary();
    resetUploadProgress();
    resetUploadedFile();
    applyWorkflowMode();
    updateJobWarning("idle");
  }

  return {
    bindChrome,
    initializeIdleView,
  };
}
