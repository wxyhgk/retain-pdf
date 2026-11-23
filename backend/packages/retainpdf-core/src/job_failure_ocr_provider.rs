//! OCR 服务商分类（`OcrErrorCategory`）→ 任务失败码（2026-11-23，分支 fix/ocr-provider-codes）。
//!
//! Rust 跑的 Paddle、MinerU 把服务商最后一次报的错记在 OCR 诊断 `ocr_provider_diagnostics.last_error`
//! （分类、业务码、服务商原话）。以前任务层只认鉴权、额度两类，其余（文件太大、页数超限、解析失败、排队已满……）
//! 都落 `unknown`「任务失败，但暂未识别出明确根因」，服务商的说法只在诊断里。这里按分类给出明确的失败码：
//!
//! | 分类 | 失败码 | 可重试 |
//! |---|---|---|
//! | 文件不合规：空文件、读不出 / 损坏、太大、页数超限、格式不支持、转换失败 | `ocr_file_rejected` | 否 |
//! | 请求参数不对、任务不存在、操作不允许 | `upstream_bad_request` | 否 |
//! | 没有权限访问这个任务（MinerU -60013，Token 和提交时不一致） | `auth_failed` | 否 |
//! | 排队已满、请求太快 | `upstream_rate_limited` | 是 |
//! | 服务异常、上传链接、解析、导出、拆分、读页数失败，服务商报的读取超时，没拿到文件，任务过期 | `ocr_provider_failed` | 是 |
//! | 重试次数已达上限（MinerU -60017） | `ocr_provider_failed` | 否 |
//!
//! Python 那条路（`retainpdf_pipeline/ocr/provider_failures.py`）按业务码给同样的失败码，两边要一起改。
//! summary 带服务商名、业务码和服务商原话。只在 OCR 阶段用（调用方判断）：OCR 做完以后的失败，诊断里那条可能是早先恢复了的错。

use crate::models::domain::{
    JobFailureInfo, JobRawDiagnostic, JobSnapshot, OcrErrorCategory, OcrProviderDiagnostics,
    OcrProviderKind,
};

use super::job_failure_fallback::auth_failure_suggestion;
use super::job_failure_support::{
    build_failure, extract_upstream_host, first_error_excerpt, provider_name,
    select_relevant_log_line,
};

struct OcrFailureRule {
    failure_code: &'static str,
    /// summary 的开头，前面接服务商名，后面接（业务码）和服务商原话。
    what: &'static str,
    retryable: bool,
    suggestion: &'static str,
}

const FILE_SUGGESTION: &str =
    "OCR 服务商拒收了这份文件，原样重试没用：换一个文件，或把 PDF 压缩、拆分（指定页码范围）后再上传";
const BAD_REQUEST_SUGGESTION: &str =
    "OCR 服务商拒绝了这次请求的参数，原样重试没用；请升级到最新版，仍出现请反馈问题";
const PROVIDER_FAILED_SUGGESTION: &str =
    "OCR 服务商这次没处理成功，稍后重试；反复出现可以换用其他 OCR";

fn rule_for(category: &OcrErrorCategory, has_provider_code: bool) -> Option<OcrFailureRule> {
    use OcrErrorCategory::*;
    let rule = |failure_code, what, retryable, suggestion| OcrFailureRule {
        failure_code,
        what,
        retryable,
        suggestion,
    };
    Some(match category {
        EmptyFile => rule("ocr_file_rejected", "拒收了这份文件：文件是空的", false, FILE_SUGGESTION),
        FileReadFailed => rule("ocr_file_rejected", "拒收了这份文件：读不出文件内容（可能已损坏）", false, FILE_SUGGESTION),
        FileTooLarge => rule("ocr_file_rejected", "拒收了这份文件：文件太大", false, FILE_SUGGESTION),
        TooManyPages => rule("ocr_file_rejected", "拒收了这份文件：页数超过上限", false, FILE_SUGGESTION),
        UnsupportedFileFormat => rule("ocr_file_rejected", "拒收了这份文件：格式不支持", false, FILE_SUGGESTION),
        ConversionFailed => rule("ocr_file_rejected", "转换这份文件失败", false, FILE_SUGGESTION),
        InvalidRequest => rule("upstream_bad_request", "拒绝了请求参数", false, BAD_REQUEST_SUGGESTION),
        TaskNotFound => rule("upstream_bad_request", "找不到这个 OCR 任务", false, "OCR 任务号无效或已被删除：重新提交任务"),
        OperationNotAllowed => rule("upstream_bad_request", "不允许这个操作", false, BAD_REQUEST_SUGGESTION),
        // MinerU -60013（只能访问自己提交的任务）、不带业务码的 403；建议按服务商出（auth_failure_suggestion）
        PermissionDenied => rule("auth_failed", "拒绝访问：没有权限", false, ""),
        QueueFull => rule("upstream_rate_limited", "排队已满或请求太快", true, "OCR 服务商当前排队已满或限流，稍后再试"),
        ServiceUnavailable => rule("ocr_provider_failed", "服务暂时出错", true, PROVIDER_FAILED_SUGGESTION),
        UploadLinkRequestFailed => rule("ocr_provider_failed", "生成上传链接失败", true, PROVIDER_FAILED_SUGGESTION),
        UploadedFileMissing => rule(
            "ocr_provider_failed",
            "没拿到有效文件",
            true,
            "文件可能没有上传完整：重试一次；仍失败请检查网络后再试",
        ),
        ParseFailed => rule(
            "ocr_provider_failed",
            "解析这份文件失败",
            true,
            "可以重试一次；仍失败请换用其他 OCR，或检查 PDF 是否损坏",
        ),
        ExportFailed => rule("ocr_provider_failed", "导出结果失败", true, PROVIDER_FAILED_SUGGESTION),
        FileSplitFailed => rule("ocr_provider_failed", "拆分文件失败", true, PROVIDER_FAILED_SUGGESTION),
        PageCountReadFailed => rule(
            "ocr_provider_failed",
            "读取页数失败",
            true,
            "稍后重试；仍失败请检查 PDF 是否损坏，或换用其他 OCR",
        ),
        WebReadFailed => rule("ocr_provider_failed", "读取文件失败", true, PROVIDER_FAILED_SUGGESTION),
        // 服务商自己报的读取超时（MinerU -60008）；本机等响应超时（没有业务码）交给后面的 upstream_timeout
        RemoteReadTimeout if has_provider_code => {
            rule("ocr_provider_failed", "读取文件超时", true, PROVIDER_FAILED_SUGGESTION)
        }
        TaskExpired => rule("ocr_provider_failed", "任务已过期", true, "OCR 任务已过期：重新提交即可（重试会从头开始）"),
        RetryLimitReached => rule(
            "ocr_provider_failed",
            "多次解析这份文件都失败了，重试次数已用完",
            false,
            "服务商对这份文件的重试次数已用完，要等它的模型升级；先换用其他 OCR",
        ),
        // 鉴权、额度在前面的分支；超时、下载、返回结构不对、笼统的失败交给后面按文字认
        _ => return None,
    })
}

fn provider_label(diagnostics: &OcrProviderDiagnostics) -> &'static str {
    match diagnostics.provider {
        OcrProviderKind::Paddle => "PaddleOCR",
        OcrProviderKind::Mineru => "MinerU",
        _ => "OCR 服务商",
    }
}

/// OCR 诊断里服务商最后一次报的错有明确分类时，给出对应的失败码。只在 OCR 阶段调用。
pub(super) fn classify_ocr_provider_failure(
    failed_stage: &str,
    diagnostics: Option<&OcrProviderDiagnostics>,
    job: &JobSnapshot,
    error: &str,
    haystack: &str,
    raw_diagnostic: Option<&JobRawDiagnostic>,
) -> Option<JobFailureInfo> {
    let diagnostics = diagnostics?;
    let last_error = diagnostics.last_error.as_ref()?;
    let provider_code = last_error
        .provider_code
        .as_deref()
        .map(str::trim)
        .filter(|code| !code.is_empty());
    let rule = rule_for(&last_error.category, provider_code.is_some())?;
    let provider_message = last_error
        .provider_message
        .as_deref()
        .map(str::trim)
        .filter(|message| !message.is_empty());
    let mut summary = format!("{} {}", provider_label(diagnostics), rule.what);
    if let Some(code) = provider_code {
        summary.push_str(&format!("（{code}）"));
    }
    if let Some(message) = provider_message {
        let excerpt: String = message.chars().take(120).collect();
        summary.push_str(&format!("：{excerpt}"));
    }
    let suggestion = if rule.suggestion.is_empty() {
        auth_failure_suggestion(failed_stage, Some(diagnostics))
    } else {
        rule.suggestion.to_string()
    };
    let mut keywords: Vec<&str> = vec!["MinerU", "Paddle"];
    if let Some(code) = provider_code {
        keywords.insert(0, code);
    }
    Some(build_failure(
        failed_stage.to_string(),
        rule.failure_code,
        last_error.provider_code.clone(),
        &summary,
        provider_message
            .map(str::to_string)
            .or_else(|| last_error.operator_hint.clone()),
        rule.retryable,
        extract_upstream_host(haystack),
        provider_name(Some(diagnostics)),
        Some(suggestion),
        select_relevant_log_line(job, error, &keywords),
        first_error_excerpt(error, haystack),
        raw_diagnostic.cloned(),
    ))
}

#[cfg(test)]
#[path = "job_failure_ocr_provider_tests.rs"]
mod tests;
