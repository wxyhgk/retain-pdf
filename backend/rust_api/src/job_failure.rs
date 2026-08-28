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

    if haystack.contains("Failed to resolve")
        || haystack.contains("NameResolutionError")
        || haystack.contains("Temporary failure in name resolution")
        || haystack.contains("socket.gaierror")
    {
        return Some(build_failure(
            failed_stage,
            "dns_resolution_failed",
            None,
            "Phân giải tên miền dịch vụ mô hình bên ngoài thất bại",
            Some("Container không thể phân giải tên miền dịch vụ mô hình thượng nguồn tại thời điểm hiện tại, tác vụ bị gián đoạn trong giai đoạn dịch".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Ưu tiên thử lại một lần; nếu thất bại liên tục, hãy kiểm tra DNS Docker, mạng máy chủ hoặc cấu hình proxy".to_string()),
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
            "Yêu cầu dịch vụ bên ngoài quá thời gian chờ",
            Some("Tác vụ gọi OCR hoặc dịch vụ mô hình chờ quá lâu, vượt ngưỡng thời gian chờ".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Có thể thử lại ngay; nếu xảy ra thường xuyên, nên giảm đồng thời hoặc kiểm tra độ ổn định mạng".to_string()),
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
            "Worker Python thực thi quá thời gian chờ",
            Some(format!(
                "Tiến trình con Python bị chấm dứt sau khi vượt ngưỡng thời gian chờ runtime (timeout_seconds={timeout_seconds})"
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Có thể khôi phục từ điểm dừng hoặc thử lại; nếu xảy ra thường xuyên, nên giảm đồng thời, tăng timeout_seconds, hoặc kiểm tra thời gian mạng thượng nguồn".to_string()),
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
            "Xác minh placeholder công thức thất bại",
            Some("Số lượng hoặc thứ tự placeholder công thức trả về từ mô hình không khớp với văn bản gốc, kết quả dịch không vượt qua kiểm tra bảo vệ".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Có thể thử lại ngay; nếu tái hiện ổn định, nên chuyển sang chiến lược dịch từng khối bảo thủ hơn / giữ nguyên văn bản gốc".to_string()),
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
            "PDF nguồn bị thiếu",
            Some("OCR đã hoàn thành, nhưng khi vào giai đoạn chuẩn hóa không tìm thấy PDF nguồn trong thư mục làm việc của tác vụ".to_string()),
            false,
            None,
            provider_name(diagnostics),
            Some(
                "Kiểm tra thư mục source/ trong thư mục tác vụ trên máy tính để bàn có tồn tại PDF nguồn không, và xác nhận môi trường đóng gói không bỏ qua bước sao chép tệp"
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
            "Xác thực thất bại",
            Some("API Key / Token được sử dụng cho tác vụ hiện tại không hợp lệ, hết hạn hoặc thiếu quyền".to_string()),
            false,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Kiểm tra Token MinerU, API Key mô hình hoặc cấu hình X-API-Key backend".to_string()),
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
            "Dịch vụ thượng nguồn kích hoạt giới hạn lưu lượng",
            Some("Yêu cầu quá nhiều trong thời gian ngắn, dịch vụ thượng nguồn từ chối tiếp tục xử lý".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Chờ một thời gian rồi thử lại, hoặc giảm workers / cấu hình đồng thời".to_string()),
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
            "Tải phụ thuộc render Typst thất bại",
            Some("Gói Typst cần thiết cho giai đoạn render không lấy được thành công, dẫn đến biên dịch PDF bị gián đoạn".to_string()),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some(
                "Kiểm tra xem gói trên máy tính để bàn đã có sẵn Typst packages chưa, hoặc xác nhận môi trường chạy có thể truy cập packages.typst.org"
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
            "Giai đoạn sắp chữ hoặc biên dịch thất bại",
            Some("Dịch đã hoàn thành một phần, nhưng bị gián đoạn trong giai đoạn sắp chữ, render hoặc biên dịch PDF".to_string()),
            false,
            None,
            provider_name(diagnostics),
            Some("Kiểm tra typst, phông chữ, nội dung công thức hoặc thư mục sản phẩm trung gian có đầy đủ không".to_string()),
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
            "Worker Python thoát với mã khác không",
            Some(format!(
                "Tiến trình con Python trả về mã thoát khác không {}, nhưng không khớp với phân loại thất bại cụ thể hơn",
                result.return_code
            )),
            true,
            extract_upstream_host(&haystack),
            provider_name(diagnostics),
            Some("Xem raw_exception_message, traceback và log_tail; nếu đã có sản phẩm trung gian, có thể thử khôi phục từ điểm dừng".to_string()),
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
        "Tác vụ thất bại, nhưng chưa xác định được nguyên nhân rõ ràng",
        unknown_root_cause(error, &haystack, raw_diagnostic.as_ref()),
        true,
        extract_upstream_host(&haystack),
        provider_name(diagnostics),
        Some("Xem log_tail và nhật ký lỗi đầy đủ để kiểm tra thêm".to_string()),
        select_relevant_log_line(job, error, &[]),
        first_error_excerpt(error, &haystack),
        raw_diagnostic,
    ))
}

#[cfg(test)]
mod tests {
    use super::classify_job_failure;
    use crate::models::domain::{JobSnapshot, JobStatusKind};
    use crate::models::request::CreateJobInput;

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
        job.stage_detail = Some("Đang dịch".to_string());

        let failure = classify_job_failure(&job).expect("failure");
        assert_eq!(failure.category, "placeholder_unstable");
        assert_eq!(failure.stage, "translation");
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
        job.stage_detail = Some("Đang dịch".to_string());
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
        job.error = Some("PlaceholderInventoryError: placeholder inventory mismatch".to_string());
        job.stage = Some("translation".to_string());
        job.stage_detail = Some("Đang dịch".to_string());

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
        job.stage_detail = Some("Đang chuẩn bị render".to_string());

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
            "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"stage\":\"normalization\",\"error_type\":\"document_schema_validation_failed\",\"summary\":\"Tài liệu chuẩn hóa xác thực thất bại\",\"detail\":\"normalized document schema validation failed\",\"retryable\":false,\"upstream_host\":\"\",\"provider\":\"ocr\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"normalized document schema validation failed\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
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
            "Traceback (most recent call last):\nRuntimeError: boom\nstructured failure json: {\"failed_stage\":\"ocr_processing\",\"failure_code\":\"auth_failed\",\"failure_category\":\"auth\",\"summary\":\"Xác thực thất bại\",\"root_cause\":\"MinerU token expired\",\"retryable\":false,\"upstream_host\":\"mineru.net\",\"provider\":\"mineru\",\"provider_stage\":\"mineru_processing\",\"provider_code\":\"A0211\",\"suggestion\":\"Cập nhật Token\",\"raw_excerpt\":\"token expired\",\"raw_exception_type\":\"RuntimeError\",\"raw_exception_message\":\"token expired\",\"traceback\":\"Traceback (most recent call last):\\nRuntimeError: boom\"}\n"
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
        assert_eq!(failure.suggestion.as_deref(), Some("Cập nhật Token"));
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
        assert_eq!(failure.summary, "PDF nguồn bị thiếu");
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
        job.stage_detail = Some("Worker Python thực thi thất bại".to_string());
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
}
