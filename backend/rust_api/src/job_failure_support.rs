use crate::models::{JobFailureInfo, JobRawDiagnostic, JobSnapshot};
use crate::ocr_provider::OcrProviderDiagnostics;

use super::PythonStructuredFailure;

pub(super) fn build_failure(
    stage: String,
    category: &str,
    code: Option<String>,
    summary: &str,
    root_cause: Option<String>,
    retryable: bool,
    upstream_host: Option<String>,
    provider: Option<String>,
    suggestion: Option<String>,
    last_log_line: Option<String>,
    raw_error_excerpt: Option<String>,
    raw_diagnostic: Option<JobRawDiagnostic>,
) -> JobFailureInfo {
    JobFailureInfo {
        failed_stage: Some(stage.clone()),
        failure_code: Some(category.to_string()),
        failure_category: None,
        provider_stage: None,
        provider_code: code.clone(),
        raw_excerpt: raw_error_excerpt.clone(),
        stage,
        category: category.to_string(),
        code,
        summary: summary.to_string(),
        root_cause,
        retryable,
        upstream_host,
        provider,
        suggestion,
        last_log_line,
        raw_error_excerpt,
        raw_diagnostic,
        ai_diagnostic: None,
    }
    .with_formal_fields()
}

pub(super) fn raw_diagnostic_from_structured(
    structured: &PythonStructuredFailure,
) -> JobRawDiagnostic {
    JobRawDiagnostic {
        structured_error_type: structured.failure_code.clone(),
        raw_exception_type: structured.raw_exception_type.clone(),
        raw_exception_message: structured.raw_exception_message.clone(),
        traceback: structured.traceback.clone(),
    }
}

pub(super) fn raw_diagnostic_from_text(error: &str, haystack: &str) -> Option<JobRawDiagnostic> {
    let source = if error.trim().is_empty() {
        haystack
    } else {
        error
    };
    let traceback = extract_traceback(source);
    let raw_exception_message = last_non_empty_line(source);
    if traceback.is_none() && raw_exception_message.is_none() {
        return None;
    }
    Some(JobRawDiagnostic {
        structured_error_type: None,
        raw_exception_type: raw_exception_message
            .as_deref()
            .and_then(extract_exception_type),
        raw_exception_message,
        traceback,
    })
}

pub(super) fn raw_diagnostic_from_process_result(job: &JobSnapshot) -> Option<JobRawDiagnostic> {
    let result = job.result.as_ref()?;
    let source = if !result.stderr.trim().is_empty() {
        result.stderr.as_str()
    } else if !result.stdout.trim().is_empty() {
        result.stdout.as_str()
    } else {
        job.error.as_deref().unwrap_or("")
    };
    let traceback = extract_traceback(source);
    let raw_exception_message = last_non_empty_line(source)
        .or_else(|| Some(format!("process exited with code {}", result.return_code)));
    Some(JobRawDiagnostic {
        structured_error_type: None,
        raw_exception_type: raw_exception_message
            .as_deref()
            .and_then(extract_exception_type),
        raw_exception_message,
        traceback,
    })
}

pub(super) fn extract_traceback(text: &str) -> Option<String> {
    let start = text.find("Traceback (most recent call last):")?;
    Some(text[start..].trim().to_string())
}

pub(super) fn last_non_empty_line(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .rev()
        .find(|line| !line.is_empty() && !line.starts_with(super::STRUCTURED_FAILURE_LABEL))
        .map(ToOwned::to_owned)
}

pub(super) fn extract_exception_type(line: &str) -> Option<String> {
    let candidate = line.split(':').next()?.trim();
    if candidate.is_empty() || candidate.contains(' ') {
        return None;
    }
    Some(candidate.to_string())
}

pub(super) fn unknown_root_cause(
    error: &str,
    haystack: &str,
    raw_diagnostic: Option<&JobRawDiagnostic>,
) -> Option<String> {
    raw_diagnostic
        .and_then(|item| item.raw_exception_message.clone())
        .or_else(|| last_non_empty_line(error))
        .or_else(|| first_error_excerpt(error, haystack))
}

pub(super) fn provider_name(diagnostics: Option<&OcrProviderDiagnostics>) -> Option<String> {
    diagnostics.map(|diag| format!("{:?}", diag.provider).to_lowercase())
}

pub(super) fn first_error_excerpt(error: &str, haystack: &str) -> Option<String> {
    let source = if error.trim().is_empty() {
        haystack
    } else {
        error
    };
    source
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with(super::STRUCTURED_FAILURE_LABEL))
        .map(|line| line.to_string())
}

pub(super) fn select_relevant_log_line(
    job: &JobSnapshot,
    error: &str,
    keywords: &[&str],
) -> Option<String> {
    let lowered_keywords: Vec<String> = keywords.iter().map(|item| item.to_lowercase()).collect();
    for line in error.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if lowered_keywords.is_empty() {
            return Some(trimmed.to_string());
        }
        let lowered = trimmed.to_lowercase();
        if lowered_keywords
            .iter()
            .any(|keyword| lowered.contains(keyword))
        {
            return Some(trimmed.to_string());
        }
    }
    for line in job.log_tail.iter().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() || is_low_signal_log_line(trimmed) {
            continue;
        }
        if lowered_keywords.is_empty() {
            return Some(trimmed.to_string());
        }
        let lowered = trimmed.to_lowercase();
        if lowered_keywords
            .iter()
            .any(|keyword| lowered.contains(keyword))
        {
            return Some(trimmed.to_string());
        }
    }
    job.log_tail
        .iter()
        .rev()
        .find(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !is_low_signal_log_line(trimmed)
        })
        .cloned()
}

pub(super) fn is_low_signal_log_line(line: &str) -> bool {
    let lowered = line.to_lowercase();
    lowered.starts_with("image-only compress:")
        || lowered.starts_with("cover page image")
        || lowered.starts_with("saved ")
        || lowered.starts_with("rendered page ")
        || lowered.starts_with("auto render mode selected:")
}

pub(super) fn infer_failed_stage(job: &JobSnapshot, haystack: &str) -> String {
    let stage = job.stage.clone().unwrap_or_default();
    let stage_detail = job.stage_detail.clone().unwrap_or_default();
    let combined = format!("{stage}\n{stage_detail}\n{haystack}").to_lowercase();

    if stage == "rendering"
        || stage == "render"
        || stage_detail.contains("排版")
        || stage_detail.contains("渲染")
        || contains_render_failure_signal(&combined)
    {
        return "render".to_string();
    }
    if stage == "translation" || combined.contains("translation") || stage_detail.contains("翻译")
    {
        return "translation".to_string();
    }
    if combined.contains("normaliz") || stage_detail.contains("标准化") {
        return "normalization".to_string();
    }
    if combined.contains("ocr")
        || combined.contains("mineru")
        || combined.contains("paddle")
        || stage_detail.contains("解析")
    {
        return "ocr".to_string();
    }
    "failed".to_string()
}

pub(super) fn contains_render_failure_signal(text: &str) -> bool {
    let lowered = text.to_lowercase();
    if [
        "typst compile",
        "typst compilation",
        "typst error",
        "failed to compile",
        "compile error",
        "render failed",
        "rendering failed",
        "failed to render",
        "missing bundled font",
        "font not found",
    ]
    .iter()
    .any(|pattern| lowered.contains(pattern))
    {
        return true;
    }

    (lowered.contains("no such file or directory")
        || lowered.contains("the system cannot find the file specified"))
        && (lowered.contains("typst") || lowered.contains("font"))
}

pub(super) fn extract_upstream_host(haystack: &str) -> Option<String> {
    for marker in ["host='", "host=\"", "https://", "http://"] {
        if let Some(start) = haystack.find(marker) {
            let rest = &haystack[start + marker.len()..];
            let host: String = rest
                .chars()
                .take_while(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-'))
                .collect();
            if !host.is_empty() {
                return Some(host);
            }
        }
    }
    None
}
