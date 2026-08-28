import { $ } from "../dom/query.js";
import { summarizeRuntimeField } from "../job/formatters.js";

function escapeHtml(value) {
  return `${value ?? ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstDefinedValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return value;
    }
  }
  return "";
}

function stringifyDebugValue(value) {
  if (value == null || value === "") {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

export function applyDiagnostics(diagnostics, job, setText) {
  if (!diagnostics) {
    return;
  }
  setText("detail-failure-summary", summarizeRuntimeField(diagnostics.summary || diagnostics.failure_summary || job.final_failure_summary));
  setText("detail-failure-category", summarizeRuntimeField(diagnostics.category || diagnostics.failure_category || diagnostics.failed_category || job.final_failure_category));
  setText("detail-failure-stage", summarizeRuntimeField(diagnostics.failed_stage || diagnostics.stage || diagnostics.failed_substage));
  setText("detail-failure-root-cause", summarizeRuntimeField(diagnostics.root_cause || diagnostics.detail || diagnostics.raw_excerpt));
  setText("detail-failure-suggestion", summarizeRuntimeField(diagnostics.suggestion));
  setText("detail-failure-retryable", typeof diagnostics.retryable === "boolean" ? (diagnostics.retryable ? "Có" : "Không") : "-");
}

export function renderFailureDebugContext(job) {
  const container = $("detail-failure-debug-context");
  if (!container) {
    return;
  }
  const failure = job?.failure || {};
  const diagnostic = job?.failure_diagnostic || {};
  const rawDiagnostic = failure?.raw_diagnostic || diagnostic?.raw_diagnostic || {};
  const logTail = Array.isArray(job?.log_tail) ? job.log_tail.filter(Boolean).slice(-8) : [];
  const rows = [
    ["failed_stage", firstDefinedValue(failure.failed_stage, failure.stage, diagnostic.failed_stage, diagnostic.stage, job?.stage)],
    ["failure_code", firstDefinedValue(failure.failure_code, failure.code, diagnostic.failure_code, diagnostic.code)],
    ["failure_category", firstDefinedValue(failure.failure_category, failure.category, diagnostic.failure_category, diagnostic.category)],
    ["error_type", firstDefinedValue(failure.error_type, diagnostic.error_type, diagnostic.type, diagnostic.error_kind)],
    ["provider", firstDefinedValue(failure.provider, diagnostic.provider)],
    ["provider_stage", firstDefinedValue(failure.provider_stage, diagnostic.provider_stage)],
    ["provider_code", firstDefinedValue(failure.provider_code, diagnostic.provider_code)],
    ["upstream_host", firstDefinedValue(failure.upstream_host, diagnostic.upstream_host)],
    ["retryable", firstDefinedValue(failure.retryable, diagnostic.retryable)],
    ["raw_exception_type", firstDefinedValue(failure.raw_exception_type, diagnostic.raw_exception_type, rawDiagnostic.raw_exception_type)],
    ["raw_exception_message", firstDefinedValue(failure.raw_exception_message, diagnostic.raw_exception_message, rawDiagnostic.raw_exception_message)],
    ["raw_excerpt", firstDefinedValue(failure.raw_excerpt, diagnostic.raw_excerpt)],
    ["traceback", firstDefinedValue(failure.traceback, diagnostic.traceback, rawDiagnostic.traceback)],
    ["log_tail", logTail.length ? logTail.join("\n") : ""],
  ]
    .map(([label, value]) => [label, stringifyDebugValue(value)])
    .filter(([, value]) => value);

  if (!rows.length) {
    container.innerHTML = '<div class="detail-empty">Chưa có ngữ cảnh lỗi có cấu trúc</div>';
    return;
  }
  container.innerHTML = rows.map(([label, value]) => `
    <div class="detail-debug-row">
      <div class="detail-debug-label">${escapeHtml(label)}</div>
      <pre class="detail-debug-value">${escapeHtml(value)}</pre>
    </div>
  `).join("");
}
