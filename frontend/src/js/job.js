import { resolveJobMarkdownContract, toAbsoluteApiUrl } from "./job-artifacts.js";
import { summarizeStageDetail, summarizeStageLabel } from "./job-status-summary.js";

export { summarizeStageDetail, summarizeStageLabel } from "./job-status-summary.js";

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function objectOrNull(value) {
  return value && typeof value === "object" ? value : null;
}

export function unwrapEnvelope(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "code" in payload) {
    return payload.data;
  }
  return payload;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function isTerminalStatus(status) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

export function normalizeJobPayload(payload) {
  const unwrapped = unwrapEnvelope(payload) || {};
  const timestamps = unwrapped.timestamps || {};
  const progress = unwrapped.progress || {};
  const artifacts = unwrapped.artifacts || {};
  const runtime = unwrapped.runtime || {};
  const failure = unwrapped.failure || null;
  const invocation = unwrapped.invocation || {};
  const status = unwrapped.status || "idle";
  let progressCurrent = numberOrNull(progress.current ?? unwrapped.progress_current);
  let progressTotal = numberOrNull(progress.total ?? unwrapped.progress_total);
  let progressPercent = numberOrNull(progress.percent);

  if (isTerminalStatus(status)) {
    if (progressTotal !== null) {
      progressCurrent = progressTotal;
    }
    if (progressCurrent !== null && progressTotal === null) {
      progressTotal = progressCurrent;
    }
    if (status === "succeeded") {
      progressPercent = 100;
    }
  }

  return {
    raw_response: unwrapped,
    request_payload: unwrapped.request_payload || null,
    request_payload_page_ranges: firstNonEmpty(unwrapped.request_payload?.ocr?.page_ranges),
    request_payload_math_mode: firstNonEmpty(unwrapped.request_payload?.translation?.math_mode),
    job_id: unwrapped.job_id || "",
    workflow: unwrapped.workflow || unwrapped.job_type || "",
    job_type: unwrapped.job_type || unwrapped.workflow || "",
    status,
    stage: unwrapped.stage || "",
    stage_detail: unwrapped.stage_detail || "",
    progress_current: progressCurrent,
    progress_total: progressTotal,
    progress_percent: progressPercent,
    created_at: timestamps.created_at || unwrapped.created_at || "",
    updated_at: timestamps.updated_at || unwrapped.updated_at || "",
    started_at: timestamps.started_at || unwrapped.started_at || "",
    finished_at: timestamps.finished_at || unwrapped.finished_at || "",
    duration_seconds: numberOrNull(timestamps.duration_seconds ?? unwrapped.duration_seconds),
    links: unwrapped.links || {},
    actions: unwrapped.actions || {},
    artifacts,
    ocr_job: objectOrNull(unwrapped.ocr_job),
    runtime,
    invocation,
    failure,
    normalization_summary: objectOrNull(unwrapped.normalization_summary),
    glossary_summary: objectOrNull(unwrapped.glossary_summary),
    current_stage: firstNonEmpty(runtime.current_stage, unwrapped.stage),
    stage_started_at: firstNonEmpty(runtime.stage_started_at),
    last_stage_transition_at: firstNonEmpty(runtime.last_stage_transition_at),
    active_stage_elapsed_ms: numberOrNull(runtime.active_stage_elapsed_ms),
    total_elapsed_ms: numberOrNull(runtime.total_elapsed_ms),
    retry_count: numberOrNull(runtime.retry_count) ?? 0,
    last_retry_at: firstNonEmpty(runtime.last_retry_at),
    stage_history: arrayOrEmpty(runtime.stage_history),
    terminal_reason: firstNonEmpty(runtime.terminal_reason),
    final_failure_category: firstNonEmpty(runtime.final_failure_category),
    final_failure_summary: firstNonEmpty(runtime.final_failure_summary),
    failure_diagnostic: unwrapped.failure_diagnostic || null,
    log_tail: Array.isArray(unwrapped.log_tail) ? unwrapped.log_tail : [],
    error: unwrapped.error || "",
    pdf_ready: Boolean(artifacts.pdf_ready ?? artifacts.pdf?.ready),
    markdown_ready: Boolean(artifacts.markdown_ready ?? artifacts.markdown?.ready),
    bundle_ready: Boolean(artifacts.bundle_ready ?? artifacts.bundle?.ready),
  };
}

export function summarizeInvocationProtocol(payload) {
  const invocation = payload?.invocation || {};
  const inputProtocol = firstNonEmpty(invocation.input_protocol);
  if (inputProtocol === "stage_spec") {
    return "Stage Spec";
  }
  return "-";
}

export function summarizeInvocationSchemaVersion(payload) {
  const invocation = payload?.invocation || {};
  return firstNonEmpty(invocation.stage_spec_schema_version) || "-";
}

export function resolveJobActions(job) {
  const artifacts = job.artifacts || {};
  const links = job.links || {};
  const actions = job.actions || {};
  const artifactActions = artifacts.actions || {};
  const markdownContract = resolveJobMarkdownContract(job);
  const bundleEnabled = Boolean(
    actions.download_bundle?.enabled
    || artifactActions.download_bundle?.enabled
    || artifacts.bundle?.ready
    || artifacts.bundle_ready
    || job.bundle_ready
  );
  const pdfEnabled = Boolean(
    actions.download_pdf?.enabled
    || artifactActions.download_pdf?.enabled
    || artifacts.pdf?.ready
    || artifacts.pdf_ready
    || job.pdf_ready
  );
  const markdownJsonEnabled = Boolean(
    actions.open_markdown?.enabled
    || artifactActions.open_markdown?.enabled
    || markdownContract.ready
  );
  const markdownRawEnabled = Boolean(
    actions.open_markdown_raw?.enabled
    || artifactActions.open_markdown_raw?.enabled
    || markdownContract.ready
  );
  return {
    cancelEnabled: Boolean(actions.cancel?.enabled ?? artifactActions.cancel?.enabled ?? (job.status === "queued" || job.status === "running")),
    bundleEnabled,
    pdfEnabled,
    markdownJsonEnabled,
    markdownRawEnabled,
    cancel: toAbsoluteApiUrl(firstNonEmpty(
      actions.cancel?.url,
      artifactActions.cancel?.url,
      actions.cancel_url,
      links.cancel_url,
      links.cancel_path,
    )),
    bundle: toAbsoluteApiUrl(firstNonEmpty(
      actions.download_bundle?.url,
      artifactActions.download_bundle?.url,
      artifacts.bundle?.url,
      artifacts.bundle?.path,
    )),
    pdf: toAbsoluteApiUrl(firstNonEmpty(
      actions.download_pdf?.url,
      artifactActions.download_pdf?.url,
      artifacts.pdf?.url,
      artifacts.pdf?.path,
    )),
    markdownJson: markdownContract.jsonUrl || toAbsoluteApiUrl(firstNonEmpty(
      actions.open_markdown?.url,
      artifactActions.open_markdown?.url,
    )),
    markdownRaw: markdownContract.rawUrl || toAbsoluteApiUrl(firstNonEmpty(
      actions.open_markdown_raw?.url,
      artifactActions.open_markdown_raw?.url,
    )),
  };
}

export function summarizeStatus(status) {
  switch (status) {
    case "queued":
      return "任务已提交，等待后端开始处理。";
    case "running":
      return "任务正在处理中，请等待当前阶段完成。";
    case "succeeded":
      return "任务已完成，可以下载结果。";
    case "canceled":
      return "任务已取消。";
    case "failed":
      return "任务已失败，请检查报错提示后重试。";
    default:
      return "等待提交任务。";
  }
}

export function summarizePublicError(payload) {
  if (payload.status === "canceled") {
    return "任务已取消。";
  }
  if (payload.status === "failed") {
    const detail = firstNonEmpty(
      payload.failure?.summary,
      payload.failure?.detail,
      payload.final_failure_summary,
      payload.failure_diagnostic?.summary,
      payload.failure_diagnostic?.detail,
      payload.stage_detail,
      payload.error,
      payload.raw_response?.message,
      payload.failure?.raw_excerpt,
      payload.failure?.raw_exception_message,
      payload.failure?.suggestion,
    );
    return detail || "任务失败。请检查输入文件与配置后重试。";
  }
  if (payload.error) {
    return payload.error;
  }
  return "-";
}

export function summarizeDiagnostic(payload) {
  const failure = payload.failure;
  if (failure) {
    const retryable = firstDefined(failure.retryable, payload.failure_diagnostic?.retryable);
    const lines = [
      `阶段: ${firstNonEmpty(failure.stage, failure.failed_stage, failure.provider_stage) || "-"}`,
      `分类: ${firstNonEmpty(failure.category, failure.failure_category, failure.error_type, failure.failure_code) || "-"}`,
      `摘要: ${firstNonEmpty(failure.summary, failure.detail, failure.raw_excerpt, failure.raw_exception_message) || "-"}`,
      `可重试: ${typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-"}`,
    ];
    if (firstNonEmpty(failure.upstream_host, failure.provider)) {
      lines.push(`上游: ${firstNonEmpty(failure.upstream_host, failure.provider)}`);
    }
    if (firstNonEmpty(failure.root_cause, failure.raw_exception_type)) {
      lines.push(`根因: ${firstNonEmpty(failure.root_cause, failure.raw_exception_type)}`);
    }
    if (failure.suggestion) {
      lines.push(`建议: ${failure.suggestion}`);
    }
    if (firstNonEmpty(failure.last_log_line, failure.raw_excerpt)) {
      lines.push(`最后日志: ${firstNonEmpty(failure.last_log_line, failure.raw_excerpt)}`);
    }
    return lines.join("\n");
  }
  const diag = payload.failure_diagnostic;
  if (!diag) {
    return "-";
  }
  const lines = [
    `阶段: ${diag.stage || diag.failed_stage || "-"}`,
    `类型: ${diag.type || diag.error_kind || diag.error_type || "-"}`,
    `摘要: ${diag.summary || diag.detail || diag.raw_excerpt || "-"}`,
    `可重试: ${typeof diag.retryable === "boolean" ? (diag.retryable ? "是" : "否") : "-"}`,
  ];
  if (diag.upstream_host) {
    lines.push(`上游主机: ${diag.upstream_host}`);
  }
  if (diag.root_cause || diag.raw_exception_type) {
    lines.push(`根因: ${diag.root_cause || diag.raw_exception_type}`);
  }
  if (diag.suggestion) {
    lines.push(`建议: ${diag.suggestion}`);
  }
  if (diag.last_log_line || diag.raw_excerpt) {
    lines.push(`最后日志: ${diag.last_log_line || diag.raw_excerpt}`);
  }
  return lines.join("\n");
}

function formatDurationMs(ms) {
  const num = Number(ms);
  if (!Number.isFinite(num) || num < 0) {
    return "-";
  }
  const totalSeconds = Math.floor(num / 1000);
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

export function summarizeRuntimeField(value) {
  const text = firstNonEmpty(value);
  return text || "-";
}

export function formatRuntimeDuration(ms) {
  return formatDurationMs(ms);
}

export function formatEventTimestamp(value) {
  const rawValue = `${value || ""}`.trim();
  if (!rawValue) {
    return "-";
  }
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return rawValue;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function formatJobFinishedAt(payload) {
  if (!payload || !isTerminalStatus(payload.status)) {
    return "-";
  }
  const rawValue = (payload.finished_at || payload.updated_at || "").trim();
  if (!rawValue) {
    return "-";
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return rawValue;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function formatJobDuration(payload) {
  if (!payload || !isTerminalStatus(payload.status)) {
    return "-";
  }
  const startedRaw = (payload.started_at || "").trim();
  const finishedRaw = (payload.finished_at || payload.updated_at || "").trim();
  if (!startedRaw || !finishedRaw) {
    return "-";
  }

  const startedAt = new Date(startedRaw);
  const finishedAt = new Date(finishedRaw);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime())) {
    return "-";
  }

  const totalSeconds = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
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
