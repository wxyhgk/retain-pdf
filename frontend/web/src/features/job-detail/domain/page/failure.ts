import { summarizeRuntimeField, firstDefinedValue, stringifyDebugValue } from "@retainpdf/domain/job";
import { escapeHtml } from "@/platform/utils/html-formatting.js";
import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import type { DetailSetText } from "./page-ports.js";
import { asRecord } from "../dialog/formatters.js";

export { firstDefinedValue, stringifyDebugValue };

export function applyDiagnostics(
  diagnostics: Record<string, unknown> | null | undefined,
  job: JobLike | JobPayload | null | undefined,
  setText: DetailSetText,
) {
  if (!diagnostics) {
    return;
  }
  setText("detail-failure-summary", summarizeRuntimeField(diagnostics.summary || diagnostics.failure_summary || job?.final_failure_summary));
  setText("detail-failure-category", summarizeRuntimeField(diagnostics.category || diagnostics.failure_category || diagnostics.failed_category || job?.final_failure_category));
  setText("detail-failure-stage", summarizeRuntimeField(diagnostics.failed_stage || diagnostics.stage || diagnostics.failed_substage));
  setText("detail-failure-root-cause", summarizeRuntimeField(diagnostics.root_cause || diagnostics.detail || diagnostics.raw_excerpt));
  setText("detail-failure-suggestion", summarizeRuntimeField(diagnostics.suggestion));
  setText("detail-failure-retryable", typeof diagnostics.retryable === "boolean" ? (diagnostics.retryable ? "是" : "否") : "-");
}

export function renderFailureDebugContext(job: JobLike | JobPayload | null | undefined) {
  const container = document.getElementById("detail-failure-debug-context");
  if (!container) {
    return;
  }
  // failure / failure_diagnostic 的形状在后端间不一致，这里按字段名宽松读取。
  const failure = asRecord(job?.failure);
  const diagnostic = asRecord(job?.failure_diagnostic);
  const rawDiagnostic = asRecord(failure.raw_diagnostic || diagnostic.raw_diagnostic);
  const logTailSource = job?.log_tail;
  const logTail = Array.isArray(logTailSource) ? logTailSource.filter(Boolean).slice(-8) : [];
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
    container.innerHTML = '<div class="detail-empty">暂无结构化失败上下文</div>';
    return;
  }
  container.innerHTML = rows.map(([label, value]) => `
    <div class="detail-debug-row">
      <div class="detail-debug-label">${escapeHtml(label)}</div>
      <pre class="detail-debug-value">${escapeHtml(value)}</pre>
    </div>
  `).join("");
}
