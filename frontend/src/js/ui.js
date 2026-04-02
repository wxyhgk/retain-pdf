import { $ } from "./dom.js";
import { DEFAULT_FILE_LABEL } from "./constants.js";
import { state } from "./state.js";
import {
  formatJobDuration,
  formatJobFinishedAt,
  normalizeJobPayload,
  resolveJobActions,
  summarizeDiagnostic,
  summarizePublicError,
  summarizeStageDetail,
  summarizeStatus,
} from "./job.js";

export function setStatus(status) {
  const el = $("job-status");
  el.textContent = status || "idle";
  el.className = `badge ${status || "idle"}`;
}

function setActionLink(id, url, enabled) {
  const el = $(id);
  el.href = enabled && url ? url : "#";
  el.dataset.url = enabled && url ? url : "";
  el.classList.toggle("disabled", !enabled);
  el.setAttribute("aria-disabled", enabled ? "false" : "true");
}

export function updateActionButtons(job) {
  const actions = resolveJobActions(job);
  setActionLink("download-btn", actions.bundle, actions.bundleEnabled && !!actions.bundle);
  setActionLink("pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
  setActionLink("markdown-btn", actions.markdownJson, actions.markdownJsonEnabled && !!actions.markdownJson);
  setActionLink("markdown-raw-btn", actions.markdownRaw, actions.markdownRawEnabled && !!actions.markdownRaw);
  $("cancel-btn").disabled = !(actions.cancelEnabled && !!actions.cancel);
}

export function setLinearProgress(barId, textId, current, total, fallbackText = "-", percentOverride = null) {
  const bar = $(barId);
  const text = $(textId);
  const hasNumbers = Number.isFinite(current) && Number.isFinite(total) && total > 0;
  if (!hasNumbers) {
    bar.style.width = "0%";
    text.textContent = fallbackText;
    return;
  }
  const computedPercent = (current / total) * 100;
  const percent = Math.max(0, Math.min(100, Number.isFinite(percentOverride) ? percentOverride : computedPercent));
  bar.style.width = `${percent}%`;
  text.textContent = `${current} / ${total} (${percent.toFixed(0)}%)`;
}

export function setUploadProgress(loaded, total) {
  const panel = $("upload-progress-panel");
  panel.classList.remove("hidden");
  const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
  const percent = hasNumbers ? Math.max(0, Math.min(100, (loaded / total) * 100)) : 0;
  $("upload-progress-bar").style.width = `${percent}%`;
  $("upload-progress-text").textContent = hasNumbers ? `${percent.toFixed(0)}%` : "上传中";
}

export function resetUploadProgress() {
  $("upload-progress-panel").classList.add("hidden");
  $("upload-progress-bar").style.width = "0%";
  $("upload-progress-text").textContent = "0%";
}

export function clearFileInputValue() {
  const input = $("file");
  if (input) {
    input.value = "";
  }
}

export function resetUploadedFile() {
  state.uploadId = "";
  state.uploadedFileName = "";
  state.uploadedPageCount = 0;
  state.uploadedBytes = 0;
  $("file").value = "";
  $("submit-btn").disabled = true;
  $("upload-status").textContent = "未上传文件";
  $("file-label").textContent = DEFAULT_FILE_LABEL;
  $("file-label").title = "";
}

export function prepareFilePicker() {
  clearFileInputValue();
}

export function updateJobWarning(status) {
  const active = status === "queued" || status === "running";
  $("job-warning").classList.toggle("hidden", !active);
}

export function renderJob(payload) {
  const job = normalizeJobPayload(payload);
  state.currentJobId = job.job_id || state.currentJobId;
  $("job-id").textContent = job.job_id || "-";
  $("job-summary").textContent = summarizeStatus(job.status || "idle");
  $("job-stage-detail").textContent = summarizeStageDetail(job);
  $("job-finished-at").textContent = formatJobFinishedAt(job);
  $("query-job-finished-at").textContent = formatJobFinishedAt(job);
  $("query-job-duration").textContent = formatJobDuration(job);
  $("job-id-input").value = job.job_id || "";
  setStatus(job.status || "idle");
  setLinearProgress(
    "job-progress-bar",
    "job-progress-text",
    job.progress_current,
    job.progress_total,
    "-",
    job.progress_percent,
  );
  $("error-box").textContent = summarizePublicError(job);
  $("diagnostic-box").textContent = summarizeDiagnostic(job);
  updateActionButtons(job);
  updateJobWarning(job.status || "idle");
}
