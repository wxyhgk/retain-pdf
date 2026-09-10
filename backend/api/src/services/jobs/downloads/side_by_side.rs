use crate::error::AppError;
use crate::services::derived_artifacts;
use crate::storage_paths::{resolve_output_pdf, resolve_source_pdf};

use super::artifact_deps::derived_artifact_deps;
use super::pdf::linearized_pdf_or_original;
use super::FileDownload;
use super::QueryJobsDeps;
use crate::services::jobs::query::load_supported_job;

pub(crate) fn side_by_side_pdf_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let source_pdf = resolve_source_pdf(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("source pdf not ready: {}", job.job_id)))?;
    let translated_pdf = resolve_output_pdf(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("translated pdf not ready: {}", job.job_id)))?;
    if !source_pdf.exists() || !source_pdf.is_file() {
        return Err(AppError::not_found(format!(
            "source pdf not found: {}",
            job.job_id
        )));
    }
    if !translated_pdf.exists() || !translated_pdf.is_file() {
        return Err(AppError::not_found(format!(
            "translated pdf not found: {}",
            job.job_id
        )));
    }
    let output_pdf = derived_artifacts::side_by_side::ensure_side_by_side_pdf(
        derived_artifact_deps(deps),
        deps.data_root,
        &job,
        &source_pdf,
        &translated_pdf,
    )?;
    let path = linearized_pdf_or_original(deps, &job, &output_pdf, "side-by-side")?;
    Ok(FileDownload::new(
        path,
        "application/pdf",
        Some(format!("{}-side-by-side.pdf", job.job_id)),
    ))
}
