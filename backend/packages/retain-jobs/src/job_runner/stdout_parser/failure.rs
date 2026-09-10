use crate::models::domain::JobSnapshot;
use crate::ocr_provider::mineru::{
    classify_runtime_failure, extract_provider_error_code, extract_provider_message,
    extract_provider_trace_id,
};
use crate::ocr_provider::OcrErrorCategory;

use super::{job_artifacts_mut, ocr_provider_diagnostics_mut};

pub fn attach_provider_failure(job: &mut JobSnapshot, stderr_text: &str) {
    if stderr_text.trim().is_empty() {
        return;
    }
    let should_attach = stderr_text.contains("MinerU")
        || extract_provider_error_code(stderr_text).is_some()
        || job
            .stage
            .as_deref()
            .map(|stage| stage.starts_with("mineru"))
            .unwrap_or(false);
    if !should_attach {
        return;
    }
    let diagnostics = ocr_provider_diagnostics_mut(job);
    let trace_id = extract_provider_trace_id(stderr_text);
    let provider_message = extract_provider_message(stderr_text);
    let mut error = classify_runtime_failure(stderr_text, trace_id.as_deref());
    if error.provider_message.is_none() {
        error.provider_message = provider_message;
    }
    let provider_trace_id = error.trace_id.clone();
    let failure_detail = provider_failure_stage_detail(&error);
    diagnostics.last_error = Some(error);
    if let Some(trace_id) = provider_trace_id {
        job_artifacts_mut(job).provider_trace_id = Some(trace_id);
    }
    if let Some(detail) = failure_detail {
        job.stage_detail = Some(detail);
    }
}

fn provider_failure_stage_detail(
    error: &crate::ocr_provider::OcrProviderErrorInfo,
) -> Option<String> {
    let trace_suffix = error
        .trace_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!(" trace_id={value}"))
        .unwrap_or_default();
    match error.category {
        OcrErrorCategory::CredentialExpired => Some(format!(
            "MinerU Token 已过期，请更换新 Token{}",
            trace_suffix
        )),
        OcrErrorCategory::Unauthorized => Some(format!(
            "MinerU Token 无效或鉴权失败，请检查 Token 是否正确{}",
            trace_suffix
        )),
        _ => None,
    }
}
