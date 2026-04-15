use crate::models::{JobArtifacts, JobSnapshot};
use crate::ocr_provider::{parse_provider_kind, provider_capabilities, OcrProviderDiagnostics};

mod artifact_rules;
mod failure;
mod stage_rules;

pub use failure::attach_provider_failure;

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

fn parse_labeled_value<'a>(line: &'a str, label: &str) -> Option<&'a str> {
    line.strip_prefix(label)
        .and_then(|rest| rest.strip_prefix(':'))
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn job_artifacts_mut(job: &mut JobSnapshot) -> &mut JobArtifacts {
    if job.artifacts.is_none() {
        job.artifacts = Some(JobArtifacts::default());
    }
    job.artifacts.as_mut().unwrap()
}

fn ocr_provider_diagnostics_mut(job: &mut JobSnapshot) -> &mut OcrProviderDiagnostics {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr.provider);
    let artifacts = job_artifacts_mut(job);
    if artifacts.ocr_provider_diagnostics.is_none() {
        let mut diagnostics = OcrProviderDiagnostics::new(provider_kind.clone());
        diagnostics.capabilities = provider_capabilities(&provider_kind);
        artifacts.ocr_provider_diagnostics = Some(diagnostics);
    } else if artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .map(|diag| diag.capabilities.is_none() || diag.provider != provider_kind)
        .unwrap_or(true)
    {
        let diagnostics = artifacts.ocr_provider_diagnostics.as_mut().unwrap();
        diagnostics.provider = provider_kind.clone();
        diagnostics.capabilities = provider_capabilities(&provider_kind);
    }
    artifacts.ocr_provider_diagnostics.as_mut().unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobInput;

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
    }

    #[test]
    fn apply_line_keeps_upload_done_in_processing_stage() {
        let mut job = build_job();
        apply_line(&mut job, "upload done: /tmp/source.pdf");
        assert_eq!(job.stage.as_deref(), Some("mineru_processing"));
        assert_eq!(job.stage_detail.as_deref(), Some("文件上传完成，等待 MinerU 处理"));
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
    fn attach_provider_failure_surfaces_expired_token_detail() {
        let mut job = build_job();
        job.stage = Some("mineru_processing".to_string());
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
        job.stage = Some("mineru_processing".to_string());
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
        job.stage = Some("mineru_processing".to_string());
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
        job.stage = Some("mineru_processing".to_string());
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
