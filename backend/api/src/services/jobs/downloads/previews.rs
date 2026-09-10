use std::path::PathBuf;

use crate::error::AppError;
use crate::models::api::PagePreviewQuery;
use crate::services::derived_artifacts;
use crate::storage_paths::{resolve_output_pdf, resolve_source_pdf};

use super::artifact_deps::derived_artifact_deps;
use super::paths::job_artifacts_dir;
use super::{FileDownload, QueryJobsDeps};
use crate::services::jobs::query::load_supported_job;

#[derive(Clone, Copy)]
pub(super) enum PagePreviewKind {
    Source,
    Translated,
}

impl PagePreviewKind {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Translated => "translated",
        }
    }
}

pub(super) fn preview_kind(kind: &str) -> Result<PagePreviewKind, AppError> {
    match kind.trim().to_ascii_lowercase().as_str() {
        "source" => Ok(PagePreviewKind::Source),
        "translated" => Ok(PagePreviewKind::Translated),
        _ => Err(AppError::bad_request(
            "preview kind must be source or translated",
        )),
    }
}

pub(crate) fn page_preview_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    page: u32,
    query: &PagePreviewQuery,
) -> Result<FileDownload, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let source_pdf = match preview_kind(&query.kind)? {
        PagePreviewKind::Source => resolve_source_pdf(&job, deps.data_root)
            .ok_or_else(|| AppError::not_found(format!("source pdf not ready: {}", job.job_id)))?,
        PagePreviewKind::Translated => {
            resolve_output_pdf(&job, deps.data_root).ok_or_else(|| {
                AppError::not_found(format!("translated pdf not ready: {}", job.job_id))
            })?
        }
    };
    let page_index = page
        .checked_sub(1)
        .ok_or_else(|| AppError::bad_request("page must be 1-based"))?;
    let width_px = query.width.unwrap_or(1200).clamp(240, 2400);
    let dpi = query.dpi.unwrap_or(0).min(300);
    let output_dir = job_artifacts_dir(deps, &job)?;
    let output_path = output_dir.join(format!(
        "preview-{}-p{:04}-w{}-d{}.jpg",
        preview_kind(&query.kind)?.as_str(),
        page,
        width_px,
        dpi
    ));
    let path = derived_artifacts::preview::ensure_page_preview(
        derived_artifact_deps(deps),
        &output_path,
        &source_pdf,
        page_index,
        width_px,
        dpi,
    )?;
    Ok(FileDownload::new(path, "image/jpeg", None))
}

pub(crate) fn cover_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
) -> Result<FileDownload, AppError> {
    let path = book_image_download_path(
        deps,
        job_id,
        derived_artifacts::preview::BookImageKind::Cover,
    )?;
    Ok(FileDownload::new(path, "image/jpeg", None))
}

pub(crate) fn thumbnail_download(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
) -> Result<FileDownload, AppError> {
    let path = book_image_download_path(
        deps,
        job_id,
        derived_artifacts::preview::BookImageKind::Thumbnail,
    )?;
    Ok(FileDownload::new(path, "image/jpeg", None))
}

fn book_image_download_path(
    deps: &QueryJobsDeps<'_>,
    job_id: &str,
    kind: derived_artifacts::preview::BookImageKind,
) -> Result<PathBuf, AppError> {
    let job = load_supported_job(deps.db, deps.data_root, job_id)?;
    let source_pdf = resolve_source_pdf(&job, deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("source pdf not ready: {}", job.job_id)))?;
    derived_artifacts::preview::ensure_book_image(
        derived_artifact_deps(deps),
        deps.data_root,
        &job,
        &source_pdf,
        kind,
    )
}
