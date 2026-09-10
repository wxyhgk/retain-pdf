use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::ListJobsQuery;
use crate::models::domain::{JobSnapshot, WorkflowKind};
use crate::storage_paths::{
    job_uses_legacy_output_layout, job_uses_legacy_path_storage, LEGACY_JOB_UNSUPPORTED_MESSAGE,
};

pub(super) fn load_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    db.get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))
}

fn ensure_supported_job_layout(data_root: &Path, job: &JobSnapshot) -> Result<(), AppError> {
    if job_uses_legacy_output_layout(job, data_root) || job_uses_legacy_path_storage(job) {
        return Err(AppError::conflict(LEGACY_JOB_UNSUPPORTED_MESSAGE));
    }
    Ok(())
}

pub(super) fn load_supported_job(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub(super) fn load_ocr_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    if !matches!(job.workflow, WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    Ok(job)
}

pub(super) fn load_ocr_job_with_supported_layout(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_ocr_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub(super) fn list_jobs_filtered(
    db: &Db,
    query: &ListJobsQuery,
) -> Result<Vec<JobSnapshot>, AppError> {
    let jobs = db.list_jobs(
        query.limit,
        query.offset,
        query.status.as_ref(),
        query.workflow.as_ref(),
    )?;
    Ok(jobs
        .into_iter()
        .filter(|job| {
            query
                .provider
                .as_deref()
                .map(|provider| {
                    job.artifacts
                        .as_ref()
                        .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                        .map(|diag| {
                            format!("{:?}", diag.provider).to_ascii_lowercase()
                                == provider.to_ascii_lowercase()
                        })
                        .unwrap_or(false)
                })
                .unwrap_or(true)
        })
        .collect())
}
