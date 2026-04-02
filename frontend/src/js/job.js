import { apiBase } from "./config.js";

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

function toAbsoluteUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${apiBase()}${trimmed}`;
  }
  return `${apiBase()}/${trimmed}`;
}

export function isTerminalStatus(status) {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

export function normalizeJobPayload(payload) {
  const unwrapped = unwrapEnvelope(payload) || {};
  const timestamps = unwrapped.timestamps || {};
  const progress = unwrapped.progress || {};
  const artifacts = unwrapped.artifacts || {};
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
    failure_diagnostic: unwrapped.failure_diagnostic || null,
    log_tail: Array.isArray(unwrapped.log_tail) ? unwrapped.log_tail : [],
    error: unwrapped.error || "",
    pdf_ready: Boolean(artifacts.pdf_ready ?? artifacts.pdf?.ready),
    markdown_ready: Boolean(artifacts.markdown_ready ?? artifacts.markdown?.ready),
    bundle_ready: Boolean(artifacts.bundle_ready ?? artifacts.bundle?.ready),
  };
}

export function resolveJobActions(job) {
  const artifacts = job.artifacts || {};
  const links = job.links || {};
  const actions = job.actions || {};
  const artifactActions = artifacts.actions || {};
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
    || artifacts.markdown?.ready
    || artifacts.markdown_ready
    || job.markdown_ready
  );
  const markdownRawEnabled = Boolean(
    actions.open_markdown_raw?.enabled
    || artifactActions.open_markdown_raw?.enabled
    || artifacts.markdown?.ready
    || artifacts.markdown_ready
    || job.markdown_ready
  );
  return {
    cancelEnabled: Boolean(actions.cancel?.enabled ?? artifactActions.cancel?.enabled ?? (job.status === "queued" || job.status === "running")),
    bundleEnabled,
    pdfEnabled,
    markdownJsonEnabled,
    markdownRawEnabled,
    cancel: toAbsoluteUrl(firstNonEmpty(
      actions.cancel?.url,
      artifactActions.cancel?.url,
      actions.cancel_url,
      links.cancel_url,
      links.cancel_path,
    )),
    bundle: toAbsoluteUrl(firstNonEmpty(
      actions.download_bundle?.url,
      artifactActions.download_bundle?.url,
      actions.download_bundle_url,
      actions.bundle_url,
      artifacts.bundle?.url,
      artifacts.bundle?.path,
      artifacts.bundle_url,
    )),
    pdf: toAbsoluteUrl(firstNonEmpty(
      actions.download_pdf?.url,
      artifactActions.download_pdf?.url,
      actions.download_pdf_url,
      actions.pdf_url,
      artifacts.pdf?.url,
      artifacts.pdf?.path,
      artifacts.pdf_url,
    )),
    markdownJson: toAbsoluteUrl(firstNonEmpty(
      actions.open_markdown?.url,
      artifactActions.open_markdown?.url,
      actions.open_markdown_json_url,
      actions.markdown_json_url,
      artifacts.markdown?.json_url,
      artifacts.markdown?.json_path,
      artifacts.markdown_url,
    )),
    markdownRaw: toAbsoluteUrl(firstNonEmpty(
      actions.open_markdown_raw?.url,
      artifactActions.open_markdown_raw?.url,
      actions.download_markdown_url,
      actions.markdown_raw_url,
      artifacts.markdown?.raw_url,
      artifacts.markdown?.raw_path,
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

export function summarizeStageDetail(payload) {
  const detail = (payload.stage_detail || "").trim();
  if (detail) {
    return detail;
  }
  switch (payload.status) {
    case "queued":
      return "排队中";
    case "running":
      return "后端正在处理当前文档";
    case "succeeded":
      return "处理完成";
    case "failed":
      return "处理失败";
    default:
      return "-";
  }
}

export function summarizePublicError(payload) {
  if (payload.status === "canceled") {
    return "任务已取消。";
  }
  if (payload.status === "failed") {
    const detail = firstNonEmpty(
      payload.failure_diagnostic?.summary,
      payload.stage_detail,
      payload.error,
      payload.raw_response?.message,
    );
    return detail || "任务失败。请检查输入文件与配置后重试。";
  }
  if (payload.error) {
    return payload.error;
  }
  return "-";
}

export function summarizeDiagnostic(payload) {
  const diag = payload.failure_diagnostic;
  if (!diag) {
    return "-";
  }
  const lines = [
    `阶段: ${diag.failed_stage || "-"}`,
    `类型: ${diag.error_kind || "-"}`,
    `摘要: ${diag.summary || "-"}`,
    `可重试: ${diag.retryable ? "是" : "否"}`,
  ];
  if (diag.upstream_host) {
    lines.push(`上游主机: ${diag.upstream_host}`);
  }
  if (diag.root_cause) {
    lines.push(`根因: ${diag.root_cause}`);
  }
  if (diag.suggestion) {
    lines.push(`建议: ${diag.suggestion}`);
  }
  if (diag.last_log_line) {
    lines.push(`最后日志: ${diag.last_log_line}`);
  }
  return lines.join("\n");
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
