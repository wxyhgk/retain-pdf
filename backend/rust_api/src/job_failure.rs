use serde::Deserialize;

use crate::models::{JobFailureInfo, JobRawDiagnostic, JobSnapshot, JobStatusKind};
use crate::ocr_provider::{OcrErrorCategory, OcrProviderDiagnostics};

pub const STRUCTURED_FAILURE_LABEL: &str = "structured failure json";

#[derive(Debug, Clone, Deserialize)]
struct PythonStructuredFailure {
    stage: Option<String>,
    error_type: Option<String>,
    summary: Option<String>,
    detail: Option<String>,
    retryable: Option<bool>,
    upstream_host: Option<String>,
    provider: Option<String>,
    raw_exception_type: Option<String>,
    raw_exception_message: Option<String>,
    traceback: Option<String>,
}

pub fn classify_job_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    if !matches!(job.status, JobStatusKind::Failed) {
        return None;
    }

    let error = job.error.as_deref().unwrap_or("").trim();
    let haystack = if error.is_empty() {
        job.log_tail.join("\n")
    } else {
        format!("{error}\n{}", job.log_tail.join("\n"))
    };
    let diagnostics = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref());
    let failed_stage = infer_failed_stage(job, &haystack);
    let structured = extract_structured_failure(&haystack);
    let raw_diagnostic = structured
        .as_ref()
        .map(raw_diagnostic_from_structured)
        .or_else(|| raw_diagnostic_from_text(error, &haystack));

    if let Some(structured_failure) = classify_structured_failure(
        structured.as_ref(),
        diagnostics,
        &failed_stage,
        job,
        error,
        &haystack,
    ) {
        return Some(structured_failure);
    }

    if let Some(provider_failure) = classify_provider_auth_failure(
        failed_stage.clone(),
        diagnostics,
        &haystack,
        select_relevant_log_line(
            job,
            error,
            &["401", "403", "Unauthorized", "missing or invalid X-API-Key"],
        ),
        error,
    ) {
        return Some(provider_failure);
    }

    if haystack.contains("Failed to resolve")
        || haystack.contains("NameResolutionError")
        || haystack.contains("Temporary failure in name resolution")
        || haystack.contains("socket.gaierror")
    {
        return Some(build_failure(
            failed_stage,
            "dns_resolution_failed",
            None,
            "外部模型服务域名解析失败",
            Some("容器在当前时刻无法解析上游模型服务域名，任务在翻译阶段中断".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("优先重试一次；若持续失败，请检查 Docker DNS、宿主机网络或代理配置".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "Temporary failure in name resolution",
                    "NameResolutionError",
                    "Failed to resolve",
                    "socket.gaierror",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("ReadTimeout")
        || haystack.contains("ConnectTimeout")
        || haystack.contains("timed out")
    {
        return Some(build_failure(
            failed_stage,
            "upstream_timeout",
            None,
            "外部服务请求超时",
            Some("任务调用 OCR 或模型服务时等待过久，超过超时阈值".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("可直接重试；若频繁发生，建议降低并发或检查网络稳定性".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "ReadTimeout",
                    "ConnectTimeout",
                    "timed out",
                    "api.deepseek.com",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("PlaceholderInventoryError")
        || haystack.contains("UnexpectedPlaceholderError")
        || haystack.contains("placeholder inventory mismatch")
        || haystack.contains("unexpected placeholders in translation")
        || haystack.contains("placeholder instability")
        || haystack.contains("degraded to keep_origin after repeated placeholder instability")
    {
        return Some(build_failure(
            failed_stage,
            "placeholder_unstable",
            None,
            "公式占位符校验失败",
            Some("模型返回的公式占位符数量或顺序与原文不一致，翻译结果未通过保护校验".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("可直接重试；若稳定复现，建议对该块改用更保守的单块翻译/保留原文策略".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "PlaceholderInventoryError",
                    "UnexpectedPlaceholderError",
                    "placeholder inventory mismatch",
                    "unexpected placeholders in translation",
                    "placeholder instability",
                    "degraded to keep_origin after repeated placeholder instability",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("source pdf not found") {
        return Some(build_failure(
            "normalization".to_string(),
            "source_pdf_missing",
            None,
            "源 PDF 缺失",
            Some("OCR 已完成，但进入标准化阶段时找不到任务工作目录中的源 PDF".to_string()),
            false,
            None,
            provider_name(diagnostics),
            Some(
                "检查桌面端任务目录下的 source/ 是否存在源 PDF，并确认打包环境没有丢失文件复制步骤"
                    .to_string(),
            ),
            select_relevant_log_line(job, error, &["source pdf not found"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("401")
        || haystack.contains("403")
        || haystack.contains("missing or invalid X-API-Key")
        || haystack.contains("Unauthorized")
    {
        return Some(build_failure(
            failed_stage,
            "auth_failed",
            None,
            "鉴权失败",
            Some("当前任务使用的 API Key / Token 无效、过期或权限不足".to_string()),
            false,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("检查 MinerU Token、模型 API Key 或后端 X-API-Key 配置".to_string()),
            select_relevant_log_line(
                job,
                error,
                &["401", "403", "Unauthorized", "missing or invalid X-API-Key"],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("429")
        || haystack.contains("rate limit")
        || haystack.contains("Too Many Requests")
    {
        return Some(build_failure(
            failed_stage,
            "rate_limited",
            None,
            "上游服务触发限流",
            Some("短时间内请求过多，上游服务拒绝继续处理".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("等待一段时间后重试，或降低 workers / 并发配置".to_string()),
            select_relevant_log_line(job, error, &["429", "rate limit", "Too Many Requests"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if haystack.contains("packages.typst.org")
        || haystack.contains("failed to download package")
        || haystack.contains("downloading @preview/")
    {
        return Some(build_failure(
            "render".to_string(),
            "typst_dependency_download_failed",
            None,
            "Typst 渲染依赖下载失败",
            Some("渲染阶段需要的 Typst 包未能成功获取，导致 PDF 编译中断".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "检查桌面包是否已内置 Typst packages，或确认运行环境可访问 packages.typst.org"
                    .to_string(),
            ),
            select_relevant_log_line(
                job,
                error,
                &[
                    "failed to download package",
                    "packages.typst.org",
                    "downloading @preview/",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    if contains_render_failure_signal(&haystack) {
        return Some(build_failure(
            failed_stage,
            "render_failed",
            None,
            "排版或编译阶段失败",
            Some("翻译已部分完成，但在排版、渲染或 PDF 编译阶段中断".to_string()),
            false,
            None,
            provider_name(diagnostics),
            Some("检查 typst、字体、公式内容或中间产物目录是否完整".to_string()),
            select_relevant_log_line(
                job,
                error,
                &[
                    "typst compile",
                    "failed to compile",
                    "compile error",
                    "render failed",
                    "rendering failed",
                    "failed to render",
                    "typst error",
                    "font not found",
                    "missing bundled font",
                ],
            ),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
    }

    Some(build_failure(
        failed_stage,
        "unknown",
        diagnostics
            .and_then(|diag| diag.last_error.as_ref())
            .and_then(|err| err.provider_code.clone()),
        "任务失败，但暂未识别出明确根因",
        unknown_root_cause(error, &haystack, raw_diagnostic.as_ref()),
        true,
        extract_upstream_host(&haystack),
        provider_name(diagnostics),
        Some("查看 log_tail 和完整错误日志进一步排查".to_string()),
        select_relevant_log_line(job, error, &[]),
        first_error_excerpt(error, &haystack),
        raw_diagnostic,
    ))
}

fn classify_structured_failure(
    structured: Option<&PythonStructuredFailure>,
    diagnostics: Option<&OcrProviderDiagnostics>,
    failed_stage: &str,
    job: &JobSnapshot,
    error: &str,
    haystack: &str,
) -> Option<JobFailureInfo> {
    let structured = structured?;
    let stage = structured
        .stage
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| failed_stage.to_string());
    let category = structured
        .error_type
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "python_unhandled_exception".to_string());
    let summary = structured
        .summary
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "任务失败，但暂未识别出明确根因".to_string());
    let detail = structured
        .detail
        .clone()
        .filter(|value| !value.trim().is_empty());
    let raw_diagnostic = Some(raw_diagnostic_from_structured(structured));
    Some(build_failure(
        stage,
        &category,
        diagnostics
            .and_then(|diag| diag.last_error.as_ref())
            .and_then(|err| err.provider_code.clone()),
        &summary,
        detail.or_else(|| unknown_root_cause(error, haystack, raw_diagnostic.as_ref())),
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
        Some("查看完整 traceback、原始异常与日志进一步排查".to_string()),
        select_relevant_log_line(job, error, &[]),
        first_error_excerpt(error, haystack)
            .or_else(|| structured.raw_exception_message.clone())
            .or_else(|| structured.raw_exception_type.clone()),
        raw_diagnostic,
    ))
}

fn classify_provider_auth_failure(
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

fn build_failure(
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
}

fn extract_structured_failure(haystack: &str) -> Option<PythonStructuredFailure> {
    for line in haystack.lines().rev() {
        let trimmed = line.trim();
        let Some(raw_json) = trimmed
            .strip_prefix(STRUCTURED_FAILURE_LABEL)
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

fn raw_diagnostic_from_structured(structured: &PythonStructuredFailure) -> JobRawDiagnostic {
    JobRawDiagnostic {
        structured_error_type: structured.error_type.clone(),
        raw_exception_type: structured.raw_exception_type.clone(),
        raw_exception_message: structured.raw_exception_message.clone(),
        traceback: structured.traceback.clone(),
    }
}

fn raw_diagnostic_from_text(error: &str, haystack: &str) -> Option<JobRawDiagnostic> {
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

fn extract_traceback(text: &str) -> Option<String> {
    let start = text.find("Traceback (most recent call last):")?;
    Some(text[start..].trim().to_string())
}

fn last_non_empty_line(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .rev()
        .find(|line| !line.is_empty() && !line.starts_with(STRUCTURED_FAILURE_LABEL))
        .map(ToOwned::to_owned)
}

fn extract_exception_type(line: &str) -> Option<String> {
    let candidate = line.split(':').next()?.trim();
    if candidate.is_empty() || candidate.contains(' ') {
        return None;
    }
    Some(candidate.to_string())
}

fn unknown_root_cause(
    error: &str,
    haystack: &str,
    raw_diagnostic: Option<&JobRawDiagnostic>,
) -> Option<String> {
    raw_diagnostic
        .and_then(|item| item.raw_exception_message.clone())
        .or_else(|| last_non_empty_line(error))
        .or_else(|| first_error_excerpt(error, haystack))
}

fn provider_name(diagnostics: Option<&OcrProviderDiagnostics>) -> Option<String> {
    diagnostics.map(|diag| format!("{:?}", diag.provider).to_lowercase())
}

fn first_error_excerpt(error: &str, haystack: &str) -> Option<String> {
    let source = if error.trim().is_empty() {
        haystack
    } else {
        error
    };
    source
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with(STRUCTURED_FAILURE_LABEL))
        .map(|line| line.to_string())
}

fn select_relevant_log_line(job: &JobSnapshot, error: &str, keywords: &[&str]) -> Option<String> {
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

fn is_low_signal_log_line(line: &str) -> bool {
    let lowered = line.to_lowercase();
    lowered.starts_with("image-only compress:")
        || lowered.starts_with("cover page image")
        || lowered.starts_with("saved ")
        || lowered.starts_with("rendered page ")
        || lowered.starts_with("auto render mode selected:")
}

fn infer_failed_stage(job: &JobSnapshot, haystack: &str) -> String {
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

fn contains_render_failure_signal(text: &str) -> bool {
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

fn extract_upstream_host(haystack: &str) -> Option<String> {
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

#[cfg(test)]
mod tests {
    use super::classify_job_failure;
    use crate::models::CreateJobInput;

    #[test]
    fn classify_job_failure_maps_placeholder_instability() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.error = Some("PlaceholderInventoryError: placeholder inventory mismatch".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("正在翻译".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "placeholder_unstable");
        assert_eq!(failure.stage, "translation");
    }

    #[test]
    fn classify_job_failure_does_not_treat_render_mode_log_as_render_failure() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.error = Some("PlaceholderInventoryError: placeholder inventory mismatch".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("正在翻译".to_string());
        job.log_tail = vec![
            "auto render mode selected: overlay (removable_items=18, checked_items=18, removable_ratio=1.00)"
                .to_string(),
        ];

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "placeholder_unstable");
        assert_eq!(failure.stage, "translation");
    }

    #[test]
    fn classify_job_failure_maps_typst_compile_error_to_render_stage() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.error = Some("typst compile failed: font not found".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("正在翻译".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "render_failed");
        assert_eq!(failure.stage, "render");
    }

    #[test]
    fn classify_job_failure_maps_typst_package_download_failure() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.error = Some(
            "RuntimeError: downloading @preview/cmarker:0.1.8\nerror: failed to download package (https://packages.typst.org/preview/cmarker-0.1.8.tar.gz: Connection Failed)"
                .to_string(),
        );
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some("正在准备渲染".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "typst_dependency_download_failed");
        assert_eq!(failure.stage, "render");
        assert_eq!(failure.upstream_host.as_deref(), Some("packages.typst.org"));
    }

    #[test]
    fn classify_job_failure_prefers_structured_python_failure() {
        let mut job = crate::models::JobSnapshot::new(
            "job-failure".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.error = Some(
            "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"stage\":\"normalization\",\"error_type\":\"document_schema_validation_failed\",\"summary\":\"标准化文档校验失败\",\"detail\":\"normalized document schema validation failed\",\"retryable\":false,\"upstream_host\":\"\",\"provider\":\"ocr\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"normalized document schema validation failed\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
                .to_string(),
        );

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "document_schema_validation_failed");
        assert_eq!(failure.stage, "normalization");
        assert_eq!(
            failure
                .raw_diagnostic
                .as_ref()
                .and_then(|item| item.structured_error_type.as_deref()),
            Some("document_schema_validation_failed")
        );
    }

    #[test]
    fn classify_job_failure_maps_missing_source_pdf() {
        let mut job = crate::models::JobSnapshot::new(
            "job-missing-source-pdf".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = crate::models::JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.error =
            Some("RuntimeError: source pdf not found: /tmp/jobs/job/source/input.pdf".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "source_pdf_missing");
        assert_eq!(failure.stage, "normalization");
        assert_eq!(failure.summary, "源 PDF 缺失");
        assert!(!failure.retryable);
    }
}
