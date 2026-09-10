use crate::error::AppError;
use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::services::artifacts::{
    artifact_is_direct_downloadable, build_bundle_for_job, build_markdown_bundle_for_job,
    resolve_registry_artifact,
};
use crate::storage_paths::{
    ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP, ARTIFACT_KEY_SOURCE_PDF, ARTIFACT_KEY_TRANSLATED_PDF,
};

use super::super::query::load_supported_job;
use super::pdf::linearized_pdf_or_original;
use super::{FileDownload, QueryJobsDeps};

pub(crate) fn bundle_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    if !matches!(job.status, JobStatusKind::Succeeded) {
        return Err(AppError::conflict("job is not finished successfully"));
    }
    let zip_path = build_bundle_for_job(deps.db, deps.data_root, deps.downloads_dir, &job)?;
    Ok(
        FileDownload::new(zip_path, "application/zip", Some(format!("{job_id}.zip")))
            .with_job_id_header(job_id),
    )
}

pub(crate) fn registered_artifact_download(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    artifact_key: &str,
    include_job_dir: bool,
) -> Result<FileDownload, AppError> {
    if artifact_key == ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP {
        let (item, path) =
            build_markdown_bundle_for_job(deps.db, deps.data_root, job, include_job_dir)?;
        return Ok(FileDownload::new(path, item.content_type, item.file_name));
    }
    let Some((item, path)) = resolve_registry_artifact(deps.db, deps.data_root, job, artifact_key)?
    else {
        return Err(AppError::not_found(format!(
            "artifact not found: {}/{artifact_key}",
            job.job_id
        )));
    };
    if !artifact_is_direct_downloadable(&item) {
        return Err(AppError::conflict(format!(
            "artifact is a directory and cannot be streamed directly: {artifact_key}"
        )));
    }
    if !item.ready || !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "artifact not ready: {}/{artifact_key}",
            job.job_id
        )));
    }
    let path = if item.content_type == "application/pdf"
        && matches!(
            artifact_key,
            ARTIFACT_KEY_SOURCE_PDF | ARTIFACT_KEY_TRANSLATED_PDF
        ) {
        linearized_pdf_or_original(deps, job, &path, artifact_key)?
    } else {
        path
    };
    Ok(FileDownload::new(path, item.content_type, item.file_name))
}
