import {
  formatEventTimestamp,
  formatJobFinishedAt,
  summarizeInvocationProtocol,
  summarizeInvocationSchemaVersion,
  summarizeRuntimeField,
} from "@retainpdf/domain/job";
import {
  summarizePublicError,
  summarizeStatus,
} from "@retainpdf/domain/job";
import { firstNonEmpty as firstNonEmptyText, summarizeMathMode as renderMathMode } from "@retainpdf/domain/job";

export { summarizeMathMode } from "@retainpdf/domain/job";

export function renderJobDetailRuntimeSummary({
  durations,
  job,
  setText,
  statusViewModel,
}) {
  setText("detail-status-summary", summarizeStatus(job.status || "idle"));
  setText("detail-stage-detail", statusViewModel.stageDetail);
  setText("detail-finished-at", formatJobFinishedAt(job));
  setText("detail-runtime-current-stage", statusViewModel.runtimeCurrentStage);
  setText("detail-runtime-stage-elapsed", durations.stageElapsedText);
  setText("detail-runtime-total-elapsed", durations.totalElapsedText);
  setText("detail-runtime-retry-count", `${job.retry_count ?? 0}`);
  setText("detail-runtime-last-transition", job.last_stage_transition_at ? formatEventTimestamp(job.last_stage_transition_at) : "-");
  setText("detail-runtime-terminal-reason", summarizeRuntimeField(job.terminal_reason));
  setText("detail-runtime-input-protocol", summarizeInvocationProtocol(job));
  setText("detail-runtime-stage-spec-version", summarizeInvocationSchemaVersion(job));
  setText("detail-runtime-math-mode", renderMathMode(job));
}

export function renderJobDetailFailureSummary({ job, setText }) {
  const failure = job.failure || {};
  const failureDiagnostic = job.failure_diagnostic || {};
  const retryable = failure.retryable ?? failureDiagnostic.retryable;
  const failureLastLogLine = firstNonEmptyText(
    failure.last_log_line,
    failureDiagnostic.last_log_line,
    Array.isArray(job.log_tail) && job.log_tail.length ? job.log_tail[job.log_tail.length - 1] : "",
  );

  setText("detail-failure-summary", summarizeRuntimeField(failure.summary || job.final_failure_summary || failureDiagnostic.summary || failure.raw_excerpt));
  setText("detail-failure-category", summarizeRuntimeField(
    failure.category
    || failure.failure_category
    || job.final_failure_category
    || failureDiagnostic.type
    || failureDiagnostic.error_kind,
  ));
  setText("detail-failure-stage", summarizeRuntimeField(
    failure.stage
    || failure.failed_stage
    || failure.provider_stage
    || failureDiagnostic.stage
    || failureDiagnostic.failed_stage,
  ));
  setText("detail-failure-root-cause", summarizeRuntimeField(failure.root_cause || failureDiagnostic.root_cause || failure.upstream_host));
  setText("detail-failure-suggestion", summarizeRuntimeField(failure.suggestion || failureDiagnostic.suggestion || failure.failure_code));
  setText("detail-failure-last-log-line", summarizeRuntimeField(failureLastLogLine));
  setText("detail-failure-retryable", typeof retryable === "boolean" ? (retryable ? "是" : "否") : "-");
}

export function renderJobDetailPublicError({ job, setText }) {
  setText("detail-error-box", summarizePublicError(job));
}
