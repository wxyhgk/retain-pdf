mod contracts;
mod detail;
mod helpers;
mod listing;
pub(crate) mod live_stage;
mod security;
pub(crate) mod summary_loaders;
mod views;

use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::models::JobSnapshot;

use super::query::{ensure_supported_job_layout, load_job_or_404};

pub use views::{
    build_job_artifact_links_view, build_job_artifact_manifest_view, build_job_detail_view,
    build_job_events_view, build_job_list_view,
};

pub fn load_supported_job(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub fn load_ocr_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    Ok(job)
}

pub fn load_ocr_job_with_supported_layout(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_ocr_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}
