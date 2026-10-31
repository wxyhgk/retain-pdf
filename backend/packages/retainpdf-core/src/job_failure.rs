#[path = "job_failure_structured.rs"]
mod job_failure_structured;
#[path = "job_failure_support.rs"]
mod job_failure_support;

use crate::models::domain::{JobFailureInfo, JobSnapshot, JobStatusKind};

use self::job_failure_structured::{
    classify_provider_auth_failure, classify_structured_failure, extract_structured_failure,
    PythonStructuredFailure,
};
use self::job_failure_support::{
    build_failure, contains_render_failure_signal, extract_upstream_host, first_error_excerpt,
    infer_failed_stage, provider_name, raw_diagnostic_from_process_result,
    raw_diagnostic_from_structured, raw_diagnostic_from_text, select_relevant_log_line,
    unknown_root_cause,
};

pub const STRUCTURED_FAILURE_LABEL: &str = "structured failure json";

fn contains_http_status(haystack: &str, status: &str) -> bool {
    haystack.match_indices(status).any(|(start, _)| {
        let before_is_digit = haystack[..start]
            .chars()
            .next_back()
            .is_some_and(|value| value.is_ascii_digit());
        let end = start + status.len();
        let after_is_digit = haystack[end..]
            .chars()
            .next()
            .is_some_and(|value| value.is_ascii_digit());
        !before_is_digit && !after_is_digit
    })
}

pub fn classify_job_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    classify_job_failure_inner(job).map(with_recovery)
}

/// 统一在出口补上恢复信息,避免每个检测分支各自记得填一遍——那正是以前
/// 「三处都要改、漏一处就没提示」的来源。
fn with_recovery(mut failure: JobFailureInfo) -> JobFailureInfo {
    let recovery = crate::job_failure_catalogue::recovery_for(&failure.category);
    failure.resume_from = recovery.resume_from.map(|stage| stage.as_str().to_string());
    failure.recovery_hint = Some(recovery.hint.to_string());
    failure
}

fn classify_job_failure_inner(job: &JobSnapshot) -> Option<JobFailureInfo> {
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
    let structured = extract_structured_failure(STRUCTURED_FAILURE_LABEL, &haystack);
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

    if haystack.contains("OCR provider request outcome is ambiguous") {
        return Some(build_failure(
            failed_stage,
            "ocr_request_ambiguous",
            None,
            "OCR 请求结果不明确，已阻止自动重发",
            Some(
                "服务在提交 OCR 请求后、持久化 provider 任务标识前中断，无法确认上游是否已接收请求"
                    .to_string(),
            ),
            false,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "请先在 OCR provider 控制台确认是否已创建任务，再决定恢复现有任务或显式重新提交"
                    .to_string(),
            ),
            select_relevant_log_line(job, error, &["OCR provider request outcome is ambiguous"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic.clone(),
        ));
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

    if job
        .result
        .as_ref()
        .is_some_and(|result| !result.success && result.return_code == -1)
    {
        let timeout_seconds = job.request_payload.runtime.timeout_seconds;
        return Some(build_failure(
            failed_stage,
            "process_timeout",
            Some("timeout".to_string()),
            "Python worker 执行超时",
            Some(format!(
                "Python 子进程超时被终止：超过 timeout_seconds={timeout_seconds} 秒没有进展，或跑满了绝对时长上限"
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("可从断点恢复或重试；若频繁发生，检查上游网络耗时，或增大 timeout_seconds（多久没有进展才判卡住）".to_string()),
            select_relevant_log_line(job, error, &["timeout", "timed out", "stderr before timeout"]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic_from_process_result(job)
                .or_else(|| raw_diagnostic.clone()),
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

    if contains_http_status(&haystack, "401")
        || contains_http_status(&haystack, "403")
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

    if contains_http_status(&haystack, "429")
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

    if let Some(result) = job.result.as_ref().filter(|result| !result.success) {
        return Some(build_failure(
            failed_stage,
            "process_exit_failed",
            Some(format!("exit_code_{}", result.return_code)),
            "Python worker 非零退出",
            Some(format!(
                "Python 子进程返回非零退出码 {}，但未匹配到更具体的失败分类",
                result.return_code
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("查看 raw_exception_message、traceback 和 log_tail；如果已有中间产物，可尝试从断点恢复".to_string()),
            select_relevant_log_line(job, error, &[]),
            first_error_excerpt(error, &haystack),
            raw_diagnostic_from_process_result(job)
                .or_else(|| raw_diagnostic.clone()),
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

#[cfg(test)]
mod tests;
