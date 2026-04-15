import { $ } from "../../dom.js";
import { normalizeJobPayload, summarizeStatus } from "../../job.js";

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
  function bindDialogBackdropClose(id) {
    const dialog = $(id);
    if (!dialog) {
      return;
    }
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }

  function closeInfoBubbles(except = null) {
    document.querySelectorAll(".developer-hint.is-open").forEach((node) => {
      if (node !== except) {
        node.classList.remove("is-open");
      }
    });
  }

  function bindInfoBubbles() {
    document.querySelectorAll(".developer-hint").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = !trigger.classList.contains("is-open");
        closeInfoBubbles(trigger);
        trigger.classList.toggle("is-open", willOpen);
      });
    });

    document.addEventListener("click", () => {
      closeInfoBubbles();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeInfoBubbles();
      }
    });
  }

  function bindUploadTilePicker() {
    document.querySelector(".upload-tile")?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("button") || target.closest("a") || target.closest("input")) {
        return;
      }
      const fileInput = $("file");
      if (!fileInput || fileInput.disabled) {
        return;
      }
      fileInput.click();
    });

    $("file")?.addEventListener("click", prepareFilePicker);
  }

  function bindChrome() {
    [
      "query-dialog",
      "developer-auth-dialog",
      "developer-dialog",
      "browser-credentials-dialog",
      "desktop-setup-dialog",
      "page-range-dialog",
      "status-detail-dialog",
      "reader-dialog",
    ].forEach(bindDialogBackdropClose);
    bindInfoBubbles();
    bindUploadTilePicker();
  }

  function initializeIdleView() {
    updateActionButtons(normalizeJobPayload({}));
    setWorkflowSections(null);
    setLinearProgress("job-progress-bar", "job-progress-text", NaN, NaN, "-");
    setText("job-summary", summarizeStatus("idle"));
    setText("job-stage-detail", "-");
    setText("query-job-duration", "-");
    setText("diagnostic-box", "-");
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
    $("events-empty")?.classList.remove("hidden");
    $("events-list")?.classList.add("hidden");
    if ($("events-list")) {
      $("events-list").innerHTML = "";
    }
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
