use std::path::PathBuf;

use crate::error::AppError;
use crate::models::{CreateJobInput, ResolvedJobSpec, UploadRecord, WorkflowKind};
use crate::services::glossaries::resolve_task_glossary_request;
use crate::services::job_snapshot_factory::require_upload_path;
use crate::services::job_validation::{
    validate_mineru_upload_limits, validate_ocr_provider_request, validate_provider_credentials,
    validate_render_options, validate_translation_credentials,
};

use super::context::SnapshotBuildDeps;
use super::upload::load_upload_or_404;

pub(super) struct PreparedTranslationUpload {
    pub(super) spec: ResolvedJobSpec,
}

pub(super) struct PreparedTranslateOnlyInput {
    pub(super) spec: ResolvedJobSpec,
}

pub(super) struct PreparedRenderInput {
    pub(super) spec: ResolvedJobSpec,
}

pub(super) struct PreparedOcrInput {
    pub(super) spec: ResolvedJobSpec,
    pub(super) upload_path: Option<PathBuf>,
}

pub(super) fn prepare_full_pipeline_input(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<PreparedTranslationUpload, AppError> {
    let input = resolve_task_glossary_request(ctx.db, input)?;
    validate_render_options(&input)?;
    if !input.source.artifact_job_id.trim().is_empty() {
        validate_translation_credentials(&input)?;
        if ctx.db.get_job(&input.source.artifact_job_id).is_err() {
            return Err(AppError::not_found(format!(
                "artifact job not found: {}",
                input.source.artifact_job_id
            )));
        }
        return Ok(PreparedTranslationUpload {
            spec: ResolvedJobSpec::from_input(input),
        });
    }
    let _ = require_translation_upload(ctx, &input)?;
    Ok(PreparedTranslationUpload {
        spec: ResolvedJobSpec::from_input(input),
    })
}

pub(super) fn prepare_translate_only_input(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<PreparedTranslateOnlyInput, AppError> {
    let input = resolve_task_glossary_request(ctx.db, input)?;
    validate_render_options(&input)?;
    if input.source.artifact_job_id.trim().is_empty() {
        let _ = require_translation_upload(ctx, &input)?;
    } else if ctx.db.get_job(&input.source.artifact_job_id).is_err() {
        validate_translation_credentials(&input)?;
        return Err(AppError::not_found(format!(
            "artifact job not found: {}",
            input.source.artifact_job_id
        )));
    } else {
        validate_translation_credentials(&input)?;
    }
    let mut spec = ResolvedJobSpec::from_input(input);
    spec.workflow = WorkflowKind::Translate;
    Ok(PreparedTranslateOnlyInput { spec })
}

pub(super) fn prepare_render_input(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<PreparedRenderInput, AppError> {
    if input.source.artifact_job_id.trim().is_empty() {
        return Err(AppError::bad_request(
            "source.artifact_job_id is required for render workflow",
        ));
    }
    if ctx.db.get_job(&input.source.artifact_job_id).is_err() {
        return Err(AppError::not_found(format!(
            "artifact job not found: {}",
            input.source.artifact_job_id
        )));
    }
    validate_render_options(input)?;
    let mut spec = ResolvedJobSpec::from_input(input.clone());
    spec.workflow = WorkflowKind::Render;
    Ok(PreparedRenderInput { spec })
}

pub(super) fn prepare_ocr_input(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
    upload: Option<&UploadRecord>,
) -> Result<PreparedOcrInput, AppError> {
    validate_ocr_provider_request(input)?;
    if upload.is_none() && input.source.source_url.trim().is_empty() {
        return Err(AppError::bad_request(
            "either file or source_url is required",
        ));
    }

    let mut resolved = ResolvedJobSpec::from_input(input.clone());
    resolved.workflow = WorkflowKind::Ocr;
    if let Some(upload) = upload {
        resolved.source.upload_id = upload.upload_id.clone();
        validate_mineru_upload_limits(input, upload, ctx.config.provider_limits)?;
    }
    let upload_path = upload.map(require_upload_path).transpose()?;
    Ok(PreparedOcrInput {
        spec: resolved,
        upload_path,
    })
}

fn require_translation_upload(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<UploadRecord, AppError> {
    if input.source.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(input)?;
    validate_render_options(input)?;
    let upload = load_upload_or_404(ctx.db, &input.source.upload_id)?;
    validate_mineru_upload_limits(input, &upload, ctx.config.provider_limits)?;
    Ok(upload)
}
