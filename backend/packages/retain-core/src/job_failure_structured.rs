use serde::Deserialize;

use crate::models::domain::{JobFailureInfo, JobSnapshot};
use crate::models::domain::{OcrErrorCategory, OcrProviderDiagnostics};

use super::job_failure_support::{
    build_failure, extract_upstream_host, first_error_excerpt, provider_name,
    raw_diagnostic_from_structured, raw_diagnostic_from_text, select_relevant_log_line,
    unknown_root_cause,
};

#[derive(Debug, Clone, Deserialize)]
pub(super) struct PythonStructuredFailure {
    #[serde(default, alias = "stage")]
    pub(super) failed_stage: Option<String>,
    #[serde(default, alias = "error_type")]
    pub(super) failure_code: Option<String>,
    #[serde(default)]
    pub(super) failure_category: Option<String>,
    pub(super) summary: Option<String>,
    #[serde(default, alias = "detail")]
    pub(super) root_cause: Option<String>,
    pub(super) retryable: Option<bool>,
    pub(super) upstream_host: Option<String>,
    pub(super) provider: Option<String>,
    #[serde(default)]
    pub(super) provider_stage: Option<String>,
    #[serde(default)]
    pub(super) provider_code: Option<String>,
    #[serde(default)]
    pub(super) suggestion: Option<String>,
    #[serde(default)]
    pub(super) raw_excerpt: Option<String>,
    pub(super) raw_exception_type: Option<String>,
    pub(super) raw_exception_message: Option<String>,
    pub(super) traceback: Option<String>,
}

pub(super) fn classify_structured_failure(
    structured: Option<&PythonStructuredFailure>,
    diagnostics: Option<&OcrProviderDiagnostics>,
    failed_stage: &str,
    job: &JobSnapshot,
    error: &str,
    haystack: &str,
) -> Option<JobFailureInfo> {
    let structured = structured?;
    let stage = structured
        .failed_stage
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| failed_stage.to_string());
    let failure_code = structured
        .failure_code
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "python_unhandled_exception".to_string());
    let summary = structured
        .summary
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "任务失败，但暂未识别出明确根因".to_string());
    let root_cause = structured
        .root_cause
        .clone()
        .filter(|value| !value.trim().is_empty());
    let provider_code = structured
        .provider_code
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            diagnostics
                .and_then(|diag| diag.last_error.as_ref())
                .and_then(|err| err.provider_code.clone())
        });
    let suggestion = structured
        .suggestion
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| Some("查看完整 traceback、原始异常与日志进一步排查".to_string()));
    let raw_excerpt = structured
        .raw_excerpt
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| first_error_excerpt(error, haystack))
        .or_else(|| structured.raw_exception_message.clone())
        .or_else(|| structured.raw_exception_type.clone());
    let raw_diagnostic = Some(raw_diagnostic_from_structured(structured));
    let mut failure = build_failure(
        stage,
        &failure_code,
        provider_code.clone(),
        &summary,
        root_cause.or_else(|| unknown_root_cause(error, haystack, raw_diagnostic.as_ref())),
        structured.retryable.unwrap_or(true),
        structured
            .upstream_host
            .clone()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| extract_upstream_host(haystack)),
        structured
            .provider
            .clone()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| provider_name(diagnostics)),
        suggestion,
        select_relevant_log_line(job, error, &[]),
        raw_excerpt.clone(),
        raw_diagnostic,
    );
    failure.failure_category = structured
        .failure_category
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or(failure.failure_category);
    failure.provider_stage = structured
        .provider_stage
        .clone()
        .filter(|value| !value.trim().is_empty());
    failure.provider_code = provider_code;
    failure.raw_excerpt = raw_excerpt;
    Some(failure.with_formal_fields())
}

pub(super) fn classify_provider_auth_failure(
    failed_stage: String,
    diagnostics: Option<&OcrProviderDiagnostics>,
    haystack: &str,
    last_log_line: Option<String>,
    error: &str,
) -> Option<JobFailureInfo> {
    let last_error = diagnostics.and_then(|diag| diag.last_error.as_ref())?;
    let auth_related = matches!(
        last_error.category,
        OcrErrorCategory::Unauthorized | OcrErrorCategory::CredentialExpired
    );
    if !auth_related {
        return None;
    }
    Some(build_failure(
        failed_stage,
        "auth_failed",
        last_error.provider_code.clone(),
        "鉴权失败",
        Some("当前任务使用的 API Key / Token 无效、过期或权限不足".to_string()),
        false,
        extract_upstream_host(haystack),
        provider_name(diagnostics),
        Some("检查 MinerU Token、模型 API Key 或后端 X-API-Key 配置".to_string()),
        last_log_line,
        first_error_excerpt(error, haystack),
        raw_diagnostic_from_text(error, haystack),
    ))
}

pub(super) fn extract_structured_failure(
    label: &str,
    haystack: &str,
) -> Option<PythonStructuredFailure> {
    for line in haystack.lines().rev() {
        let trimmed = line.trim();
        let Some(raw_json) = trimmed
            .strip_prefix(label)
            .and_then(|rest| rest.strip_prefix(':'))
            .map(str::trim)
        else {
            continue;
        };
        if raw_json.is_empty() {
            continue;
        }
        if let Ok(parsed) = serde_json::from_str::<PythonStructuredFailure>(raw_json) {
            return Some(parsed);
        }
    }
    None
}
