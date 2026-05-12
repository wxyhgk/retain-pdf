import { $ } from "./dom.js";
import {
  isReaderActionEnabled,
  prepareFilePicker,
  resetUploadedFile as resetUploadedFilePresentation,
  setLinearProgress,
  updateActionButtons,
} from "./job-ui-actions.js";
import { resolveDisplayedStagePresentation } from "./job-stage-presentation.js";
import {
  buildStatusDetailSnapshot,
  renderStatusDetailSections,
  resolveLiveDurations,
} from "./status-detail-presentation.js";
import { state } from "./state.js";
import {
  formatJobFinishedAt,
  isTerminalStatus,
  normalizeJobPayload,
  resolveJobActions,
  summarizeDiagnostic,
  summarizePublicError,
  summarizeStatus,
} from "./job.js";

export {
  prepareFilePicker,
  resetUploadProgress,
  setLinearProgress,
  setUploadProgress,
  updateActionButtons,
} from "./job-ui-actions.js";

function resolveElapsedStart(job) {
  return (job?.started_at || job?.created_at || "").trim();
}

function safeSetText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
}

function stopElapsedTicker() {
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
}

function renderElapsed() {
  const snapshot = state.currentJobSnapshot;
  const statusCard = document.querySelector("job-status-card");
  if (!snapshot) {
    safeSetText("query-job-duration", "-");
    if (statusCard?.setElapsed) {
      statusCard.setElapsed("-");
    } else {
      safeSetText("status-ring-elapsed", "-");
    }
    return;
  }
  const durations = resolveLiveDurations(snapshot);
  safeSetText("query-job-duration", durations.totalElapsedText);
  if (statusCard?.setElapsed && !statusCard?.renderSnapshot) {
    statusCard.setElapsed(durations.totalElapsedText);
  } else {
    safeSetText("status-ring-elapsed", durations.totalElapsedText);
  }
  safeSetText("runtime-stage-elapsed", durations.stageElapsedText);
  safeSetText("runtime-total-elapsed", durations.totalElapsedText);
}

function startElapsedTicker() {
  stopElapsedTicker();
  renderElapsed();
  const status = $("status-section")?.getAttribute("data-status") || "";
  if (isTerminalStatus(status)) {
    return;
  }
  state.elapsedTimer = setInterval(() => {
    renderElapsed();
  }, 1000);
}

function updateRing(job) {
  const ringLabel = $("status-ring-label");
  const ringValue = $("status-ring-value");
  const ringElapsed = $("status-ring-elapsed");
  const pdfBtn = $("pdf-btn");
  const sourceBtn = $("source-pdf-btn");
  const readerBtn = $("reader-btn");
  const actionRow = document.querySelector(".status-ring-downloads");
  if (!ringLabel || !ringValue || !ringElapsed || !pdfBtn || !sourceBtn || !readerBtn || !actionRow) {
    return;
  }
  const presentation = resolveDisplayedStagePresentation(job, state.currentJobEvents);
  const stageText = presentation.detail;
  const ringLabelText = presentation.label;
  const ringValueText = stageText || "准备中";
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setStagePresentation && !statusCard?.renderSnapshot) {
    statusCard.setStagePresentation({
      label: ringLabelText,
      value: ringValueText,
      stageKey: presentation.stageKey,
    });
  } else {
    ringLabel.textContent = ringLabelText;
    ringValue.textContent = ringValueText;
  }
  const pdfReady = !pdfBtn.classList.contains("disabled") && job.status === "succeeded";
  const sourceReady = !sourceBtn.classList.contains("disabled") && job.status === "succeeded";
  const readerReady = !readerBtn.classList.contains("disabled") && job.status === "succeeded";
  if (statusCard?.syncPrimaryActions && !statusCard?.renderSnapshot) {
    statusCard.syncPrimaryActions({ pdfReady, readerReady, sourceReady });
  } else {
    pdfBtn.classList.toggle("hidden", !pdfReady);
    sourceBtn.classList.toggle("hidden", !sourceReady);
    readerBtn.classList.toggle("hidden", !readerReady);
    actionRow.classList.remove("hidden");
  }
}

export function setStatus(status) {
  const el = $("job-status");
  $("status-section")?.setAttribute("data-status", status || "idle");
  if (el) {
    el.textContent = status || "idle";
    el.className = `badge ${status || "idle"}`;
  }
  startElapsedTicker();
}

export function setWorkflowSections(job = null) {
  const normalized = job ? normalizeJobPayload(job) : null;
  const hasJob = Boolean(normalized && normalized.job_id);
  const shell = $("app-shell");
  $("status-section")?.classList.toggle("hidden", !hasJob);
  if (!hasJob) {
    shell?.classList.remove("processing-mode", "result-mode");
    stopElapsedTicker();
    const statusCard = document.querySelector("job-status-card");
    if (statusCard?.setBackHomeVisible && !statusCard?.renderSnapshot) {
      statusCard.setBackHomeVisible(false);
    } else {
      $("back-home-btn")?.classList.add("hidden");
    }
    return;
  }
  const processing = !isTerminalStatus(normalized.status);
  shell?.classList.toggle("processing-mode", processing);
  shell?.classList.toggle("result-mode", !processing);
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setBackHomeVisible && !statusCard?.renderSnapshot) {
    statusCard.setBackHomeVisible(!processing);
  } else {
    $("back-home-btn")?.classList.toggle("hidden", processing);
  }
}

export { clearFileInputValue } from "./job-ui-actions.js";

export function resetUploadedFile() {
  stopElapsedTicker();
  resetUploadedFilePresentation();
}

export function updateJobWarning(status) {
  const active = status === "queued" || status === "running";
  $("job-warning").classList.toggle("hidden", !active);
}

export function renderJob(payload, eventsPayload = null, manifestPayload = null) {
  const job = normalizeJobPayload(payload);
  const nextJobId = job.job_id || state.currentJobId;
  state.currentJobSnapshot = job;
  state.currentJobId = nextJobId;
  if (eventsPayload === null && state.currentJobEventsJobId && state.currentJobEventsJobId !== nextJobId) {
    state.currentJobEvents = null;
    state.currentJobEventsJobId = "";
    state.currentJobEventsFetchedAt = 0;
  }
  if (manifestPayload === null && state.currentJobManifestJobId && state.currentJobManifestJobId !== nextJobId) {
    state.currentJobManifest = null;
    state.currentJobManifestJobId = "";
    state.currentJobManifestFetchedAt = 0;
  }
  if (eventsPayload !== null) {
    state.currentJobEvents = eventsPayload;
    state.currentJobEventsJobId = nextJobId;
    state.currentJobEventsFetchedAt = Date.now();
  }
  if (manifestPayload !== null) {
    state.currentJobManifest = manifestPayload;
    state.currentJobManifestJobId = nextJobId;
    state.currentJobManifestFetchedAt = Date.now();
  }
  const stagePresentation = resolveDisplayedStagePresentation(
    job,
    eventsPayload !== null ? eventsPayload : state.currentJobEvents,
  );
  state.currentJobStartedAt = resolveElapsedStart(job);
  state.currentJobFinishedAt = (job.finished_at || job.updated_at || "").trim();
  setWorkflowSections(job);
  safeSetText("job-id", job.job_id || "-");
  safeSetText("job-summary", summarizeStatus(job.status || "idle"));
  safeSetText("job-stage-detail", stagePresentation.detail);
  safeSetText("job-finished-at", formatJobFinishedAt(job));
  safeSetText("query-job-finished-at", formatJobFinishedAt(job));
  if ($("job-id-input")) {
    $("job-id-input").value = job.job_id || "";
  }
  setStatus(job.status || "idle");
  safeSetText("error-box", summarizePublicError(job));
  updateActionButtons(job, manifestPayload);
  const actions = resolveJobActions(job);
  const readerEnabled = isReaderActionEnabled(job, manifestPayload);
  const stageText = stagePresentation.detail;
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.renderSnapshot) {
    statusCard.renderSnapshot({
      label: stagePresentation.label,
      value: stageText || "准备中",
      stageKey: stagePresentation.stageKey,
      elapsed: resolveLiveDurations(job).totalElapsedText,
      progressCurrent: stagePresentation.progressCurrent,
      progressTotal: stagePresentation.progressTotal,
      progressFallbackText: "-",
      progressPercent: job.progress_percent,
      progressText: stagePresentation.progressText,
      pdfReady: actions.pdfEnabled && !!actions.pdf && job.status === "succeeded",
      readerReady: readerEnabled && job.status === "succeeded",
      cancelEnabled: actions.cancelEnabled && !!actions.cancel,
      backHomeVisible: isTerminalStatus(job.status),
    });
  } else {
    setLinearProgress(
      "job-progress-bar",
      "job-progress-text",
      stagePresentation.progressCurrent,
      stagePresentation.progressTotal,
      "-",
      job.progress_percent,
    );
    updateRing(job);
  }
  const statusDetailDialog = document.querySelector("status-detail-dialog");
  if (statusDetailDialog?.renderSnapshot) {
    statusDetailDialog.renderSnapshot(buildStatusDetailSnapshot(job, eventsPayload));
  } else {
    renderStatusDetailSections(job, eventsPayload);
  }
  startElapsedTicker();
  updateJobWarning(job.status || "idle");
}
