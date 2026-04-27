import { $ } from "./dom.js";
import { buildFrontendPageUrl } from "./config.js";
import { DEFAULT_FILE_LABEL } from "./constants.js";
import {
  hasReadyManifestArtifact,
  resolveManifestArtifactUrl,
} from "./job-artifacts.js";
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
  summarizeStageLabel,
  summarizeStageDetail,
  summarizeStatus,
} from "./job.js";

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
  const stageIcon = $("status-stage-icon");
  const pdfBtn = $("pdf-btn");
  const readerBtn = $("reader-btn");
  const actionRow = document.querySelector(".status-ring-downloads");
  if (!ringLabel || !ringValue || !ringElapsed || !stageIcon || !pdfBtn || !readerBtn || !actionRow) {
    return;
  }
  const presentation = resolveDisplayedStagePresentation(job, state.currentJobEvents);
  const stageText = presentation.detail;
  const ringLabelText = presentation.label;
  const ringValueText = stageText || "准备中";
  const iconMarkup = stageIconMarkup(job.status, stageText);
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setStagePresentation && !statusCard?.renderSnapshot) {
    statusCard.setStagePresentation({
      label: ringLabelText,
      value: ringValueText,
      iconMarkup,
    });
  } else {
    ringLabel.textContent = ringLabelText;
    ringValue.textContent = ringValueText;
    stageIcon.innerHTML = iconMarkup;
  }
  const pdfReady = !pdfBtn.classList.contains("disabled") && job.status === "succeeded";
  const readerReady = !readerBtn.classList.contains("disabled") && job.status === "succeeded";
  if (statusCard?.syncPrimaryActions && !statusCard?.renderSnapshot) {
    statusCard.syncPrimaryActions({ pdfReady, readerReady });
  } else {
    pdfBtn.classList.toggle("hidden", !pdfReady);
    readerBtn.classList.toggle("hidden", !readerReady);
    actionRow.classList.remove("hidden");
  }
}

function updateDetailDialog(job) {
  const stageText = summarizeStageDetail(job);
  const note = job.status === "failed"
    ? "查看失败原因、建议与事件流"
    : job.status === "succeeded"
      ? "任务已完成，可查看概览与事件流"
      : "查看任务概览、失败原因与事件流";
  const component = document.querySelector("status-detail-dialog");
  if (component?.setHeadline) {
    component.setHeadline({
      iconMarkup: stageIconMarkup(job.status, stageText),
      jobId: job.job_id || "-",
      note,
    });
    return;
  }
  safeSetHtml("status-detail-head-icon", stageIconMarkup(job.status, stageText));
  safeSetText("status-detail-job-id", job.job_id || "-");
  safeSetText("status-detail-head-note", note);
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
  const component = document.querySelector("status-detail-dialog");
  const presentation = resolveDisplayedStagePresentation(job, state.currentJobEvents);
  const details = {
    currentStage: presentation.detail,
    stageElapsed: durations.stageElapsedText,
    totalElapsed: durations.totalElapsedText,
    retryCount: `${job.retry_count ?? 0}`,
    lastTransition: job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-",
    terminalReason: summarizeRuntimeField(job.terminal_reason),
    inputProtocol: summarizeInvocationProtocol(job),
    stageSpecVersion: summarizeInvocationSchemaVersion(job),
    mathMode: summarizeMathMode(job),
  };
  if (component?.setRuntimeDetails && !component?.renderSnapshot) {
    component.setRuntimeDetails(details);
    return;
  }
  safeSetText("runtime-current-stage", details.currentStage);
  safeSetText("runtime-stage-elapsed", details.stageElapsed);
  safeSetText("runtime-total-elapsed", details.totalElapsed);
  safeSetText("runtime-retry-count", details.retryCount);
  safeSetText("runtime-last-transition", details.lastTransition);
  safeSetText("runtime-terminal-reason", details.terminalReason);
  safeSetText("runtime-input-protocol", details.inputProtocol);
  safeSetText("runtime-stage-spec-version", details.stageSpecVersion);
  safeSetText("runtime-math-mode", details.mathMode);
}

function renderFailureDetails(job) {
  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  const failureLastLogLine = failure.last_log_line
    || failureDiagnostic.last_log_line
    || failure.raw_excerpt
    || failure.raw_exception_message
    || (Array.isArray(job.log_tail) && job.log_tail.length ? job.log_tail[job.log_tail.length - 1] : "");
  const details = {
    summary: summarizeRuntimeField(
      failure.summary || failure.detail || job.final_failure_summary || failureDiagnostic.summary || failureDiagnostic.detail || failure.raw_excerpt,
    ),
    category: summarizeRuntimeField(
      failure.category || failure.failure_category || job.final_failure_category || failureDiagnostic.type || failureDiagnostic.error_kind || failure.error_type || failure.failure_code,
    ),
    stage: summarizeRuntimeField(
      failure.stage || failure.failed_stage || failure.provider_stage || failureDiagnostic.stage || failureDiagnostic.failed_stage,
    ),
    rootCause: summarizeRuntimeField(
      failure.root_cause || failureDiagnostic.root_cause || failure.raw_exception_type || failure.upstream_host,
    ),
    suggestion: summarizeRuntimeField(
      failure.suggestion || failureDiagnostic.suggestion || failure.failure_code,
    ),
    lastLogLine: summarizeRuntimeField(
      failureLastLogLine,
    ),
  };
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  details.retryable = typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-";
  const component = document.querySelector("status-detail-dialog");
  if (component?.setFailureDetails && !component?.renderSnapshot) {
    component.setFailureDetails(details);
    return;
  }
  safeSetText("failure-summary", details.summary);
  safeSetText("failure-category", details.category);
  safeSetText("failure-stage", details.stage);
  safeSetText("failure-root-cause", details.rootCause);
  safeSetText("failure-suggestion", details.suggestion);
  safeSetText("failure-last-log-line", details.lastLogLine);
  safeSetText("failure-retryable", details.retryable);
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
  const history = resolveStageHistory(job);
  if (history.length === 0) {
    const component = document.querySelector("status-detail-dialog");
    if (component?.renderStageHistory) {
      component.renderStageHistory({
        markup: "",
        emptyText: "后端未返回 runtime.stage_history",
        hasItems: false,
      });
      return;
    }
    const list = $("overview-stage-list");
    const empty = $("overview-stage-empty");
    if (!list || !empty) {
      return;
    }
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.textContent = "后端未返回 runtime.stage_history";
    empty.classList.remove("hidden");
    return;
  }
  const markup = history.map((entry, index) => {
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
  const component = document.querySelector("status-detail-dialog");
  if (component?.renderStageHistory) {
    component.renderStageHistory({
      markup,
      emptyText: "后端未返回 runtime.stage_history",
      hasItems: true,
    });
    return;
  }
  const list = $("overview-stage-list");
  const empty = $("overview-stage-empty");
  if (!list || !empty) {
    return;
  }
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = markup;
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
  if (items.length === 0) {
    const component = document.querySelector("status-detail-dialog");
    if (component?.renderEvents) {
      component.renderEvents({
        markup: "",
        count: 0,
        emptyText: "暂无事件",
        hasItems: false,
      });
      return;
    }
    const list = $("events-list");
    const empty = $("events-empty");
    const status = $("events-status");
    if (!list || !empty || !status) {
      return;
    }
    status.textContent = "暂无事件";
    list.innerHTML = "";
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  const markup = items.map((item) => {
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
  const component = document.querySelector("status-detail-dialog");
  if (component?.renderEvents) {
    component.renderEvents({
      markup,
      count: items.length,
      emptyText: "暂无事件",
      hasItems: true,
    });
    return;
  }
  const list = $("events-list");
  const empty = $("events-empty");
  const status = $("events-status");
  if (!list || !empty || !status) {
    return;
  }
  status.textContent = `最近 ${items.length} 条`;
  empty.classList.add("hidden");
  list.classList.remove("hidden");
  list.innerHTML = markup;
}

function buildStatusDetailSnapshot(job, eventsPayload) {
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const stageText = presentation.detail;
  const note = job.status === "failed"
    ? "查看失败原因、建议与事件流"
    : job.status === "succeeded"
      ? "任务已完成，可查看概览与事件流"
      : "查看任务概览、失败原因与事件流";
  const runtimeDurations = resolveLiveDurations(job);
  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  const failureLastLogLine = failure.last_log_line
    || failureDiagnostic.last_log_line
    || failure.raw_excerpt
    || failure.raw_exception_message
    || (Array.isArray(job.log_tail) && job.log_tail.length ? job.log_tail[job.log_tail.length - 1] : "");
  const history = resolveStageHistory(job);
  const stageHistoryMarkup = history.map((entry, index) => {
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
  const events = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const eventsMarkup = events.map((item) => {
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

  return {
    headline: {
      iconMarkup: stageIconMarkup(job.status, stageText),
      jobId: job.job_id || "-",
      note,
    },
    runtime: {
      currentStage: presentation.detail,
      stageElapsed: runtimeDurations.stageElapsedText,
      totalElapsed: runtimeDurations.totalElapsedText,
      retryCount: `${job.retry_count ?? 0}`,
      lastTransition: job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-",
      terminalReason: summarizeRuntimeField(job.terminal_reason),
      inputProtocol: summarizeInvocationProtocol(job),
      stageSpecVersion: summarizeInvocationSchemaVersion(job),
      mathMode: summarizeMathMode(job),
    },
    failure: {
      summary: summarizeRuntimeField(
        failure.summary || failure.detail || job.final_failure_summary || failureDiagnostic.summary || failureDiagnostic.detail || failure.raw_excerpt,
      ),
      category: summarizeRuntimeField(
        failure.category || failure.failure_category || job.final_failure_category || failureDiagnostic.type || failureDiagnostic.error_kind || failure.error_type || failure.failure_code,
      ),
      stage: summarizeRuntimeField(
        failure.stage || failure.failed_stage || failure.provider_stage || failureDiagnostic.stage || failureDiagnostic.failed_stage,
      ),
      rootCause: summarizeRuntimeField(
        failure.root_cause || failureDiagnostic.root_cause || failure.raw_exception_type || failure.upstream_host,
      ),
      suggestion: summarizeRuntimeField(
        failure.suggestion || failureDiagnostic.suggestion || failure.failure_code,
      ),
      lastLogLine: summarizeRuntimeField(
        failureLastLogLine,
      ),
      retryable: typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-",
    },
    stageHistory: {
      markup: stageHistoryMarkup,
      emptyText: "后端未返回 runtime.stage_history",
      hasItems: history.length > 0,
    },
    events: {
      markup: eventsMarkup,
      count: events.length,
      emptyText: "暂无事件",
      hasItems: events.length > 0,
    },
  };
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

function buildReaderPageUrl(jobId) {
  const normalizedJobId = `${jobId || ""}`.trim();
  if (!normalizedJobId) {
    return "";
  }
  return buildFrontendPageUrl("./reader.html", {
    job_id: normalizedJobId,
  });
}

export function updateActionButtons(job, manifestPayload = null) {
  const actions = resolveJobActions(job);
  setActionLink("download-btn", actions.bundle, actions.bundleEnabled && !!actions.bundle);
  const markdownBundleUrl = resolveManifestArtifactUrl(manifestPayload, "markdown_bundle_zip", {
    includeJobDir: true,
  });
  setActionLink("markdown-bundle-btn", markdownBundleUrl, !!markdownBundleUrl);
  setActionLink("pdf-btn", actions.pdf, actions.pdfEnabled && !!actions.pdf);
  setActionLink("markdown-btn", actions.markdownJson, actions.markdownJsonEnabled && !!actions.markdownJson);
  setActionLink("markdown-raw-btn", actions.markdownRaw, actions.markdownRawEnabled && !!actions.markdownRaw);
  const readerEnabled = Boolean(
    job?.job_id
    && hasReadyManifestArtifact(manifestPayload, "source_pdf")
    && (hasReadyManifestArtifact(manifestPayload, "pdf")
      || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
      || hasReadyManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
  setActionLink("reader-btn", buildReaderPageUrl(job?.job_id), readerEnabled);
  setActionLink("compare-reader-btn", buildReaderPageUrl(job?.job_id), readerEnabled);
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.setCancelEnabled && !statusCard?.renderSnapshot) {
    statusCard.setCancelEnabled(actions.cancelEnabled && !!actions.cancel);
  } else {
    $("cancel-btn").disabled = !(actions.cancelEnabled && !!actions.cancel);
  }
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

export function setLinearProgress(barId, textId, current, total, fallbackText = "-", percentOverride = null) {
  if (barId === "job-progress-bar" && textId === "job-progress-text") {
    const statusCard = document.querySelector("job-status-card");
    if (statusCard?.setProgress && !statusCard?.renderSnapshot) {
      statusCard.setProgress({
        current,
        total,
        fallbackText,
        percent: percentOverride,
      });
      return;
    }
  }
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
  safeSetText("diagnostic-box", summarizeDiagnostic(job));
  updateActionButtons(job, manifestPayload);
  const actions = resolveJobActions(job);
  const readerEnabled = Boolean(
    job?.job_id
    && hasReadyManifestArtifact(manifestPayload, "source_pdf")
    && (hasReadyManifestArtifact(manifestPayload, "pdf")
      || hasReadyManifestArtifact(manifestPayload, "translated_pdf")
      || hasReadyManifestArtifact(manifestPayload, "result_pdf")
      || actions.pdfEnabled),
  );
  const stageText = stagePresentation.detail;
  const statusCard = document.querySelector("job-status-card");
  if (statusCard?.renderSnapshot) {
    statusCard.renderSnapshot({
      label: stagePresentation.label,
      value: stageText || "准备中",
      iconMarkup: stageIconMarkup(job.status, stageText),
      elapsed: resolveLiveDurations(job).totalElapsedText,
      progressCurrent: stagePresentation.progressCurrent,
      progressTotal: stagePresentation.progressTotal,
      progressFallbackText: "-",
      progressPercent: job.progress_percent,
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
    updateDetailDialog(job);
    renderRuntimeDetails(job);
    renderStageHistory(job);
    renderFailureDetails(job);
    renderEvents(eventsPayload);
  }
  startElapsedTicker();
  updateJobWarning(job.status || "idle");
}

function latestStageEvent(job, eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
  const currentStage = `${job?.current_stage || job?.stage || ""}`.trim();
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index] || {};
    const itemStage = `${item.stage || ""}`.trim();
    if (!itemStage) {
      continue;
    }
    if (currentStage && itemStage !== currentStage) {
      continue;
    }
    if (!item.stage_detail && !item.message && !Number.isFinite(Number(item.progress_current))) {
      continue;
    }
    return item;
  }
  return null;
}

function resolveDisplayedStagePresentation(job, eventsPayload) {
  const fallback = {
    label: summarizeStageLabel(job),
    detail: summarizeStageDetail(job),
    progressCurrent: job?.progress_current,
    progressTotal: job?.progress_total,
  };
  const event = latestStageEvent(job, eventsPayload);
  if (!event) {
    return fallback;
  }
  const eventPayload = {
    ...job,
    status: job.status,
    current_stage: event.stage || job.current_stage || job.stage || "",
    stage_detail: event.stage_detail || event.message || job.stage_detail || "",
    progress_current: Number.isFinite(Number(event.progress_current)) ? Number(event.progress_current) : job.progress_current,
    progress_total: Number.isFinite(Number(event.progress_total)) ? Number(event.progress_total) : job.progress_total,
  };
  return {
    label: summarizeStageLabel(eventPayload),
    detail: summarizeStageDetail(eventPayload),
    progressCurrent: eventPayload.progress_current,
    progressTotal: eventPayload.progress_total,
  };
}
