use super::*;

use crate::job_failure::classify_job_failure;
use crate::models::domain::{JobArtifacts, JobStatusKind, OcrProviderErrorInfo};
use crate::models::request::CreateJobInput;

fn ocr_failed_job(
    provider: OcrProviderKind,
    category: OcrErrorCategory,
    code: Option<&str>,
    message: &str,
    http_status: Option<u16>,
) -> JobSnapshot {
    let mut job = JobSnapshot::new(
        "job-ocr-provider".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some("OCR provider transport 失败".to_string());
    let mut diagnostics = OcrProviderDiagnostics::new(provider);
    diagnostics.last_error = Some(OcrProviderErrorInfo {
        category,
        provider_code: code.map(str::to_string),
        provider_message: Some(message.to_string()),
        operator_hint: None,
        trace_id: Some("trace-1".to_string()),
        http_status,
    });
    job.artifacts = Some(JobArtifacts {
        ocr_provider_diagnostics: Some(diagnostics),
        ..JobArtifacts::default()
    });
    job
}

/// MinerU 文件类的码（以前落 unknown「暂未识别出明确根因」）→ 换文件，不可重试，summary 带码和服务商原话。
#[test]
fn mineru_file_codes_ask_for_another_file() {
    for (code, category) in [
        ("-60002", OcrErrorCategory::UnsupportedFileFormat),
        ("-60003", OcrErrorCategory::FileReadFailed),
        ("-60004", OcrErrorCategory::EmptyFile),
        ("-60005", OcrErrorCategory::FileTooLarge),
        ("-60006", OcrErrorCategory::TooManyPages),
        ("-60015", OcrErrorCategory::ConversionFailed),
    ] {
        let job = ocr_failed_job(OcrProviderKind::Mineru, category, Some(code), "provider says no", Some(200));
        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "ocr_file_rejected", "{code}");
        assert!(!failure.retryable, "{code}");
        assert!(failure.summary.starts_with("MinerU "), "{}", failure.summary);
        assert!(failure.summary.contains(&format!("（{code}）")), "{}", failure.summary);
        assert!(failure.summary.ends_with("：provider says no"), "{}", failure.summary);
        assert_eq!(failure.provider_code.as_deref(), Some(code));
        assert_eq!(failure.failure_category.as_deref(), Some("input"));
        assert_eq!(failure.resume_from, None);
        assert!(failure.recovery_hint.as_deref().is_some_and(|hint| hint.contains("换一个文件")));
        let upstream = failure.upstream.expect("upstream");
        assert_eq!(upstream.code.as_deref(), Some(code));
        assert_eq!(upstream.provider.as_deref(), Some("mineru"));
    }
}

/// 参数类 → upstream_bad_request；-60013（没有权限访问这个任务）→ auth_failed，建议点名 MinerU。
#[test]
fn mineru_request_codes_are_bad_requests_and_task_permission_is_auth() {
    for (code, category) in [
        ("-500", OcrErrorCategory::InvalidRequest),
        ("-10002", OcrErrorCategory::InvalidRequest),
        ("-60012", OcrErrorCategory::TaskNotFound),
        ("-60014", OcrErrorCategory::OperationNotAllowed),
    ] {
        let job = ocr_failed_job(OcrProviderKind::Mineru, category, Some(code), "参数错误", Some(200));
        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "upstream_bad_request", "{code}");
        assert!(!failure.retryable);
        assert!(failure.summary.contains(code) && failure.summary.contains("参数错误"), "{}", failure.summary);
        assert_eq!(failure.failure_category.as_deref(), Some("input"));
    }
    let job = ocr_failed_job(
        OcrProviderKind::Mineru,
        OcrErrorCategory::PermissionDenied,
        Some("-60013"),
        "没有权限访问该任务",
        Some(200),
    );
    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "auth_failed");
    assert!(!failure.retryable);
    assert!(failure.suggestion.as_deref().is_some_and(|text| text.contains("MinerU Token")));
}

/// 官方建议稍后重试的码在轮询里重试用完后：ocr_provider_failed，可重试；-60009 排队已满归限流；-60017 不可重试。
#[test]
fn mineru_retryable_codes_end_in_explicit_failures() {
    for (code, category) in [
        ("-10001", OcrErrorCategory::ServiceUnavailable),
        ("-60001", OcrErrorCategory::UploadLinkRequestFailed),
        ("-60010", OcrErrorCategory::ParseFailed),
        ("-60011", OcrErrorCategory::UploadedFileMissing),
        ("-60016", OcrErrorCategory::ExportFailed),
        ("-60020", OcrErrorCategory::FileSplitFailed),
        ("-60021", OcrErrorCategory::PageCountReadFailed),
        ("-60022", OcrErrorCategory::WebReadFailed),
        ("-60008", OcrErrorCategory::RemoteReadTimeout),
    ] {
        let job = ocr_failed_job(OcrProviderKind::Mineru, category, Some(code), "请稍后再试", Some(200));
        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "ocr_provider_failed", "{code}");
        assert!(failure.retryable, "{code}");
        assert_eq!(failure.failure_category.as_deref(), Some("provider"));
        assert!(failure.summary.contains(code), "{}", failure.summary);
    }
    let busy = ocr_failed_job(OcrProviderKind::Mineru, OcrErrorCategory::QueueFull, Some("-60009"), "队列已满", Some(200));
    let failure = classify_job_failure(&busy).expect("failure");
    assert_eq!(failure.category, "upstream_rate_limited");
    assert!(failure.retryable);
    assert_eq!(failure.failure_category.as_deref(), Some("rate_limit"));

    let exhausted = ocr_failed_job(
        OcrProviderKind::Mineru,
        OcrErrorCategory::RetryLimitReached,
        Some("-60017"),
        "重试次数达到上限",
        Some(200),
    );
    let failure = classify_job_failure(&exhausted).expect("failure");
    assert_eq!(failure.category, "ocr_provider_failed");
    assert!(!failure.retryable, "等模型升级，原样重试没用");
}

/// PaddleOCR：10003–10005 换文件；11002 过期；11003 / state=failed 解析失败带 errorMsg；10010 排队已满；提交 500 服务出错。
#[test]
fn paddle_codes_map_to_their_failures() {
    for (code, category, http_status, expected, retryable) in [
        ("10001", OcrErrorCategory::EmptyFile, Some(400), "ocr_file_rejected", false),
        ("10003", OcrErrorCategory::FileTooLarge, Some(400), "ocr_file_rejected", false),
        ("10004", OcrErrorCategory::UnsupportedFileFormat, Some(400), "ocr_file_rejected", false),
        ("10005", OcrErrorCategory::FileReadFailed, Some(400), "ocr_file_rejected", false),
        ("10006", OcrErrorCategory::TooManyPages, Some(400), "ocr_file_rejected", false),
        ("10002", OcrErrorCategory::InvalidRequest, Some(400), "upstream_bad_request", false),
        ("10008", OcrErrorCategory::InvalidRequest, Some(400), "upstream_bad_request", false),
        ("11002", OcrErrorCategory::TaskExpired, Some(400), "ocr_provider_failed", true),
        ("11003", OcrErrorCategory::ParseFailed, None, "ocr_provider_failed", true),
        ("10010", OcrErrorCategory::QueueFull, Some(400), "upstream_rate_limited", true),
    ] {
        let job = ocr_failed_job(OcrProviderKind::Paddle, category, Some(code), "服务商原话", http_status);
        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, expected, "{code}");
        assert_eq!(failure.retryable, retryable, "{code}");
        assert!(failure.summary.starts_with("PaddleOCR "), "{}", failure.summary);
        assert!(failure.summary.contains(&format!("（{code}）：服务商原话")), "{}", failure.summary);
    }
    let expired = ocr_failed_job(OcrProviderKind::Paddle, OcrErrorCategory::TaskExpired, Some("11002"), "job expired", Some(400));
    let failure = classify_job_failure(&expired).expect("failure");
    assert!(failure.summary.contains("任务已过期"), "{}", failure.summary);
    assert!(failure.suggestion.as_deref().is_some_and(|text| text.contains("重新提交")));

    // 轮询到 state=failed：没有业务码，summary 直接带 errorMsg
    let failed = ocr_failed_job(OcrProviderKind::Paddle, OcrErrorCategory::ParseFailed, None, "页面解析出错", None);
    let failure = classify_job_failure(&failed).expect("failure");
    assert_eq!(failure.category, "ocr_provider_failed");
    assert_eq!(failure.summary, "PaddleOCR 解析这份文件失败：页面解析出错");
    assert_eq!(failure.root_cause.as_deref(), Some("页面解析出错"));

    // 提交重交几次还是 HTTP 500
    let server = ocr_failed_job(OcrProviderKind::Paddle, OcrErrorCategory::ServiceUnavailable, None, "HTTP 500: internal", Some(500));
    let failure = classify_job_failure(&server).expect("failure");
    assert_eq!(failure.category, "ocr_provider_failed");
    assert!(failure.retryable);
    assert!(failure.summary.starts_with("PaddleOCR 服务暂时出错"), "{}", failure.summary);
    assert_eq!(failure.upstream.and_then(|upstream| upstream.http_status), Some(500));
}

/// 只认 OCR 阶段：翻译阶段的失败不拿 OCR 诊断里那条（可能是早先恢复了的错）。
#[test]
fn only_ocr_stage_failures_use_the_ocr_diagnostics() {
    let mut job = ocr_failed_job(OcrProviderKind::Mineru, OcrErrorCategory::FileTooLarge, Some("-60005"), "too large", Some(200));
    job.stage = Some("translation".to_string());
    job.error = Some("translation failed: boom".to_string());
    let failure = classify_job_failure(&job).expect("failure");
    assert_ne!(failure.category, "ocr_file_rejected");
}

/// 没有明确分类的（笼统的失败、超时、下载失败）照旧交给后面的文字兜底。
#[test]
fn unclassified_ocr_errors_fall_through() {
    for category in [
        OcrErrorCategory::ProviderFailed,
        OcrErrorCategory::Unknown,
        OcrErrorCategory::ResultDownloadFailed,
        OcrErrorCategory::RemoteReadTimeout,
    ] {
        assert!(rule_for(&category, false).is_none(), "{category:?}");
    }
    let job = ocr_failed_job(OcrProviderKind::Paddle, OcrErrorCategory::ProviderFailed, None, "boom", None);
    assert_eq!(classify_job_failure(&job).expect("failure").category, "unknown");
}

/// 新失败码在恢复目录里登记了（否则会落「未识别的失败类型」兜底文案）。
#[test]
fn new_failure_codes_are_catalogued() {
    let catalogued: Vec<&str> = crate::job_failure_catalogue::catalogued_failure_codes().collect();
    for code in ["ocr_file_rejected", "ocr_provider_failed", "upstream_bad_request", "upstream_rate_limited"] {
        assert!(catalogued.contains(&code), "{code}");
    }
}
