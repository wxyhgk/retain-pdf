import { $ } from "./dom.js";
import { DEFAULT_FILE_LABEL } from "./constants.js";
import { state } from "./state.js";
import {
  formatEventTimestamp,
  formatJobFinishedAt,
  formatRuntimeDuration,
  isTerminalStatus,
  normalizeJobPayload,
  resolveJobActions,
  summarizeRuntimeField,
  summarizeDiagnostic,
  summarizeInvocationProtocol,
  summarizeInvocationSchemaVersion,
  summarizePublicError,
  summarizeStageDetail,
  summarizeStatus,
} from "./job.js";

const STATUS_RING_CIRCUMFERENCE = 2 * Math.PI * 62;

function stageIconMarkup(status, stageText) {
  const text = `${stageText || ""}`.toLowerCase();
  if (status === "succeeded") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (status === "failed") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M15 9l-6 6M9 9l6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (text.includes("排队")) {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M8 7h8M8 12h8M8 17h5M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  if (text.includes("翻译")) {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h8M8 6c0 6-2 10-5 12M8 6c1 3 3.5 6.5 7 9M14 6h6M17 6v12M14 18h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (text.includes("解析") || text.includes("ocr")) {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 4v5h5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function formatElapsedMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}小时 ${minutes}分 ${seconds}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分 ${seconds}秒`;
  }
  return `${seconds}秒`;
}

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveElapsedStart(job) {
  return (job?.started_at || job?.created_at || "").trim();
}

function parseIsoTime(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeSetText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
}

function safeSetHtml(id, value) {
  const el = $(id);
  if (el) {
    el.innerHTML = value;
  }
}

function latestStageHistoryEntry(job) {
  const history = Array.isArray(job?.stage_history) ? job.stage_history : [];
  if (history.length === 0) {
    return null;
  }
  return history[history.length - 1] || null;
}

function clampPositiveMs(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return num;
}

function resolveLiveDurations(job) {
  if (!job) {
    return {
      stageElapsedText: "-",
      totalElapsedText: "-",
    };
  }

  const status = job.status || $("status-section")?.getAttribute("data-status") || "";
  const terminal = isTerminalStatus(status);
  const updatedAt = parseIsoTime(job.updated_at);
  const finishedAt = parseIsoTime(job.finished_at || state.currentJobFinishedAt);
  const now = terminal ? finishedAt || updatedAt || new Date() : new Date();
  const stageStartedAt = parseIsoTime(job.stage_started_at || job.last_stage_transition_at);
  const jobStartedAt = parseIsoTime(job.started_at || job.created_at);
  const latestStage = latestStageHistoryEntry(job);
  const snapshotDeltaMs = !terminal && updatedAt
    ? Math.max(0, now.getTime() - updatedAt.getTime())
    : 0;

  let stageElapsedMs = clampPositiveMs(job.active_stage_elapsed_ms);
  let totalElapsedMs = clampPositiveMs(job.total_elapsed_ms);

  if (terminal) {
    if (stageElapsedMs === null) {
      stageElapsedMs = clampPositiveMs(latestStage?.duration_ms);
    }
    if (totalElapsedMs === null && jobStartedAt) {
      totalElapsedMs = Math.max(0, now.getTime() - jobStartedAt.getTime());
    }
  } else {
    if (stageElapsedMs !== null) {
      stageElapsedMs += snapshotDeltaMs;
    } else if (stageStartedAt) {
      stageElapsedMs = Math.max(0, now.getTime() - stageStartedAt.getTime());
    } else if (clampPositiveMs(latestStage?.duration_ms) !== null) {
      stageElapsedMs = clampPositiveMs(latestStage?.duration_ms) + snapshotDeltaMs;
    }

    if (totalElapsedMs !== null) {
      totalElapsedMs += snapshotDeltaMs;
    } else if (jobStartedAt) {
      totalElapsedMs = Math.max(0, now.getTime() - jobStartedAt.getTime());
    }
  }

  return {
    stageElapsedText: formatRuntimeDuration(stageElapsedMs),
    totalElapsedText: formatRuntimeDuration(totalElapsedMs),
  };
}

function stopElapsedTicker() {
  if (state.elapsedTimer) {
    clearInterval(state.elapsedTimer);
    state.elapsedTimer = null;
  }
}

function renderElapsed() {
  const snapshot = state.currentJobSnapshot;
  if (!snapshot) {
    safeSetText("query-job-duration", "-");
    safeSetText("status-ring-elapsed", "-");
    return;
  }
  const durations = resolveLiveDurations(snapshot);
  safeSetText("query-job-duration", durations.totalElapsedText);
  safeSetText("status-ring-elapsed", durations.totalElapsedText);
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
  const progressCircle = $("status-ring-progress");
  const ringLabel = $("status-ring-label");
  const ringValue = $("status-ring-value");
  const ringElapsed = $("status-ring-elapsed");
  const stageIcon = $("status-stage-icon");
  const pdfBtn = $("pdf-btn");
  if (!progressCircle || !ringLabel || !ringValue || !ringElapsed || !stageIcon || !pdfBtn) {
    return;
  }
  const stageText = summarizeStageDetail(job);
  const percent = Number.isFinite(job.progress_percent)
    ? Math.max(0, Math.min(100, job.progress_percent))
    : Number.isFinite(job.progress_current) && Number.isFinite(job.progress_total) && job.progress_total > 0
      ? Math.max(0, Math.min(100, (job.progress_current / job.progress_total) * 100))
      : 0;
  progressCircle.style.strokeDasharray = `${STATUS_RING_CIRCUMFERENCE}`;
  progressCircle.style.strokeDashoffset = `${STATUS_RING_CIRCUMFERENCE * (1 - percent / 100)}`;
  ringLabel.textContent = job.status === "succeeded"
    ? "处理完成"
    : job.status === "failed"
      ? "处理失败"
      : job.status === "queued"
      ? "排队中"
        : "处理中";
  ringValue.textContent = stageText || "准备中";
  stageIcon.innerHTML = stageIconMarkup(job.status, stageText);
  const pdfReady = !pdfBtn.classList.contains("disabled") && job.status === "succeeded";
  pdfBtn.classList.toggle("hidden", !pdfReady);
  stageIcon.classList.toggle("hidden", pdfReady);
  ringLabel.classList.toggle("hidden", pdfReady);
  ringValue.classList.toggle("hidden", pdfReady);
  ringElapsed.classList.toggle("hidden", pdfReady);
}

function updateDetailDialog(job) {
  const stageText = summarizeStageDetail(job);
  safeSetHtml("status-detail-head-icon", stageIconMarkup(job.status, stageText));
  safeSetText("status-detail-job-id", job.job_id || "-");
  safeSetText(
    "status-detail-head-note",
    job.status === "failed"
      ? "查看失败原因、建议与事件流"
      : job.status === "succeeded"
        ? "任务已完成，可查看概览与事件流"
        : "查看任务概览、失败原因与事件流",
  );
}

function summarizeMathMode(job) {
  const mathMode = `${job?.request_payload_math_mode || ""}`.trim();
  if (mathMode === "placeholder") {
    return "placeholder - 公式占位保护";
  }
  if (mathMode === "direct_typst") {
    return "direct_typst - 模型直出公式";
  }
  return mathMode || "-";
}

function renderRuntimeDetails(job) {
  const durations = resolveLiveDurations(job);
  safeSetText("runtime-current-stage", summarizeRuntimeField(job.current_stage || job.stage_detail));
  safeSetText("runtime-stage-elapsed", durations.stageElapsedText);
  safeSetText("runtime-total-elapsed", durations.totalElapsedText);
  safeSetText("runtime-retry-count", `${job.retry_count ?? 0}`);
  safeSetText(
    "runtime-last-transition",
    job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-",
  );
  safeSetText("runtime-terminal-reason", summarizeRuntimeField(job.terminal_reason));
  safeSetText("runtime-input-protocol", summarizeInvocationProtocol(job));
  safeSetText("runtime-stage-spec-version", summarizeInvocationSchemaVersion(job));
  safeSetText("runtime-math-mode", summarizeMathMode(job));
}

function renderFailureDetails(job) {
  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  safeSetText("failure-summary", summarizeRuntimeField(
    failure.summary || job.final_failure_summary || failureDiagnostic.summary,
  ));
  safeSetText("failure-category", summarizeRuntimeField(
    failure.category || job.final_failure_category || failureDiagnostic.type || failureDiagnostic.error_kind,
  ));
  safeSetText("failure-stage", summarizeRuntimeField(
    failure.stage || failureDiagnostic.stage || failureDiagnostic.failed_stage,
  ));
  safeSetText("failure-root-cause", summarizeRuntimeField(
    failure.root_cause || failureDiagnostic.root_cause,
  ));
  safeSetText("failure-suggestion", summarizeRuntimeField(
    failure.suggestion || failureDiagnostic.suggestion,
  ));
  safeSetText("failure-last-log-line", summarizeRuntimeField(
    failure.last_log_line || failureDiagnostic.last_log_line,
  ));
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  safeSetText("failure-retryable", typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-");
}

function eventBadgeTone(item) {
  if (item.level === "error" || item.event === "failure_classified" || item.event === "job_terminal") {
    return "error";
  }
  if (item.level === "warn" || item.event === "retry_scheduled") {
    return "warn";
  }
  return "";
}

function summarizeStageName(stage, detail) {
  const detailText = `${detail || ""}`.trim();
  if (detailText) {
    return detailText;
  }
  switch (`${stage || ""}`.trim()) {
    case "queued":
      return "排队中";
    case "running":
      return "处理中";
    case "translating":
      return "翻译";
    case "parsing":
    case "ocr":
      return "解析 / OCR";
    case "rendering":
      return "渲染";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return `${stage || "-"}`.trim() || "-";
  }
}

function resolveStageHistoryDuration(entry, job) {
  const explicitDuration = clampPositiveMs(entry?.duration_ms);
  if (explicitDuration !== null) {
    return explicitDuration;
  }
  const enterAt = parseIsoTime(entry?.enter_at);
  const exitAt = parseIsoTime(entry?.exit_at);
  if (enterAt && exitAt) {
    return Math.max(0, exitAt.getTime() - enterAt.getTime());
  }
  if (enterAt && !exitAt) {
    const status = job.status || $("status-section")?.getAttribute("data-status") || "";
    const terminal = isTerminalStatus(status);
    const endAt = terminal
      ? parseIsoTime(job.finished_at || state.currentJobFinishedAt || job.updated_at)
      : new Date();
    if (endAt) {
      return Math.max(0, endAt.getTime() - enterAt.getTime());
    }
  }
  return null;
}

function resolveStageHistory(job) {
  const directHistory = Array.isArray(job?.stage_history) ? job.stage_history : [];
  return directHistory
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftEnterAt = parseIsoTime(left.entry?.enter_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightEnterAt = parseIsoTime(right.entry?.enter_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftEnterAt !== rightEnterAt) {
        return leftEnterAt - rightEnterAt;
      }
      const leftExitAt = parseIsoTime(left.entry?.exit_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightExitAt = parseIsoTime(right.entry?.exit_at)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftExitAt !== rightExitAt) {
        return leftExitAt - rightExitAt;
      }
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function renderStageHistory(job) {
  const list = $("overview-stage-list");
  const empty = $("overview-stage-empty");
  if (!list || !empty) {
    return;
  }
  const history = resolveStageHistory(job);
  if (history.length === 0) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = "后端未返回 runtime.stage_history";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = history.map((entry, index) => {
    const duration = resolveStageHistoryDuration(entry, job);
    const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
    const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isTerminalStatus(job.status) ? "-" : "进行中");
    const stageName = summarizeStageName(entry?.stage, entry?.detail);
    const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
    return `
      <article class="stage-history-item">
        <div class="stage-history-main">
          <span class="stage-history-index">${index + 1}</span>
          <div class="stage-history-copy">
            <div class="stage-history-title">${escapeHtml(stageName)}</div>
            <div class="stage-history-meta">${escapeHtml(enterAt)} → ${escapeHtml(exitAt)}${escapeHtml(terminalText)}</div>
          </div>
        </div>
        <div class="stage-history-duration">${escapeHtml(formatRuntimeDuration(duration))}</div>
      </article>
    `;
  }).join("");
}

function formatEventPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch (_err) {
    return "";
  }
}

function renderEvents(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const list = $("events-list");
  const empty = $("events-empty");
  const status = $("events-status");
  if (!list || !empty || !status) {
    return;
  }
  status.textContent = items.length > 0 ? `最近 ${items.length} 条` : "暂无事件";
  if (items.length === 0) {
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = items.map((item) => {
    const tone = eventBadgeTone(item);
    const payloadText = formatEventPayload(item.payload);
    return `
      <article class="event-item">
        <div class="event-meta">
          <span class="event-badge ${tone}">${escapeHtml(item.event || "-")}</span>
          <span>${formatEventTimestamp(item.ts)}</span>
          <span>${escapeHtml(item.stage || "-")}</span>
          <span>${escapeHtml(item.level || "-")}</span>
        </div>
        <div class="event-title">${escapeHtml(item.message || "-")}</div>
        ${payloadText ? `
          <details class="event-payload-wrap">
            <summary class="event-payload-toggle">查看 payload</summary>
            <pre class="event-payload">${escapeHtml(payloadText)}</pre>
          </details>
        ` : ""}
      </article>
    `;
  }).join("");
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

function setActionLink(id, url, enabled) {
  const el = $(id);
  if (!el) {
    return;
  }
  el.href = enabled && url ? url : "#";
  el.dataset.url = enabled && url ? url : "";
  el.classList.toggle("disabled", !enabled);
  el.setAttribute("aria-disabled", enabled ? "false" : "true");
}

function resolveManifestArtifactUrl(manifestPayload, artifactKey) {
  const items = Array.isArray(manifestPayload?.items) ? manifestPayload.items : [];
  const item = items.find((entry) => entry?.artifact_key === artifactKey && entry?.ready);
  const rawUrl = item?.resource_url || item?.resource_path || "";
  if (!rawUrl) {
    return "";
  }
  if (artifactKey !== "markdown_bundle_zip") {
    return rawUrl;
  }
  const separator = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${separator}include_job_dir=true`;
}

export function updateActionButtons(job, manifestPayload = null) {
  const actions = resolveJobActions(job);
  setActionLink("download-btn", actions.bundle, actions.bundleEnabled && !!actions.bundle);
  const markdownBundleUrl = resolveManifestArtifactUrl(manifestPayload, "markdown_bundle_zip");
  setActionLink("markdown-bundle-btn", markdownBundleUrl, !!markdownBundleUrl);
  setActionLink("pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
  setActionLink("markdown-btn", actions.markdownJson, actions.markdownJsonEnabled && !!actions.markdownJson);
  setActionLink("markdown-raw-btn", actions.markdownRaw, actions.markdownRawEnabled && !!actions.markdownRaw);
  $("cancel-btn").disabled = !(actions.cancelEnabled && !!actions.cancel);
}

export function setWorkflowSections(job = null) {
  const normalized = job ? normalizeJobPayload(job) : null;
  const hasJob = Boolean(normalized && normalized.job_id);
  const shell = $("app-shell");
  $("status-section").classList.toggle("hidden", !hasJob);
  if (!hasJob) {
    shell?.classList.remove("processing-mode", "result-mode");
    stopElapsedTicker();
    $("back-home-btn")?.classList.add("hidden");
    return;
  }
  const processing = !isTerminalStatus(normalized.status);
  shell?.classList.toggle("processing-mode", processing);
  shell?.classList.toggle("result-mode", !processing);
  $("back-home-btn")?.classList.toggle("hidden", processing);
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
  const tile = $("file")?.closest(".upload-tile");
  tile?.classList.add("is-uploading");
  tile?.classList.remove("is-ready");
  $("upload-action-slot")?.classList.add("hidden");
  const hasNumbers = Number.isFinite(loaded) && Number.isFinite(total) && total > 0;
  const fill = $("upload-fill");
  if (hasNumbers) {
    const percent = Math.max(0, Math.min(100, (loaded / total) * 100));
    if (fill) {
      fill.style.width = `${percent}%`;
    }
    $("upload-progress-text").textContent = `上传中 ${percent.toFixed(0)}%`;
    return;
  }
  if (fill) {
    fill.style.width = "18%";
  }
  $("upload-progress-text").textContent = "上传中";
}

export function resetUploadProgress() {
  $("upload-progress-panel").classList.add("hidden");
  const tile = $("file")?.closest(".upload-tile");
  tile?.classList.remove("is-uploading");
  const fill = $("upload-fill");
  if (fill) {
    fill.style.width = "0%";
  }
  $("upload-progress-text").textContent = "上传中";
}

export function clearFileInputValue() {
  const input = $("file");
  if (input) {
    input.value = "";
  }
}

export function resetUploadedFile() {
  stopElapsedTicker();
  state.uploadId = "";
  state.uploadedFileName = "";
  state.uploadedPageCount = 0;
  state.uploadedBytes = 0;
  state.currentJobStartedAt = "";
  state.currentJobFinishedAt = "";
  $("file").value = "";
  $("submit-btn").disabled = true;
  $("upload-action-slot")?.classList.add("hidden");
  $("file")?.closest(".upload-tile")?.classList.remove("is-ready");
  $("upload-status").textContent = "未上传文件";
  $("upload-status")?.classList.add("hidden");
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

export function renderJob(payload, eventsPayload = null, manifestPayload = null) {
  const job = normalizeJobPayload(payload);
  state.currentJobSnapshot = job;
  state.currentJobId = job.job_id || state.currentJobId;
  state.currentJobStartedAt = resolveElapsedStart(job);
  state.currentJobFinishedAt = (job.finished_at || job.updated_at || "").trim();
  setWorkflowSections(job);
  safeSetText("job-id", job.job_id || "-");
  safeSetText("job-summary", summarizeStatus(job.status || "idle"));
  safeSetText("job-stage-detail", summarizeStageDetail(job));
  safeSetText("job-finished-at", formatJobFinishedAt(job));
  safeSetText("query-job-finished-at", formatJobFinishedAt(job));
  if ($("job-id-input")) {
    $("job-id-input").value = job.job_id || "";
  }
  setStatus(job.status || "idle");
  setLinearProgress(
    "job-progress-bar",
    "job-progress-text",
    job.progress_current,
    job.progress_total,
    "-",
    job.progress_percent,
  );
  safeSetText("error-box", summarizePublicError(job));
  safeSetText("diagnostic-box", summarizeDiagnostic(job));
  updateActionButtons(job, manifestPayload);
  updateRing(job);
  updateDetailDialog(job);
  renderRuntimeDetails(job);
  renderStageHistory(job);
  renderFailureDetails(job);
  renderEvents(eventsPayload);
  startElapsedTicker();
  updateJobWarning(job.status || "idle");
}
