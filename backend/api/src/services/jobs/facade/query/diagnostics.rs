use crate::error::AppError;
use crate::job_failure::classify_job_failure;
use crate::models::api::{JobDiagnosticsView, JobResumePlanView, OcrAmbiguityView};
use crate::models::domain::{JobFailureInfo, JobSnapshot, JobStatusKind};
use crate::services::jobs::stage_plan::resume_plan;
use crate::services::jobs::translation_request_recovery::load_translation_request_recovery_with_db;
use crate::storage_paths::resolve_pipeline_summary;

use super::super::super::query::load_supported_job;
use super::super::command::ocr_ambiguity::build_ocr_ambiguity_view;
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn job_diagnostics_view(&self, job_id: &str) -> Result<JobDiagnosticsView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        let ocr_ambiguity = if matches!(job.status, JobStatusKind::Failed) {
            self.query
                .db
                .latest_pipeline_dispatch(job_id, "ocr-submit")?
                .as_ref()
                .and_then(build_ocr_ambiguity_view)
        } else {
            None
        };
        Ok(build_job_diagnostics_view(
            self.query.db,
            &job,
            self.query.data_root,
            ocr_ambiguity,
        ))
    }

    pub fn resume_plan_view(&self, job_id: &str) -> Result<JobResumePlanView, AppError> {
        let job = load_supported_job(self.query.db, self.query.data_root, job_id)?;
        Ok(build_resume_plan_view(&job, self.query.data_root))
    }
}

fn build_job_diagnostics_view(
    db: &crate::db::Db,
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

fn build_resume_plan_view(job: &JobSnapshot, data_root: &std::path::Path) -> JobResumePlanView {
    let plan = resume_plan(job, data_root);
    JobResumePlanView {
        can_resume: plan.can_resume,
        job_id: job.job_id.clone(),
        from_stage: plan.from_stage,
        resume_workflow: plan.resume_workflow,
        reuses_artifacts: plan.reuses_artifacts,
        reruns_stages: plan.reruns_stages,
        reason: plan.reason,
    }
}

fn resolved_failure(job: &JobSnapshot) -> Option<JobFailureInfo> {
    job.failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields))
}
