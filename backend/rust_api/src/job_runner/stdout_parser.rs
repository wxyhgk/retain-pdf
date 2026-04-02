use once_cell::sync::Lazy;
use regex::Regex;

use crate::models::StoredJob;

use super::{ensure_artifacts, ensure_ocr_provider};
use crate::ocr_provider::mineru::{
    classify_runtime_failure, extract_provider_error_code, extract_provider_message,
    extract_provider_trace_id, map_task_status,
};
use crate::ocr_provider::OcrErrorCategory;

pub const STDOUT_LABEL_JOB_ROOT: &str = "job root";
pub const STDOUT_LABEL_SOURCE_PDF: &str = "source pdf";
pub const STDOUT_LABEL_LAYOUT_JSON: &str = "layout json";
pub const STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON: &str = "normalized document json";
pub const STDOUT_LABEL_NORMALIZATION_REPORT_JSON: &str = "normalization report json";
pub const STDOUT_LABEL_PROVIDER_RAW_DIR: &str = "provider raw dir";
pub const STDOUT_LABEL_PROVIDER_ZIP: &str = "provider zip";
pub const STDOUT_LABEL_PROVIDER_SUMMARY_JSON: &str = "provider summary json";
pub const STDOUT_LABEL_SCHEMA_VERSION: &str = "schema version";
pub const STDOUT_LABEL_TRANSLATIONS_DIR: &str = "translations dir";
pub const STDOUT_LABEL_OUTPUT_PDF: &str = "output pdf";
pub const STDOUT_LABEL_SUMMARY: &str = "summary";

static JOB_ROOT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_JOB_ROOT)).unwrap());
static SOURCE_PDF_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_SOURCE_PDF)).unwrap());
static LAYOUT_JSON_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_LAYOUT_JSON)).unwrap());
static NORMALIZED_DOCUMENT_JSON_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"^{}:\s*(.+)$",
        STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON
    ))
    .unwrap()
});
static NORMALIZATION_REPORT_JSON_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"^{}:\s*(.+)$",
        STDOUT_LABEL_NORMALIZATION_REPORT_JSON
    ))
    .unwrap()
});
static PROVIDER_RAW_DIR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_PROVIDER_RAW_DIR)).unwrap());
static PROVIDER_ZIP_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_PROVIDER_ZIP)).unwrap());
static PROVIDER_SUMMARY_JSON_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(&format!(
        r"^{}:\s*(.+)$",
        STDOUT_LABEL_PROVIDER_SUMMARY_JSON
    ))
    .unwrap()
});
static SCHEMA_VERSION_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_SCHEMA_VERSION)).unwrap());
static TRANSLATIONS_DIR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_TRANSLATIONS_DIR)).unwrap());
static OUTPUT_PDF_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_OUTPUT_PDF)).unwrap());
static SUMMARY_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(&format!(r"^{}:\s*(.+)$", STDOUT_LABEL_SUMMARY)).unwrap());
static PAGES_PROCESSED_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^pages processed:\s*(\d+)$").unwrap());
static TRANSLATED_ITEMS_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^translated items:\s*(\d+)$").unwrap());
static TRANSLATE_TIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^translation time:\s*([0-9.]+)s$").unwrap());
static SAVE_TIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(?:render\+save time|save time):\s*([0-9.]+)s$").unwrap());
static TOTAL_TIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^total time:\s*([0-9.]+)s$").unwrap());
static MINERU_BATCH_STATE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^batch ([^:]+): state=(.+)$").unwrap());
static MINERU_TASK_STATE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^task ([^:]+): state=(.+)$").unwrap());
static BATCH_ID_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^batch_id:\s*(.+)$").unwrap());
static TASK_ID_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^task_id:\s*(.+)$").unwrap());
static FULL_ZIP_URL_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"^full_zip_url:\s*(.+)$").unwrap());
static PAGE_POLICY_MODE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: page policies mode=([a-z_]+) total_pages=(\d+)$").unwrap());
static PAGE_POLICY_PAGE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: page policy page (\d+)/(\d+) -> source page (\d+)$").unwrap());
static BATCH_PROGRESS_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: completed batch (\d+)/(\d+)$").unwrap());
static TRANSLATE_ATTEMPT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: batch (\d+)/(\d+): translate attempt").unwrap());
static OVERLAY_MERGE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^overlay merge page (\d+)/(\d+) -> source page (\d+)$").unwrap());

fn sync_provider_status_to_job(
    job: &mut StoredJob,
    raw_state: &str,
    task_id: Option<String>,
    batch_id: Option<String>,
) {
    let handle = {
        let diagnostics = ensure_ocr_provider(job);
        if let Some(task_id) = task_id {
            diagnostics.handle.task_id = Some(task_id);
        }
        if let Some(batch_id) = batch_id {
            diagnostics.handle.batch_id = Some(batch_id);
        }
        diagnostics.handle.clone()
    };
    let previous = ensure_ocr_provider(job).last_error.clone();
    let mapped = map_task_status(
        raw_state,
        handle,
        previous
            .as_ref()
            .and_then(|item| item.provider_message.clone()),
        previous.as_ref().and_then(|item| item.trace_id.clone()),
    );
    if let Some(trace_id) = mapped.trace_id.clone() {
        ensure_artifacts(job).provider_trace_id = Some(trace_id);
    }
    job.stage = mapped.stage.clone();
    job.stage_detail = mapped.detail.clone();
    ensure_ocr_provider(job).last_status = Some(mapped);
}

pub fn attach_provider_failure(job: &mut StoredJob, stderr_text: &str) {
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
    let diagnostics = ensure_ocr_provider(job);
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
        ensure_artifacts(job).provider_trace_id = Some(trace_id);
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

pub fn apply_line(job: &mut StoredJob, line: &str) {
    let stripped = line.trim();
    if stripped.is_empty() {
        return;
    }
    job.append_log(stripped);

    if let Some(caps) = JOB_ROOT_RE.captures(stripped) {
        ensure_artifacts(job).job_root = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = SOURCE_PDF_RE.captures(stripped) {
        ensure_artifacts(job).source_pdf = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = LAYOUT_JSON_RE.captures(stripped) {
        ensure_artifacts(job).layout_json = Some(caps[1].trim().to_string());
        ensure_ocr_provider(job).artifacts.layout_json = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = NORMALIZED_DOCUMENT_JSON_RE.captures(stripped) {
        ensure_artifacts(job).normalized_document_json = Some(caps[1].trim().to_string());
        ensure_ocr_provider(job).artifacts.normalized_document_json =
            Some(caps[1].trim().to_string());
    }
    if let Some(caps) = BATCH_ID_RE.captures(stripped) {
        ensure_ocr_provider(job).handle.batch_id = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = TASK_ID_RE.captures(stripped) {
        ensure_ocr_provider(job).handle.task_id = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = FULL_ZIP_URL_RE.captures(stripped) {
        ensure_ocr_provider(job).artifacts.full_zip_url = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = NORMALIZATION_REPORT_JSON_RE.captures(stripped) {
        ensure_artifacts(job).normalization_report_json = Some(caps[1].trim().to_string());
        ensure_ocr_provider(job).artifacts.normalization_report_json =
            Some(caps[1].trim().to_string());
        job.stage = Some("normalizing".to_string());
        job.stage_detail = Some("正在生成标准化 OCR 文档".to_string());
    }
    if let Some(caps) = PROVIDER_RAW_DIR_RE.captures(stripped) {
        ensure_artifacts(job).provider_raw_dir = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = PROVIDER_ZIP_RE.captures(stripped) {
        ensure_artifacts(job).provider_zip = Some(caps[1].trim().to_string());
        ensure_ocr_provider(job).artifacts.provider_bundle_zip = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = PROVIDER_SUMMARY_JSON_RE.captures(stripped) {
        ensure_artifacts(job).provider_summary_json = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = SCHEMA_VERSION_RE.captures(stripped) {
        ensure_artifacts(job).schema_version = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = TRANSLATIONS_DIR_RE.captures(stripped) {
        ensure_artifacts(job).translations_dir = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = OUTPUT_PDF_RE.captures(stripped) {
        ensure_artifacts(job).output_pdf = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = SUMMARY_RE.captures(stripped) {
        ensure_artifacts(job).summary = Some(caps[1].trim().to_string());
    }
    if let Some(caps) = PAGES_PROCESSED_RE.captures(stripped) {
        ensure_artifacts(job).pages_processed = caps[1].parse::<i64>().ok();
    }
    if let Some(caps) = TRANSLATED_ITEMS_RE.captures(stripped) {
        ensure_artifacts(job).translated_items = caps[1].parse::<i64>().ok();
    }
    if let Some(caps) = TRANSLATE_TIME_RE.captures(stripped) {
        ensure_artifacts(job).translate_render_time_seconds = caps[1].parse::<f64>().ok();
    }
    if let Some(caps) = SAVE_TIME_RE.captures(stripped) {
        ensure_artifacts(job).save_time_seconds = caps[1].parse::<f64>().ok();
    }
    if let Some(caps) = TOTAL_TIME_RE.captures(stripped) {
        ensure_artifacts(job).total_time_seconds = caps[1].parse::<f64>().ok();
    }

    if stripped.starts_with("upload done: ") {
        sync_provider_status_to_job(job, "waiting-file", None, None);
        job.stage = Some("mineru_upload".to_string());
        job.stage_detail = Some("文件上传完成，等待 MinerU 处理".to_string());
        return;
    }
    if let Some(caps) = MINERU_BATCH_STATE_RE.captures(stripped) {
        sync_provider_status_to_job(job, caps[2].trim(), None, Some(caps[1].trim().to_string()));
        return;
    }
    if let Some(caps) = MINERU_TASK_STATE_RE.captures(stripped) {
        sync_provider_status_to_job(job, caps[2].trim(), Some(caps[1].trim().to_string()), None);
        return;
    }
    if stripped.starts_with("layout json: ") {
        job.stage = Some("normalizing".to_string());
        job.stage_detail = Some("MinerU 结果已就绪，准备生成标准化 OCR 文档".to_string());
        return;
    }
    if stripped.starts_with("domain-infer: ") {
        job.stage = Some("domain_inference".to_string());
        job.stage_detail = Some("正在识别论文领域".to_string());
        return;
    }
    if stripped.starts_with("continuation-review ") {
        job.stage = Some("continuation_review".to_string());
        job.stage_detail = Some("正在判断跨栏/跨页连续段".to_string());
        return;
    }
    if stripped == "book: page policies start" {
        job.stage = Some("page_policies".to_string());
        job.stage_detail = Some("正在执行块规则、分类和局部拆分".to_string());
        return;
    }
    if let Some(caps) = PAGE_POLICY_MODE_RE.captures(stripped) {
        job.stage = Some("page_policies".to_string());
        job.stage_detail = Some("正在执行块规则、分类和局部拆分".to_string());
        job.progress_current = Some(0);
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if let Some(caps) = PAGE_POLICY_PAGE_RE.captures(stripped) {
        let current = caps[1].parse::<i64>().ok();
        let total = caps[2].parse::<i64>().ok();
        let source_page = caps[3].parse::<i64>().unwrap_or(0);
        job.stage = Some("page_policies".to_string());
        job.stage_detail = Some(format!(
            "正在处理第 {}/{} 页策略，对应源文第 {} 页",
            current.unwrap_or(0),
            total.unwrap_or(0),
            source_page
        ));
        job.progress_current = current.map(|v| v.saturating_sub(1));
        job.progress_total = total;
        return;
    }
    if let Some(caps) = TRANSLATE_ATTEMPT_RE.captures(stripped) {
        job.stage = Some("translating".to_string());
        job.stage_detail = Some(format!("正在翻译，第 {}/{} 批", &caps[1], &caps[2]));
        job.progress_current = caps[1].parse::<i64>().ok().map(|v| v.saturating_sub(1));
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if let Some(caps) = BATCH_PROGRESS_RE.captures(stripped) {
        job.stage = Some("translating".to_string());
        job.stage_detail = Some(format!("已完成第 {}/{} 批翻译", &caps[1], &caps[2]));
        job.progress_current = caps[1].parse::<i64>().ok();
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if stripped.starts_with("render source pdf: ")
        || stripped.starts_with("typst background render selected")
    {
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some("正在准备渲染".to_string());
        return;
    }
    if let Some(caps) = OVERLAY_MERGE_RE.captures(stripped) {
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some(format!("正在渲染第 {}/{} 页", &caps[1], &caps[2]));
        job.progress_current = caps[1].parse::<i64>().ok().map(|v| v.saturating_sub(1));
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if stripped.starts_with("save optimized pdf:") || stripped.starts_with("image-only compress:") {
        job.stage = Some("saving".to_string());
        job.stage_detail = Some("正在保存最终结果".to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobRequest;

    fn build_job() -> StoredJob {
        StoredJob::new(
            "job-test".to_string(),
            CreateJobRequest::default(),
            vec!["python".to_string()],
        )
    }

    #[test]
    fn apply_line_extracts_pipeline_artifacts_from_stdout_contract() {
        let mut job = build_job();
        apply_line(&mut job, &format!("{STDOUT_LABEL_JOB_ROOT}: /tmp/job"));
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_SOURCE_PDF}: /tmp/source.pdf"),
        );
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_LAYOUT_JSON}: /tmp/layout.json"),
        );
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON}: /tmp/document.v1.json"),
        );
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_NORMALIZATION_REPORT_JSON}: /tmp/document.v1.report.json"),
        );
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_TRANSLATIONS_DIR}: /tmp/translated"),
        );
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_OUTPUT_PDF}: /tmp/result.pdf"),
        );
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_SUMMARY}: /tmp/pipeline_summary.json"),
        );

        let artifacts = job.artifacts.as_ref().expect("artifacts");
        assert_eq!(artifacts.job_root.as_deref(), Some("/tmp/job"));
        assert_eq!(artifacts.source_pdf.as_deref(), Some("/tmp/source.pdf"));
        assert_eq!(artifacts.layout_json.as_deref(), Some("/tmp/layout.json"));
        assert_eq!(
            artifacts.normalized_document_json.as_deref(),
            Some("/tmp/document.v1.json")
        );
        assert_eq!(
            artifacts.normalization_report_json.as_deref(),
            Some("/tmp/document.v1.report.json")
        );
        assert_eq!(
            artifacts.translations_dir.as_deref(),
            Some("/tmp/translated")
        );
        assert_eq!(artifacts.output_pdf.as_deref(), Some("/tmp/result.pdf"));
        assert_eq!(
            artifacts.summary.as_deref(),
            Some("/tmp/pipeline_summary.json")
        );
    }

    #[test]
    fn apply_line_moves_to_normalizing_on_layout_json_marker() {
        let mut job = build_job();
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_LAYOUT_JSON}: /tmp/layout.json"),
        );
        assert_eq!(job.stage.as_deref(), Some("normalizing"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("MinerU 结果已就绪，准备生成标准化 OCR 文档")
        );
    }

    #[test]
    fn apply_line_updates_provider_diagnostics_for_batch_state() {
        let mut job = build_job();
        apply_line(&mut job, "batch_id: batch-123");
        apply_line(&mut job, "batch batch-123: state=running");
        let provider = job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
            .expect("provider diagnostics");
        assert_eq!(provider.handle.batch_id.as_deref(), Some("batch-123"));
        let status = provider.last_status.as_ref().expect("status");
        assert_eq!(status.raw_state.as_deref(), Some("running"));
        assert_eq!(status.stage.as_deref(), Some("mineru_processing"));
    }

    #[test]
    fn attach_provider_failure_surfaces_expired_token_detail() {
        let mut job = build_job();
        job.stage = Some("mineru_processing".to_string());
        attach_provider_failure(
            &mut job,
            r#"MinerU API error {"code":"A0211","msg":"Token 过期","trace_id":"trace-expired"}"#,
        );

        assert_eq!(
            job.stage_detail.as_deref(),
            Some("MinerU Token 已过期，请更换新 Token trace_id=trace-expired")
        );
        let provider = job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
            .expect("provider diagnostics");
        let error = provider.last_error.as_ref().expect("provider error");
        assert_eq!(error.provider_code.as_deref(), Some("A0211"));
    }

    #[test]
    fn attach_provider_failure_surfaces_invalid_token_detail() {
        let mut job = build_job();
        job.stage = Some("mineru_processing".to_string());
        attach_provider_failure(
            &mut job,
            r#"MinerU API error {"code":"A0202","msg":"token invalid","trace_id":"trace-invalid"}"#,
        );

        assert_eq!(
            job.stage_detail.as_deref(),
            Some("MinerU Token 无效或鉴权失败，请检查 Token 是否正确 trace_id=trace-invalid")
        );
        let provider = job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
            .expect("provider diagnostics");
        let error = provider.last_error.as_ref().expect("provider error");
        assert_eq!(error.provider_code.as_deref(), Some("A0202"));
    }

    #[test]
    fn attach_provider_failure_preserves_expired_token_detail_against_generic_fallback() {
        let mut job = build_job();
        job.stage = Some("mineru_processing".to_string());
        attach_provider_failure(
            &mut job,
            r#"MinerU API error {"code":"A0211","msg":"Token 过期","trace_id":"trace-expired"}"#,
        );

        let captured_detail = job.stage_detail.clone();
        if job
            .stage_detail
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        {
            job.stage_detail = Some("Python worker 执行失败".to_string());
        }

        assert_eq!(job.stage_detail.as_deref(), captured_detail.as_deref());
        assert_ne!(job.stage_detail.as_deref(), Some("Python worker 执行失败"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("MinerU Token 已过期，请更换新 Token trace_id=trace-expired")
        );
    }

    #[test]
    fn attach_provider_failure_preserves_invalid_token_detail_against_generic_fallback() {
        let mut job = build_job();
        job.stage = Some("mineru_processing".to_string());
        attach_provider_failure(
            &mut job,
            r#"MinerU API error {"code":"A0202","msg":"token invalid","trace_id":"trace-invalid"}"#,
        );

        let captured_detail = job.stage_detail.clone();
        if job
            .stage_detail
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .is_none()
        {
            job.stage_detail = Some("Python worker 执行失败".to_string());
        }

        assert_eq!(job.stage_detail.as_deref(), captured_detail.as_deref());
        assert_ne!(job.stage_detail.as_deref(), Some("Python worker 执行失败"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("MinerU Token 无效或鉴权失败，请检查 Token 是否正确 trace_id=trace-invalid")
        );
    }
}
