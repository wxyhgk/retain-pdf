import {
  firstDefined,
  firstNonEmpty,
} from "./core.js";

export function summarizeStatus(status) {
  switch (status) {
    case "queued":
      return "Nhiệm vụ đã gửi, đang chờ backend bắt đầu xử lý.";
    case "running":
      return "Nhiệm vụ đang xử lý, vui lòng chờ giai đoạn hiện tại hoàn thành.";
    case "succeeded":
      return "Nhiệm vụ đã hoàn thành, có thể tải kết quả.";
    case "canceled":
      return "Nhiệm vụ đã hủy.";
    case "failed":
      return "Nhiệm vụ thất bại, vui lòng kiểm tra lỗi và thử lại.";
    default:
      return "Đang chờ gửi nhiệm vụ.";
  }
}

export function summarizePublicError(payload) {
  if (payload.status === "canceled") {
    return "Nhiệm vụ đã hủy.";
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
    return detail || "Nhiệm vụ thất bại. Vui lòng kiểm tra tệp đầu vào và cấu hình rồi thử lại.";
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
      `Giai đoạn: ${firstNonEmpty(failure.stage, failure.failed_stage, failure.provider_stage) || "-"}`,
      `Phân loại: ${firstNonEmpty(failure.category, failure.failure_category, failure.error_type, failure.failure_code) || "-"}`,
      `Tóm tắt: ${firstNonEmpty(failure.summary, failure.detail, failure.raw_excerpt, failure.raw_exception_message) || "-"}`,
      `Có thể thử lại: ${typeof retryable === "boolean" ? (retryable ? "Có" : "Không") : "-"}`,
    ];
    if (firstNonEmpty(failure.upstream_host, failure.provider)) {
      lines.push(`Thượng nguồn: ${firstNonEmpty(failure.upstream_host, failure.provider)}`);
    }
    if (firstNonEmpty(failure.root_cause, failure.raw_exception_type)) {
      lines.push(`Nguyên nhân gốc: ${firstNonEmpty(failure.root_cause, failure.raw_exception_type)}`);
    }
    if (failure.suggestion) {
      lines.push(`Đề xuất: ${failure.suggestion}`);
    }
    if (firstNonEmpty(failure.last_log_line, failure.raw_excerpt)) {
      lines.push(`Log cuối: ${firstNonEmpty(failure.last_log_line, failure.raw_excerpt)}`);
    }
    return lines.join("\n");
  }
  const diag = payload.failure_diagnostic;
  if (!diag) {
    return "-";
  }
  const lines = [
    `Giai đoạn: ${diag.stage || diag.failed_stage || "-"}`,
    `Loại: ${diag.type || diag.error_kind || diag.error_type || "-"}`,
    `Tóm tắt: ${diag.summary || diag.detail || diag.raw_excerpt || "-"}`,
    `Có thể thử lại: ${typeof diag.retryable === "boolean" ? (diag.retryable ? "Có" : "Không") : "-"}`,
  ];
  if (diag.upstream_host) {
    lines.push(`Máy chủ thượng nguồn: ${diag.upstream_host}`);
  }
  if (diag.root_cause || diag.raw_exception_type) {
    lines.push(`Nguyên nhân gốc: ${diag.root_cause || diag.raw_exception_type}`);
  }
  if (diag.suggestion) {
    lines.push(`Đề xuất: ${diag.suggestion}`);
  }
  if (diag.last_log_line || diag.raw_excerpt) {
    lines.push(`Log cuối: ${diag.last_log_line || diag.raw_excerpt}`);
  }
  return lines.join("\n");
}
