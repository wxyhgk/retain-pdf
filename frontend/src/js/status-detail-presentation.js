import { renderStatusDetailSnapshotSections } from "./features/status-detail/view.js";
import { resolveDisplayedStagePresentation } from "./job-stage-presentation.js";
import { state } from "./state.js";
import {
  formatEventTimestamp,
  formatRuntimeDuration,
  isTerminalStatus,
  resolveJobActions,
  summarizeInvocationProtocol,
  summarizeInvocationSchemaVersion,
  summarizeRuntimeField,
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

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseIsoTime(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

export function resolveLiveDurations(job) {
  if (!job) {
    return {
      stageElapsedText: "-",
      totalElapsedText: "-",
    };
  }

  const status = job.status || "";
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

function statusDetailNote(status) {
  return status === "failed"
    ? "查看失败原因、建议与事件流"
    : status === "succeeded"
      ? "任务已完成，可查看概览与事件流"
      : "查看任务概览、失败原因与事件流";
}

function buildHeadline(job, stageText) {
  return {
    iconMarkup: stageIconMarkup(job.status, stageText),
    jobId: job.job_id || "-",
    note: statusDetailNote(job.status),
  };
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

function buildRuntimeDetails(job, eventsPayload) {
  const durations = resolveLiveDurations(job);
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  return {
    currentStage: summarizeStageName(job.current_stage || job.stage, presentation.detail),
    stageElapsed: durations.stageElapsedText,
    totalElapsed: durations.totalElapsedText,
    retryCount: `${job.retry_count ?? 0}`,
    lastTransition: job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-",
    terminalReason: summarizeRuntimeField(job.terminal_reason),
    inputProtocol: summarizeInvocationProtocol(job),
    stageSpecVersion: summarizeInvocationSchemaVersion(job),
    mathMode: summarizeMathMode(job),
  };
}

function buildFailureDetails(job) {
  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  const failureLastLogLine = failure.last_log_line
    || failureDiagnostic.last_log_line
    || failure.raw_excerpt
    || failure.raw_exception_message
    || (Array.isArray(job.log_tail) && job.log_tail.length ? job.log_tail[job.log_tail.length - 1] : "");
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  return {
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
  };
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
  const normalizedStage = `${stage || ""}`.trim().toLowerCase();
  if (
    normalizedStage.includes("upload")
    || normalizedStage.includes("submit")
    || normalizedStage.includes("queued")
  ) {
    return "上传 PDF";
  }
  if (
    normalizedStage.includes("ocr_processing")
    || normalizedStage.includes("ocr")
    || normalizedStage.includes("mineru")
    || normalizedStage.includes("paddle")
    || normalizedStage.includes("parsing")
    || normalizedStage.includes("normalization")
    || normalizedStage.includes("normaliz")
  ) {
    return "云端 OCR / 标准化";
  }
  if (
    normalizedStage.includes("translation_prepare")
    || normalizedStage.includes("continuation_review")
    || normalizedStage.includes("page_policies")
    || normalizedStage.includes("garbled")
    || normalizedStage.includes("translat")
  ) {
    return "翻译准备 / 跨栏跨页判断";
  }
  if (
    normalizedStage.includes("render")
    || normalizedStage.includes("saving")
    || normalizedStage.includes("compile")
    || normalizedStage.includes("overlay")
  ) {
    return "渲染 PDF";
  }
  switch (normalizedStage) {
    case "queued":
      return "排队中";
    case "running":
      return "处理中";
    case "translating":
      return "翻译";
    case "parsing":
    case "ocr":
      return "解析 / OCR";
    case "translation_prepare":
      return "翻译准备";
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
    const status = job.status || "";
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

function buildStageHistoryPresentation(job) {
  const history = resolveStageHistory(job);
  const markup = history.map((entry, index) => {
    const duration = resolveStageHistoryDuration(entry, job);
    const enterAt = entry?.enter_at ? formatEventTimestamp(entry.enter_at) : "-";
    const exitAt = entry?.exit_at ? formatEventTimestamp(entry.exit_at) : (isTerminalStatus(job.status) ? "-" : "进行中");
    const stageName = summarizeStageName(entry?.stage, entry?.detail);
    const stageKey = summarizeStageName(entry?.stage, "");
    const terminalText = entry?.terminal_status ? ` · ${entry.terminal_status}` : "";
    return `
      <article class="stage-history-item">
        <div class="stage-history-main">
          <span class="stage-history-index">${index + 1}</span>
          <div class="stage-history-copy">
            <div class="stage-history-title">${escapeHtml(stageName)}</div>
            <div class="stage-history-stage">${escapeHtml(stageKey)}</div>
            <div class="stage-history-meta">${escapeHtml(enterAt)} → ${escapeHtml(exitAt)}${escapeHtml(terminalText)}</div>
          </div>
        </div>
        <div class="stage-history-duration">${escapeHtml(formatRuntimeDuration(duration))}</div>
      </article>
    `;
  }).join("");
  return {
    markup,
    emptyText: "后端未返回 runtime.stage_history",
    hasItems: history.length > 0,
  };
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

function buildEventsPresentation(eventsPayload) {
  const items = Array.isArray(eventsPayload?.items) ? eventsPayload.items : [];
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
  return {
    markup,
    count: items.length,
    emptyText: "暂无事件",
    hasItems: items.length > 0,
  };
}

export function buildStatusDetailSnapshot(job, eventsPayload) {
  const presentation = resolveDisplayedStagePresentation(job, eventsPayload);
  const actions = resolveJobActions(job);
  const rerunEnabled = Boolean(actions.rerunEnabled && actions.rerun);

  return {
    headline: buildHeadline(job, presentation.detail),
    runtime: buildRuntimeDetails(job, eventsPayload),
    failure: buildFailureDetails(job),
    stageHistory: buildStageHistoryPresentation(job),
    events: buildEventsPresentation(eventsPayload),
    rerun: {
      enabled: rerunEnabled,
      status: rerunEnabled
        ? "后端支持从当前任务产物创建恢复任务。"
        : "当前任务暂不可从断点恢复。",
    },
  };
}

export function renderStatusDetailSections(job, eventsPayload) {
  const snapshot = buildStatusDetailSnapshot(job, eventsPayload);
  renderStatusDetailSnapshotSections(snapshot);
}
