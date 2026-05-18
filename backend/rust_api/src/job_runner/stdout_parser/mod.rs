use crate::models::JobSnapshot;

mod artifact_rules;
mod failure;
mod labels;
mod stage_rules;
mod state;

pub use failure::attach_provider_failure;
pub use labels::{
    STDOUT_LABEL_EVENTS_JSONL, STDOUT_LABEL_JOB_ROOT, STDOUT_LABEL_LAYOUT_JSON,
    STDOUT_LABEL_NORMALIZATION_REPORT_JSON, STDOUT_LABEL_NORMALIZED_DOCUMENT_JSON,
    STDOUT_LABEL_OUTPUT_PDF, STDOUT_LABEL_PROVIDER_RAW_DIR, STDOUT_LABEL_PROVIDER_SUMMARY_JSON,
    STDOUT_LABEL_PROVIDER_ZIP, STDOUT_LABEL_SCHEMA_VERSION, STDOUT_LABEL_SOURCE_PDF,
    STDOUT_LABEL_SUMMARY, STDOUT_LABEL_TRANSLATIONS_DIR,
};
pub(crate) use state::{job_artifacts_mut, ocr_provider_diagnostics_mut, parse_labeled_value};

pub fn apply_line(job: &mut JobSnapshot, line: &str) {
    let stripped = line.trim();
    if stripped.is_empty() {
        return;
    }
    job.append_log(stripped);

    artifact_rules::apply_artifact_line(job, stripped);
    artifact_rules::apply_metric_line(job, stripped);
    stage_rules::apply_stage_line(job, stripped);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{job_stage_str, CreateJobInput, JobStage};

    fn build_job() -> JobSnapshot {
        JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
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
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_EVENTS_JSONL}: /tmp/pipeline_events.jsonl"),
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
        assert_eq!(
            artifacts.events_jsonl.as_deref(),
            Some("/tmp/pipeline_events.jsonl")
        );
    }

    #[test]
    fn apply_line_extracts_artifacts_from_structured_stdout_event() {
        let mut job = build_job();
        apply_line(
            &mut job,
            r#"{"event_type":"artifact_published","payload":{"artifact_key":"pipeline_summary_json","path":"/tmp/pipeline_summary.json"}}"#,
        );
        apply_line(
            &mut job,
            r#"{"event_type":"artifact_published","payload":{"artifact_key":"output_pdf","path":"/tmp/output.pdf"}}"#,
        );
        apply_line(
            &mut job,
            r#"{"event_type":"artifact_published","payload":{"artifact_key":"translations_dir","path":"/tmp/translated"}}"#,
        );

        let artifacts = job.artifacts.as_ref().expect("artifacts");
        assert_eq!(
            artifacts.summary.as_deref(),
            Some("/tmp/pipeline_summary.json")
        );
        assert_eq!(artifacts.output_pdf.as_deref(), Some("/tmp/output.pdf"));
        assert_eq!(
            artifacts.translations_dir.as_deref(),
            Some("/tmp/translated")
        );
    }

    #[test]
    fn apply_line_moves_to_normalizing_on_normalization_report_marker() {
        let mut job = build_job();
        job.stage = Some(job_stage_str(JobStage::OcrProcessing).to_string());
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_NORMALIZATION_REPORT_JSON}: /tmp/document.v1.report.json"),
        );
        assert_eq!(job.stage.as_deref(), Some("normalizing"));
    }

    #[test]
    fn apply_line_does_not_move_translation_back_to_normalizing_on_report_marker() {
        let mut job = build_job();
        job.stage = Some(job_stage_str(JobStage::Translating).to_string());
        job.stage_detail = Some("OCR 完成，开始翻译".to_string());
        apply_line(
            &mut job,
            &format!("{STDOUT_LABEL_NORMALIZATION_REPORT_JSON}: /tmp/document.v1.report.json"),
        );
        assert_eq!(job.stage.as_deref(), Some("translating"));
        assert_eq!(job.stage_detail.as_deref(), Some("OCR 完成，开始翻译"));
    }

    #[test]
    fn apply_line_keeps_upload_done_in_processing_stage() {
        let mut job = build_job();
        apply_line(&mut job, "upload done: /tmp/source.pdf");
        assert_eq!(job.stage.as_deref(), Some("mineru_processing"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("文件上传完成，等待 MinerU 处理")
        );
    }

    #[test]
    fn apply_line_updates_provider_diagnostics_for_batch_state() {
        let mut job = build_job();
        apply_line(&mut job, "batch_id: batch-123");
        apply_line(&mut job, "batch batch-123: state=running");

        let diagnostics = job
            .artifacts
            .as_ref()
            .and_then(|a| a.ocr_provider_diagnostics.as_ref())
            .expect("diagnostics");
        assert_eq!(diagnostics.handle.batch_id.as_deref(), Some("batch-123"));
        assert_eq!(
            diagnostics
                .last_status
                .as_ref()
                .and_then(|s| s.stage.as_deref()),
            Some("mineru_processing")
        );
    }

    #[test]
    fn apply_line_no_longer_guesses_translation_stage_from_text_progress() {
        let mut job = build_job();
        apply_line(&mut job, "book: completed batch 2/10");
        assert_eq!(job.stage.as_deref(), Some("queued"));
        assert_eq!(
            job.stage_detail.as_deref(),
            Some("任务已创建，等待可用执行槽位")
        );
    }

    #[test]
    fn attach_provider_failure_surfaces_expired_token_detail() {
        let mut job = build_job();
        job.stage = Some(job_stage_str(JobStage::MineruProcessing).to_string());
        attach_provider_failure(
            &mut job,
            r#"{"code":"A0211","msg":"token expired","trace_id":"trace-1"}"#,
        );
        assert!(job
            .stage_detail
            .as_deref()
            .unwrap_or_default()
            .contains("Token 已过期"));
    }

    #[test]
    fn attach_provider_failure_surfaces_invalid_token_detail() {
        let mut job = build_job();
        job.stage = Some(job_stage_str(JobStage::MineruProcessing).to_string());
        attach_provider_failure(
            &mut job,
            r#"{"code":"A0202","msg":"invalid token","trace_id":"trace-1"}"#,
        );
        assert!(job
            .stage_detail
            .as_deref()
            .unwrap_or_default()
            .contains("Token 无效"));
    }

    #[test]
    fn attach_provider_failure_preserves_expired_token_detail_against_generic_fallback() {
        let mut job = build_job();
        job.stage = Some(job_stage_str(JobStage::MineruProcessing).to_string());
        attach_provider_failure(
            &mut job,
            r#"MinerU task failed {"code":"A0211","msg":"token expired","trace_id":"trace-1"} HTTP 401 Unauthorized"#,
        );
        assert!(job
            .stage_detail
            .as_deref()
            .unwrap_or_default()
            .contains("Token 已过期"));
    }

    #[test]
    fn attach_provider_failure_preserves_invalid_token_detail_against_generic_fallback() {
        let mut job = build_job();
        job.stage = Some(job_stage_str(JobStage::MineruProcessing).to_string());
        attach_provider_failure(
            &mut job,
            r#"MinerU task failed {"code":"A0202","msg":"invalid api key","trace_id":"trace-1"} HTTP 401 Unauthorized"#,
        );
        assert!(job
            .stage_detail
            .as_deref()
            .unwrap_or_default()
            .contains("Token 无效"));
    }
}
