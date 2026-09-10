use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};

use crate::db::Db;
use crate::job_runner::job_artifacts_mut;
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::OcrProviderKind;

use super::artifacts::{download_source_pdf, ensure_source_pdf_from_bundle};
use super::page_subset::prepare_uploaded_source_pdf;

pub(super) fn resolve_local_upload_path(db: &Db, job: &JobRuntimeState) -> Result<Option<PathBuf>> {
    let upload_id = job.request_payload.source.upload_id.trim();
    if upload_id.is_empty() {
        return Ok(None);
    }
    let upload = db.get_upload(upload_id)?;
    let upload_path = PathBuf::from(&upload.stored_path);
    if !upload_path.exists() {
        return Err(anyhow!("uploaded file missing: {}", upload_path.display()));
    }
    Ok(Some(upload_path))
}

pub(super) fn prepare_local_upload_source(
    db: &Db,
    job: &mut JobRuntimeState,
    source_dir: &Path,
) -> Result<Option<PathBuf>> {
    let Some(upload_path) = resolve_local_upload_path(db, job)? else {
        return Ok(None);
    };
    let prepared_source = prepare_uploaded_source_pdf(
        &upload_path,
        source_dir,
        &job.request_payload.ocr.page_ranges,
    )?;
    job_artifacts_mut(job).ocr_page_numbers = prepared_source.selected_pages.clone();
    if prepared_source.is_subset() {
        job.append_log(&format!(
            "prepared subset source pdf: {} pages {:?}/{}",
            prepared_source.path.display(),
            prepared_source.selected_pages,
            prepared_source.total_pages
        ));
        job.request_payload.ocr.page_ranges = prepared_source.provider_page_ranges().to_string();
        job.append_log(
            "cleared provider page_ranges because uploaded source pdf was already subsetted",
        );
    }
    Ok(Some(prepared_source.path))
}

pub(super) async fn recover_remote_source_pdf(
    provider_kind: &OcrProviderKind,
    job: &JobRuntimeState,
    source_dir: &Path,
    provider_raw_dir: &Path,
) -> Result<PathBuf> {
    match provider_kind {
        OcrProviderKind::Mineru => ensure_source_pdf_from_bundle(provider_raw_dir, source_dir),
        OcrProviderKind::Paddle => {
            download_source_pdf(&job.request_payload.source.source_url, source_dir).await
        }
        OcrProviderKind::Local => Err(anyhow!(
            "local OCR provider requires a local source PDF handled by provider stage script"
        )),
        OcrProviderKind::Unknown => Err(anyhow!("unsupported OCR provider")),
    }
}
