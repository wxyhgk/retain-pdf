use crate::error::AppError;
use crate::models::domain::JobSnapshot;
use crate::models::request::CreateJobInput;
use crate::services::job_launcher::start_job_execution;

use super::super::validate_mineru_upload_limits;
use crate::services::jobs::deps::BundleBuildDeps;
use super::job_builders::build_translation_job_snapshot;
use super::ocr_credentials::{acquire_job_credential_usage_lock, secure_job_credentials};
use crate::services::uploads::UploadedPdfInput;

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
    let stored = ctx.submit.uploads.store(upload).await?;
    request.source.upload_id = stored.upload_id.clone();
    validate_mineru_upload_limits(request, &stored, ctx.submit.snapshot.config.provider_limits)?;
    let job = build_translation_job_snapshot(&ctx.submit.snapshot, request)?;
    let job = secure_job_credentials(&ctx.submit, job)?;
    let _credential_guard = acquire_job_credential_usage_lock(&ctx.submit, &job)?;
    start_job_execution(&ctx.submit.launcher, job)
}
