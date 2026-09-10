import { firstDefined, firstNonEmpty, } from "./core.js";
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
        const detail = firstNonEmpty(payload.failure?.summary, payload.failure?.detail, payload.final_failure_summary, payload.failure_diagnostic?.summary, payload.failure_diagnostic?.detail, payload.stage_detail, payload.error, payload.raw_response?.message, payload.failure?.raw_excerpt, payload.failure?.raw_exception_message, payload.failure?.suggestion);
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
