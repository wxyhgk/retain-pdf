use retainpdf_api_base::error::AppError;
use retainpdf_core::job_failure::classify_job_failure;
use crate::views::{JobDiagnosticsView, OcrAmbiguityView};
use retainpdf_core::models::domain::{JobFailureInfo, JobSnapshot, JobStatusKind};
use crate::actions::resume_plan::build_resume_plan_view;
use crate::actions::translation_request_recovery::load_translation_request_recovery_with_db;
use retainpdf_core::storage_paths::resolve_pipeline_summary;

use crate::presentation::build_ocr_ambiguity_view;
use retainpdf_api_base::job_loading::load_supported_job;
use crate::query::JobQueries;

impl JobQueries<'_> {
    pub fn job_diagnostics_view(&self, job_id: &str) -> Result<JobDiagnosticsView, AppError> {
        let job = load_supported_job(self.db, self.data_root, job_id)?;
        // 已取消的任务也给：上传到一半被取消时派发记录同样拿不准，续跑会被它挡住。
        let ocr_ambiguity = if matches!(job.status, JobStatusKind::Failed | JobStatusKind::Canceled) {
            self.db
                .latest_ocr_dispatch_for_job(job_id)?
                .as_ref()
                .and_then(build_ocr_ambiguity_view)
        } else {
            None
        };
        Ok(build_job_diagnostics_view(
            self.db,
            &job,
            self.data_root,
            ocr_ambiguity,
        ))
    }

}

fn build_job_diagnostics_view(
    db: &retainpdf_data::db::Db,
    job: &JobSnapshot,
    data_root: &std::path::Path,
    ocr_ambiguity: Option<OcrAmbiguityView>,
) -> JobDiagnosticsView {
    let failure = resolved_failure(job);
    let resume_plan = build_resume_plan_view(job, data_root);
    let render_diagnostics = load_render_diagnostics(job, data_root);
    let translation_request_recovery =
        load_translation_request_recovery_with_db(db, job, data_root);
    match failure {
        Some(failure) => JobDiagnosticsView {
            failure_code: Some(
                if ocr_ambiguity.is_some() {
                    "ocr_request_ambiguous"
                } else {
                    failure.failure_code_value()
                }
                .to_string(),
            ),
            failed_stage: Some(failure.failed_stage_value().to_string()),
            failed_substage: failure.provider_stage.clone(),
            summary: failure.summary.clone(),
            detail: failure
                .root_cause
                .clone()
                .or_else(|| failure.raw_excerpt.clone())
                .or_else(|| failure.raw_error_excerpt.clone())
                .or_else(|| failure.last_log_line.clone()),
            suggestion: failure.suggestion.clone(),
            retryable: failure.retryable,
            resume_available: resume_plan.can_resume,
            render_diagnostics,
            translation_request_recovery,
            ocr_ambiguity,
            upstream: failure.upstream.clone(),
        },
        None => JobDiagnosticsView {
            failure_code: ocr_ambiguity
                .as_ref()
                .map(|_| "ocr_request_ambiguous".to_string()),
            failed_stage: job.stage.clone(),
            failed_substage: None,
            summary: if matches!(job.status, JobStatusKind::Failed) {
                job.error
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| "任务失败，但暂未识别出明确原因".to_string())
            } else {
                "任务当前没有失败诊断".to_string()
            },
            detail: job.error.clone(),
            suggestion: None,
            retryable: false,
            resume_available: resume_plan.can_resume,
            render_diagnostics,
            translation_request_recovery,
            ocr_ambiguity,
            upstream: None,
        },
    }
}

fn load_render_diagnostics(
    job: &JobSnapshot,
    data_root: &std::path::Path,
) -> Option<serde_json::Value> {
    let path = resolve_pipeline_summary(job, data_root)?;
    let data = std::fs::read_to_string(path).ok()?;
    let summary: serde_json::Value = serde_json::from_str(&data).ok()?;
    let diagnostics = summary.get("render_diagnostics")?;
    if diagnostics.is_null() {
        return None;
    }
    Some(diagnostics.clone())
}

fn resolved_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    job.failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields))
}
