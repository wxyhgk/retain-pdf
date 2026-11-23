use super::classify_job_failure;
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::models::request::CreateJobInput;

/// 分类出来的失败必须带着恢复信息——这是「前端不认具体分类」的前提。
///
/// 以前每个检测分支各自决定填不填提示,漏一个分支用户就看到「没有可识别的
/// 恢复状态」。现在 `classify_job_failure` 在出口统一查目录,漏不掉。
///
/// 反证方式：把 `classify_job_failure` 里的 `.map(with_recovery)` 去掉，
/// 这个测试必须变红。
#[test]
fn every_classified_failure_carries_recovery_info() {
    // 渲染失败：翻译产物完好，应当只重跑渲染
    let build = |err: &str, stage: &str| {
        let mut job = JobSnapshot::new(
            "job-recovery".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.error = Some(err.to_string());
        job.stage = Some(stage.to_string());
        job
    };
    let job = build("Typst compile failed phase=render_pages code=-1", "rendering");
    let failure = classify_job_failure(&job).expect("应当被分类");
    assert_eq!(failure.category, "render_failed");
    assert_eq!(
        failure.resume_from.as_deref(),
        Some("render"),
        "渲染失败不该让用户重烧 OCR 和翻译的钱"
    );
    assert!(
        failure.recovery_hint.is_some(),
        "每一种分类都必须有给用户的说明"
    );

    // 没被目录登记的分类也必须有兜底，不能是 None
    let unknown = classify_job_failure(&build("something totally unexpected", "translation"))
        .expect("应当被分类成 unknown");
    assert!(
        unknown.recovery_hint.is_some(),
        "未登记的分类也要有保守兜底文案，不能让前端拿到 None"
    );
}

#[test]
fn classify_job_failure_maps_placeholder_instability() {
    let mut job = JobSnapshot::new(
        "job-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.error = Some("PlaceholderInventoryError: placeholder inventory mismatch".to_string());
    job.stage = Some("translation".to_string());
    job.stage_detail = Some("正在翻译".to_string());

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "placeholder_unstable");
    assert_eq!(failure.stage, "translation");
}

#[test]
fn classify_job_failure_blocks_automatic_retry_for_ambiguous_ocr_submit() {
    let mut job = JobSnapshot::new(
        "job-ambiguous-ocr-submit".to_string(),
        CreateJobInput::default(),
        vec!["native-ocr".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("ocr".to_string());
    job.error = Some(
        "OCR provider request outcome is ambiguous; automatic resubmit blocked: service restarted before receipt"
            .to_string(),
    );

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "ocr_request_ambiguous");
    assert_eq!(failure.failure_category.as_deref(), Some("provider"));
    assert!(!failure.retryable);
}

#[test]
fn classify_job_failure_does_not_treat_render_mode_log_as_render_failure() {
    let mut job = JobSnapshot::new(
        "job-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
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
    let mut job = JobSnapshot::new(
        "job-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.error = Some("typst compile failed: font not found".to_string());
    job.stage = Some("translation".to_string());
    job.stage_detail = Some("正在翻译".to_string());

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "render_failed");
    assert_eq!(failure.stage, "render");
}

#[test]
fn classify_job_failure_maps_typst_package_download_failure() {
    let mut job = JobSnapshot::new(
        "job-failure".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
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

/// typst 二进制缺失走的是 Python 的结构化 JSON 路径， 被原样
/// 当成分类——所以 Rust 侧那些子串分支一行都不跑。这条分类必须在恢复目录里
/// 登记，否则用户看到的是「重试会从头开始」，而那是假的：恢复按钮不看分类，
/// 「重新渲染」照样出现、照样只重跑渲染。被吓去点 OCR 重试才是真花钱。
///
/// JSON 取自真实复现（摘掉 PATH 里的 typst 后跑 _run_typst_compile）。
#[test]
fn missing_typst_binary_keeps_its_render_resume_hint() {
    let mut job = JobSnapshot::new(
        "job-typst-missing".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("rendering".to_string());
    job.error = Some(format!(
        "Traceback (most recent call last):\n  ...\nstructured failure json: {}",
        r#"{"failed_stage":"render","failure_code":"typst_runtime_failed","failure_category":"render","provider_stage":"","provider_code":"","suggestion":"检查渲染输入、字体和编译环境。","stage":"render","error_type":"typst_runtime_failed","summary":"Typst 运行时启动失败","detail":"Typst compile failed phase=render_pages stem=book-background-overlay code=-1 typ=/var/folders/ls/l8r8r1f168j7n6g_8y6rrnb80000gn/T/tmpqzh0api9/p.typ\nTypst runtime failed to start: ExternalToolNotFound: 未找到 typst 可执行文件：TYPST_BIN 未设置，PATH 里也没有 typst。桌面端和 Docker 镜像都自带 typst，出现这个错误通常是在本地开发环境里——安装 typst 并加入 PATH，或把 TYPST_BIN 指向可执行文件即可。","retryable":false,"upstream_host":"","provider":"","raw_exception_type":"TypstCompileError","raw_exception_message":"Typst compile failed phase=render_pages stem=book-background-overlay code=-1 typ=/var/folders/ls/l8r8r1f168j7n6g_8y6rrnb80000gn/T/tmpqzh0api9/p.typ\nTypst runtime failed to start: ExternalToolNotFound: 未找到 typst 可执行文件：TYPST_BIN 未设置，PATH 里也没有 typst。桌面端和 Docker 镜像都自带 typst，出现这个错误通常是在本地开发环境里——安装 typst 并加入 PATH，或把 TYPST_BIN 指向可执行文件即可。"}"#
    ));

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "typst_runtime_failed");
    assert_eq!(failure.stage, "render");
    // 这两条是本次修复的实质：翻译产物可复用，且提示不谎称重试会从头开始。
    assert_eq!(failure.resume_from.as_deref(), Some("render"));
    let hint = failure.recovery_hint.as_deref().unwrap_or_default();
    assert!(!hint.contains("从头开始"), "落到了兜底文案：{hint}");
    assert!(hint.contains("TYPST_BIN"), "提示没说清怎么修：{hint}");
}

/// 「最近日志」是直接渲染给用户看的（FailurePanel 的 .mono span）。结构化
/// 路径调 select_relevant_log_line 时关键词列表是空的，会无条件选中最后一行
/// 非空行——而那正是 `structured failure json:`，一整坨含 traceback 的 JSON。
#[test]
fn relevant_log_line_skips_the_structured_failure_json() {
    let mut job = JobSnapshot::new(
        "job-log-line".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("rendering".to_string());
    job.error = Some(format!(
        "Traceback (most recent call last):\n  File \"x.py\", line 1\n\
             TypstCompileError: Typst compile failed phase=render_pages stem=bg code=-1\n\
             structured failure json: {}",
        r#"{"failure_code":"typst_runtime_failed","failed_stage":"render","summary":"Typst 运行时启动失败","retryable":false,"failure_category":"render"}"#
    ));

    let failure = classify_job_failure(&job).expect("failure");
    let line = failure.last_log_line.expect("last_log_line");
    assert!(
        !line.starts_with("structured failure json"),
        "把给分类器解析的 JSON 当成了给人看的日志：{line}"
    );
    assert!(line.contains("TypstCompileError"), "选错了行：{line}");
}

/// log_tail 里的同一行也不该被选中。
#[test]
fn relevant_log_line_skips_structured_json_in_log_tail() {
    let mut job = JobSnapshot::new(
        "job-log-tail".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("rendering".to_string());
    // error 必须为空，否则 error 那一轮先返回，根本走不到 log_tail——
    // 第一版就是这么写的，结果测试绿着却什么都没守住（反证时没转红）。
    job.error = None;
    job.log_tail = vec![
        "typst compile failed: font not found".to_string(),
        r#"structured failure json: {"failure_code":"render_failed"}"#.to_string(),
    ];

    let failure = classify_job_failure(&job).expect("failure");
    let line = failure.last_log_line.expect("last_log_line");
    assert!(!line.starts_with("structured failure json"), "选错了行：{line}");
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
    assert_eq!(failure.failed_stage.as_deref(), Some("normalization"));
    assert_eq!(
        failure.failure_code.as_deref(),
        Some("document_schema_validation_failed")
    );
    assert_eq!(failure.failure_category.as_deref(), Some("normalization"));
    assert_eq!(
        failure
            .raw_diagnostic
            .as_ref()
            .and_then(|item| item.structured_error_type.as_deref()),
        Some("document_schema_validation_failed")
    );
}

#[test]
fn classify_job_failure_accepts_new_structured_failure_protocol() {
    let mut job = crate::models::JobSnapshot::new(
        "job-failure-new-structured".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = crate::models::JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some(
        "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"failed_stage\":\"ocr_processing\",\"failure_code\":\"auth_failed\",\"failure_category\":\"auth\",\"summary\":\"鉴权失败\",\"root_cause\":\"MinerU token expired\",\"retryable\":false,\"upstream_host\":\"mineru.net\",\"provider\":\"mineru\",\"provider_stage\":\"mineru_processing\",\"provider_code\":\"A0211\",\"suggestion\":\"更新 Token\",\"raw_excerpt\":\"token expired\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"token expired\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
            .to_string(),
    );

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.stage, "ocr_processing");
    assert_eq!(failure.category, "auth_failed");
    assert_eq!(failure.code.as_deref(), Some("A0211"));
    assert_eq!(failure.failed_stage.as_deref(), Some("ocr_processing"));
    assert_eq!(failure.failure_code.as_deref(), Some("auth_failed"));
    assert_eq!(failure.failure_category.as_deref(), Some("auth"));
    assert_eq!(failure.provider_stage.as_deref(), Some("mineru_processing"));
    assert_eq!(failure.provider_code.as_deref(), Some("A0211"));
    assert_eq!(failure.raw_excerpt.as_deref(), Some("token expired"));
    assert_eq!(failure.raw_error_excerpt.as_deref(), Some("token expired"));
    assert_eq!(failure.suggestion.as_deref(), Some("更新 Token"));
    assert_eq!(
        failure.resume_from, None,
        "OCR 阶段的 Key 被拒没有 OCR 产物可复用，只能整个重跑"
    );
}

/// 翻译 Key 被拒时翻译会整份停下（流水线报 failed_stage=translation），OCR 已经做完：
/// 换 Key 后从翻译续跑，不重付 OCR 的钱。结构化失败照抄流水线实际打出来的那一行。
#[test]
fn translation_auth_failure_resumes_at_translation() {
    let mut job = crate::models::JobSnapshot::new(
        "job-translation-auth".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = crate::models::JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some(
        "structured failure json: {\"failed_stage\":\"translation\",\"failure_code\":\"auth_failed\",\"failure_category\":\"auth\",\"provider_stage\":\"\",\"provider_code\":\"\",\"suggestion\":\"检查 translation 凭据、模型 API Key 或相关访问令牌是否有效。\",\"raw_excerpt\":\"翻译 API Key 被上游拒绝（HTTP 401），已停止翻译，剩下的块没有再发请求。\",\"stage\":\"translation\",\"error_type\":\"auth_failed\",\"summary\":\"鉴权失败\",\"retryable\":false,\"provider\":\"translation\"}\n"
            .to_string(),
    );

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "auth_failed");
    assert_eq!(failure.failed_stage.as_deref(), Some("translation"));
    assert_eq!(failure.resume_from.as_deref(), Some("translation"));
    assert!(failure
        .recovery_hint
        .as_deref()
        .is_some_and(|hint| hint.contains("从翻译阶段续跑")));
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

#[test]
fn classify_job_failure_maps_unknown_process_exit() {
    let mut job = crate::models::JobSnapshot::new(
        "job-process-exit".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = crate::models::JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.stage_detail = Some("Python worker 执行失败".to_string());
    job.error = Some("plain worker failure".to_string());
    job.result = Some(crate::models::ProcessResult {
        success: false,
        return_code: 17,
        duration_seconds: 0.5,
        command: vec!["python".to_string()],
        cwd: "/tmp".to_string(),
        stdout: "".to_string(),
        stderr: "CustomWorkerError: bad state".to_string(),
    });

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "process_exit_failed");
    assert_eq!(failure.failure_code.as_deref(), Some("process_exit_failed"));
    assert_eq!(failure.failure_category.as_deref(), Some("internal"));
    assert_eq!(failure.provider_code.as_deref(), Some("exit_code_17"));
    assert_eq!(
        failure
            .raw_diagnostic
            .as_ref()
            .and_then(|item| item.raw_exception_type.as_deref()),
        Some("CustomWorkerError")
    );
}

#[test]
fn classify_job_failure_does_not_read_provider_task_id_as_http_429() {
    let mut job = JobSnapshot::new(
        "job-provider-task-id".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some("Paddle 任务执行失败".to_string());
    job.log_tail = vec![
        "paddle task 84874297000996864: state=failed".to_string(),
        "Paddle 轮询失败: 系统错误-拆页".to_string(),
    ];

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "unknown");
}

#[test]
fn classify_job_failure_still_maps_bounded_http_429() {
    let mut job = JobSnapshot::new(
        "job-http-429".to_string(),
        CreateJobInput::default(),
        vec!["python".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.error = Some("provider returned HTTP 429 Too Many Requests".to_string());

    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "rate_limited");
}

fn ocr_failed_job(stage: &str, error: &str) -> JobSnapshot {
    use crate::models::domain::{
        JobArtifacts, OcrErrorCategory, OcrProviderDiagnostics, OcrProviderErrorInfo,
        OcrProviderKind,
    };
    let mut job = JobSnapshot::new(
        "job-ocr-upstream".to_string(),
        CreateJobInput::default(),
        vec!["native-ocr".to_string()],
    );
    job.status = JobStatusKind::Failed;
    job.stage = Some(stage.to_string());
    job.error = Some(error.to_string());
    let mut diagnostics = OcrProviderDiagnostics::new(OcrProviderKind::Paddle);
    diagnostics.last_error = Some(OcrProviderErrorInfo {
        category: OcrErrorCategory::PermissionDenied,
        provider_code: Some("12001".to_string()),
        provider_message: Some("daily quota exceeded".to_string()),
        http_status: Some(403),
        ..OcrProviderErrorInfo::default()
    });
    job.artifacts = Some(JobArtifacts {
        ocr_provider_diagnostics: Some(diagnostics),
        ..JobArtifacts::default()
    });
    job
}

/// Rust 跑的 Paddle、MinerU：OCR 阶段失败时用 OCR 诊断里服务商最后一次报的错补上 upstream，
/// provider 是服务商编号（不是泛称 ocr）。
#[test]
fn ocr_stage_failure_takes_upstream_from_provider_diagnostics() {
    let job = ocr_failed_job("ocr_processing", "Paddle HTTP 请求失败");
    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.provider.as_deref(), Some("paddle"));
    let upstream = failure.upstream.expect("upstream from diagnostics");
    assert_eq!(upstream.provider.as_deref(), Some("paddle"));
    assert_eq!(upstream.http_status, Some(403));
    assert_eq!(upstream.code.as_deref(), Some("12001"));
}

/// OCR 做完以后翻译失败：诊断里那条可能是早先恢复了的错，不能安到翻译失败上。
#[test]
fn later_stage_failure_does_not_borrow_a_stale_ocr_error() {
    let job = ocr_failed_job("translation", "PlaceholderInventoryError: placeholder inventory mismatch");
    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "placeholder_unstable");
    assert!(failure.upstream.is_none(), "{:?}", failure.upstream);
}

/// 同一份诊断（Paddle 12001），失败落在 OCR 阶段时照旧归成额度用完。
#[test]
fn ocr_stage_quota_error_is_still_quota_exhausted() {
    let job = ocr_failed_job("ocr_processing", "Paddle HTTP 请求失败");
    let failure = classify_job_failure(&job).expect("failure");
    assert_eq!(failure.category, "upstream_quota_exhausted");
}
