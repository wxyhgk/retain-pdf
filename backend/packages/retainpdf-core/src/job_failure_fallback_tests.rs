use super::*;

#[test]
fn missing_file_path_is_read_across_a_line_break_and_unescaped() {
    let text = "FileNotFoundError: [Errno 2] No such file or directory:\n'C:\\\\\\\\Users\\\\\\\\x\\\\\\\\a.pdf'";
    assert_eq!(missing_file_paths(text), vec!["C:\\Users\\x\\a.pdf".to_string()]);
}

#[test]
fn long_path_needs_a_windows_shape_and_the_length() {
    let long_tail = "a".repeat(260);
    assert!(is_long_windows_path(&format!("C:\\data\\{long_tail}")));
    assert!(!is_long_windows_path(&format!("/data/{long_tail}")));
    assert!(!is_long_windows_path("C:\\data\\short.pdf"));
}

#[test]
fn installed_file_detection() {
    assert!(is_installed_file(
        "/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/foundation/shared/latex_commands.json"
    ));
    assert!(!is_installed_file("/data/jobs/20260101-abc/rendered/page.typ"));
}

// —— 整条兜底分类（没有结构化失败时）——
// 报错文字取自 issue，路径里的用户名、论文标题已换掉。

use crate::job_failure::classify_job_failure;
use crate::models::domain::{JobArtifacts, JobStatusKind, OcrProviderErrorInfo};
use crate::models::request::CreateJobInput;

fn failed_job(job_id: &str, error: &str) -> JobSnapshot {
    let mut job = JobSnapshot::new(
        job_id.to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some(error.to_string());
    job
}

fn with_ocr_error(
    mut job: JobSnapshot,
    provider: OcrProviderKind,
    category: OcrErrorCategory,
    code: &str,
    http_status: u16,
) -> JobSnapshot {
    let mut diagnostics = OcrProviderDiagnostics::new(provider);
    diagnostics.last_error = Some(OcrProviderErrorInfo {
        category,
        provider_code: Some(code.to_string()),
        provider_message: Some("今日解析页数额度已用完".to_string()),
        operator_hint: None,
        trace_id: Some("trace-1".to_string()),
        http_status: Some(http_status),
    });
    job.artifacts = Some(JobArtifacts {
        ocr_provider_diagnostics: Some(diagnostics),
        ..JobArtifacts::default()
    });
    job
}

/// #135：OCR worker import 期找不到安装包里的数据文件，traceback 里有 direct_typst_math.py。
/// 以前被认成 render_failed「排版或编译阶段失败」，三条提示全指错方向。
const ISSUE_135_TRACEBACK: &str = r#"Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File "/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/ocr/__main__.py", line 52, in <module>
    raise SystemExit(main())
  File "/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/ocr/__main__.py", line 35, in main
    from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import main as worker_main
  File "/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/services/pipeline_shared/direct_typst_math.py", line 189, in <module>
    MITEX_REWRITE_DATABASE: tuple[tuple[str, str], ...] = mitex_rewrite_database()
  File "/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/foundation/shared/latex_commands.py", line 65, in latex_commands
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
FileNotFoundError: [Errno 2] No such file or directory: '/usr/local/lib/python3.11/site-packages/retainpdf_pipeline/foundation/shared/latex_commands.json'"#;

#[test]
fn ocr_import_crash_with_typst_in_traceback_is_not_render_failed() {
    let mut job = failed_job("20261003085054-fa5a65", ISSUE_135_TRACEBACK);
    job.stage_detail = Some("OCR 子任务结束，状态=Failed".to_string());

    let failure = classify_job_failure(&job).expect("failure");
    assert_ne!(failure.category, "render_failed");
    assert_ne!(failure.failed_stage.as_deref(), Some("render"));
    assert_eq!(failure.category, "runtime_environment_broken");
    assert_eq!(failure.failure_category.as_deref(), Some("environment"));
    assert!(!failure.retryable);
    assert_eq!(failure.resume_from, None);
    assert!(failure
        .recovery_hint
        .as_deref()
        .is_some_and(|hint| hint.contains("重新安装")));
}

#[test]
fn missing_typst_binary_is_still_render_failed() {
    let job = failed_job(
        "job-typst-missing",
        "FileNotFoundError: [Errno 2] No such file or directory: 'typst'",
    );
    assert_eq!(classify_job_failure(&job).expect("failure").category, "render_failed");

    // Windows 上 typst 起不来只说「找不到文件」，靠 traceback 走在渲染模块里认
    let job = failed_job(
        "job-typst-missing-win",
        "File \"C:\\\\RetainPDF\\\\backend\\\\pipeline\\\\retainpdf_pipeline\\\\render\\\\render_stage.py\", line 1\nFileNotFoundError: [WinError 2] The system cannot find the file specified",
    );
    assert_eq!(classify_job_failure(&job).expect("failure").category, "render_failed");
}

#[test]
fn missing_module_and_broken_shared_library_are_runtime_environment_broken() {
    // #7：桌面包漏打 PyMuPDF（以前落 unknown）；#162：_ssl 链到系统 libpython；#143：Windows 没有 fcntl
    for (job_id, error) in [
        (
            "job-fitz",
            "Traceback (most recent call last):\n  File \"/Applications/RetainPDF.app/Contents/Resources/backend/scripts/services/document_schema/normalize_pipeline.py\", line 8, in <module>\n    import fitz\nModuleNotFoundError: No module named 'fitz'",
        ),
        (
            "job-ssl",
            "ImportError: /opt/RetainPDF/resources/backend/python/lib/python3.11/lib-dynload/_ssl.cpython-311-x86_64-linux-gnu.so: undefined symbol: _PyModule_Add",
        ),
        ("job-fcntl", "ModuleNotFoundError: No module named 'fcntl'"),
    ] {
        let failure = classify_job_failure(&failed_job(job_id, error)).expect("failure");
        assert_eq!(failure.category, "runtime_environment_broken", "{job_id}");
        assert_eq!(failure.summary, "运行环境不完整：缺少模块、依赖库或安装文件");
    }
}

/// #81：渲染中间文件名带上了很长的论文标题，Windows 报「找不到文件」。任务号 20260723084017 里有
/// 「401」这串数字，当时的文字兜底把它认成了 auth_failed「检查 MinerU Token…」。
#[test]
fn long_windows_path_is_path_too_long_not_auth_failed() {
    let error = concat!(
        "Traceback (most recent call last):\n",
        "  File \"C:\\\\Users\\\\someone\\\\AppData\\\\Local\\\\Programs\\\\RetainPDF\\\\resources\\\\backend\\\\scripts\\\\runtime\\\\pipeline\\\\render_stage.py\", line 172, in run_render_stage\n",
        "  File \"C:\\\\Users\\\\someone\\\\AppData\\\\Local\\\\Programs\\\\RetainPDF\\\\resources\\\\backend\\\\python\\\\Lib\\\\site-packages\\\\pikepdf\\\\_methods.py\", line 684, in save\n",
        "FileNotFoundError: [Errno 2] No such file or directory: 'C:\\\\Users\\\\someone\\\\AppData\\\\Roaming\\\\retain-pdf-desktop\\\\data\\\\jobs\\\\20260723084017-be5283\\\\artifacts\\\\render_prewarm\\\\Someone 等 - 2025 - A rather long paper title about alternating current stimulation for complex oscillatory dynamics and inte-translated.source-bbox-text-stripped.pdf'"
    );
    let mut job = failed_job("20260723084017-be5283", error);
    job.log_tail = vec!["job 20260723084017-be5283 rendering".to_string()];

    let failure = classify_job_failure(&job).expect("failure");
    assert_ne!(failure.category, "auth_failed");
    assert_eq!(failure.category, "path_too_long");
    assert_eq!(failure.failed_stage.as_deref(), Some("render"));
    assert!(failure
        .suggestion
        .as_deref()
        .is_some_and(|text| text.contains("LongPathsEnabled")));
    assert!(!failure.retryable);
}

#[test]
fn permission_error_inside_connection_error_is_local_permission_denied() {
    // #38：安全软件拦截，requests 报 Connection aborted；以前是「暂未识别出明确根因」
    let error = "PermissionError: [Errno 13] Permission denied: 'C:\\\\nss_ssl_sfagent.log'\n\nDuring handling of the above exception, another exception occurred:\n\nrequests.exceptions.ConnectionError: ('Connection aborted.', PermissionError(13, 'Permission denied'))";
    let mut job = failed_job("job-permission", error);
    job.stage_detail = Some("正在翻译".to_string());

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "local_permission_denied");
    assert_eq!(failure.failed_stage.as_deref(), Some("translation"));
    assert_eq!(failure.summary, "本机权限不足，文件或网络访问被拒绝");
    assert!(failure
        .recovery_hint
        .as_deref()
        .is_some_and(|hint| hint.contains("安全软件")));
}

#[test]
fn bare_permission_denied_text_is_not_local() {
    // 上游 403 的说明里也会写 permission denied，不能当成本机权限
    let job = failed_job("job-remote-403", "provider returned HTTP 403: permission denied");
    assert_eq!(classify_job_failure(&job).expect("failure").category, "auth_failed");
}

#[test]
fn memory_error_is_out_of_memory() {
    // #80：约 180MB 的 document.v1.json 一次性 json.dumps
    let error = "Traceback (most recent call last):\n  File \"normalize_pipeline.py\", line 23, in _save_json\n    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding=\"utf-8\")\nMemoryError";
    let failure = classify_job_failure(&failed_job("job-oom", error)).expect("failure");
    assert_eq!(failure.category, "out_of_memory");
    assert!(failure
        .recovery_hint
        .as_deref()
        .is_some_and(|hint| hint.contains("页数更少")));
}

/// PaddleOCR 当日页数额度用完：HTTP 403 + code=12001。以前 Rust 归 PermissionDenied、任务落 unknown，
/// 日志里带 403 时还会被认成鉴权失败，用户会去换 Token。
#[test]
fn paddle_daily_quota_is_quota_not_auth() {
    for category in [OcrErrorCategory::QuotaExceeded, OcrErrorCategory::PermissionDenied] {
        let mut job = failed_job("job-paddle-quota", "Paddle HTTP 请求失败");
        job.stage_detail = Some("Paddle 提交失败: 今日解析页数额度已用完 trace_id=trace-1".to_string());
        job.log_tail = vec!["Paddle HTTP 请求失败: HTTP 403 Forbidden".to_string()];
        let job = with_ocr_error(job, OcrProviderKind::Paddle, category.clone(), "12001", 403);

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "upstream_quota_exhausted", "{category:?}");
        assert_eq!(failure.summary, "PaddleOCR 今日解析页数额度已用完（12001）");
        assert_eq!(failure.provider_code.as_deref(), Some("12001"));
        assert_eq!(failure.failure_category.as_deref(), Some("billing"));
        assert!(!failure.retryable);
        assert!(failure
            .suggestion
            .as_deref()
            .is_some_and(|text| text.contains("明天")));
    }
}

#[test]
fn mineru_daily_quota_is_quota() {
    let job = with_ocr_error(
        failed_job("job-mineru-quota", "MinerU 解析失败"),
        OcrProviderKind::Mineru,
        OcrErrorCategory::QuotaExceeded,
        "-60018",
        200,
    );
    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "upstream_quota_exhausted");
    assert_eq!(failure.summary, "MinerU 今日解析额度已用完（-60018）");
}

/// `auth_failed` 的建议按服务商出，PaddleOCR 用户不再看到「检查 MinerU Token」。
#[test]
fn auth_suggestion_names_the_actual_provider() {
    let paddle = with_ocr_error(
        failed_job("job-paddle-auth", "Paddle HTTP 请求失败"),
        OcrProviderKind::Paddle,
        OcrErrorCategory::Unauthorized,
        "401",
        401,
    );
    let failure = classify_job_failure(&paddle).expect("failure");
    assert_eq!(failure.category, "auth_failed");
    let suggestion = failure.suggestion.unwrap_or_default();
    assert!(suggestion.contains("PaddleOCR"), "{suggestion}");
    assert!(!suggestion.contains("MinerU"), "{suggestion}");

    let mineru = with_ocr_error(
        failed_job("job-mineru-auth", "MinerU token invalid"),
        OcrProviderKind::Mineru,
        OcrErrorCategory::Unauthorized,
        "A0202",
        200,
    );
    let suggestion = classify_job_failure(&mineru).expect("failure").suggestion.unwrap_or_default();
    assert!(suggestion.contains("MinerU"), "{suggestion}");

    // 没有 OCR 诊断、只能按文字认的 401：不点名某一家
    let text_only = failed_job("job-text-auth", "upstream returned HTTP 401 Unauthorized");
    let suggestion = classify_job_failure(&text_only).expect("failure").suggestion.unwrap_or_default();
    assert!(!suggestion.contains("MinerU"), "{suggestion}");
}
