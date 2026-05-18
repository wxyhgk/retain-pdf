use crate::error::AppError;
use crate::models::{CreateJobInput, JobSnapshot};
use crate::services::job_launcher::start_job_execution;

use super::super::validate_mineru_upload_limits;
use super::context::BundleBuildDeps;
use super::job_builders::build_translation_job_snapshot;
use super::upload::{store_pdf_upload, UploadedPdfInput};

pub(crate) async fn create_translation_bundle_job(
    deps: &BundleBuildDeps<'_>,
    mut request: CreateJobInput,
    upload: UploadedPdfInput,
) -> Result<JobSnapshot, AppError> {
    create_translation_bundle_job_with_resources(deps, &mut request, upload).await
}

async fn create_translation_bundle_job_with_resources(
    ctx: &BundleBuildDeps<'_>,
    request: &mut CreateJobInput,
    upload: UploadedPdfInput,
) -> Result<JobSnapshot, AppError> {
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
    validate_mineru_upload_limits(request, &stored, ctx.submit.snapshot.config.provider_limits)?;
    let job = build_translation_job_snapshot(&ctx.submit.snapshot, request)?;
    start_job_execution(&ctx.submit.launcher, job)
}
