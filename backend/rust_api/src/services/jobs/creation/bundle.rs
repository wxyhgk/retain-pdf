use std::path::PathBuf;

use crate::error::AppError;
use crate::models::CreateJobInput;
use crate::services::artifacts::build_bundle_for_job;
use crate::services::job_launcher::start_job_execution;

use super::super::{validate_mineru_upload_limits, wait_for_terminal_job};
use super::context::BundleBuildDeps;
use super::job_builders::build_translation_job_snapshot;
use super::upload::{store_pdf_upload, UploadedPdfInput};

#[derive(Debug)]
pub struct BundleArtifact {
    pub job_id: String,
    pub zip_path: PathBuf,
}

pub(crate) async fn build_translation_bundle_artifact(
    deps: &BundleBuildDeps<'_>,
    mut request: CreateJobInput,
    upload: UploadedPdfInput,
) -> Result<BundleArtifact, AppError> {
    build_translation_bundle_artifact_with_resources(deps, &mut request, upload).await
}

async fn build_translation_bundle_artifact_with_resources(
    ctx: &BundleBuildDeps<'_>,
    request: &mut CreateJobInput,
    upload: UploadedPdfInput,
) -> Result<BundleArtifact, AppError> {
    let stored = store_pdf_upload(
        ctx.submit.uploads.db,
        ctx.submit.uploads.uploads_dir,
        ctx.submit.uploads.upload_max_bytes,
        ctx.submit.uploads.upload_max_pages,
        ctx.submit.uploads.python_bin,
        upload,
    )
    .await?;
    request.source.upload_id = stored.upload_id.clone();
    validate_mineru_upload_limits(request, &stored)?;
    let job = build_translation_job_snapshot(&ctx.submit.snapshot, request)?;
    let job = start_job_execution(&ctx.submit.launcher, job)?;
    let finished_job = wait_for_terminal_job(
        ctx.submit.snapshot.db,
        &job.job_id,
        request.ocr.poll_timeout,
    )
    .await?;

    let _guard = ctx.downloads_lock.lock().await;
    let zip_path = build_bundle_for_job(
        ctx.submit.snapshot.db,
        &ctx.submit.snapshot.config.data_root,
        &ctx.submit.snapshot.config.downloads_dir,
        &finished_job,
    )?;
    Ok(BundleArtifact {
        job_id: finished_job.job_id.clone(),
        zip_path,
    })
}
