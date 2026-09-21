use crate::error::AppError;
use crate::models::domain::{JobSnapshot, ResolvedJobSpec, UploadRecord, WorkflowKind};
use crate::models::request::CreateJobInput;
use crate::ocr_provider::uses_paddle_official_cli;
use crate::services::glossaries::resolve_task_glossary_request;
use crate::services::job_validation::{
    validate_mineru_upload_limits, validate_ocr_credential_reference,
    validate_ocr_provider_request, validate_provider_credentials, validate_render_options,
    validate_translation_modes,
    validate_translation_credential_reference, validate_translation_credentials,
};
use crate::services::ocr_artifact_reuse::validate_ocr_artifact_reuse;

use crate::services::jobs::deps::SnapshotBuildDeps;

fn load_upload_or_404(db: &crate::db::Db, upload_id: &str) -> Result<UploadRecord, AppError> {
    db.get_upload(upload_id)
        .map_err(|_| AppError::not_found(format!("upload not found: {upload_id}")))
}

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
}

pub(super) fn prepare_full_pipeline_input(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<PreparedTranslationUpload, AppError> {
    let input = resolve_task_glossary_request(ctx.db, input)?;
    validate_render_options(&input)?;
    validate_translation_modes(&input)?;
    validate_translation_credential_reference(&input, ctx.config.data_root)?;
    if !input.source.artifact_job_id.trim().is_empty() {
        validate_translation_credentials(&input)?;
        let page_count = artifact_document_page_count(ctx, &input.source.artifact_job_id)?;
        let selection =
            validate_ocr_artifact_reuse(ctx.db, ctx.config.data_root, &input, None, page_count)?;
        let mut spec = ResolvedJobSpec::from_input(input);
        spec.translation.start_page = selection.start_page;
        spec.translation.end_page = selection.end_page;
        return Ok(PreparedTranslationUpload { spec });
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
    validate_translation_modes(&input)?;
    validate_translation_credential_reference(&input, ctx.config.data_root)?;
    if input.source.artifact_job_id.trim().is_empty() {
        let _ = require_translation_upload(ctx, &input)?;
    } else {
        validate_translation_credentials(&input)?;
        let page_count = artifact_document_page_count(ctx, &input.source.artifact_job_id)?;
        let selection =
            validate_ocr_artifact_reuse(ctx.db, ctx.config.data_root, &input, None, page_count)?;
        let mut spec = ResolvedJobSpec::from_input(input);
        spec.workflow = WorkflowKind::Translate;
        spec.translation.start_page = selection.start_page;
        spec.translation.end_page = selection.end_page;
        return Ok(PreparedTranslateOnlyInput { spec });
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
    let source_job = ctx.db.get_job(&input.source.artifact_job_id).map_err(|_| {
        AppError::not_found(format!(
            "artifact job not found: {}",
            input.source.artifact_job_id
        ))
    })?;
    reject_paddle_cli_artifact(&source_job)?;
    validate_render_options(input)?;
    validate_translation_modes(input)?;
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
    validate_ocr_credential_reference(input, ctx.config.data_root)?;
    // Direct file upload (multipart file) takes precedence
    if let Some(upload) = upload {
        let mut resolved = ResolvedJobSpec::from_input(input.clone());
        resolved.workflow = WorkflowKind::Ocr;
        resolved.source.upload_id = upload.upload_id.clone();
        validate_mineru_upload_limits(input, upload, ctx.config.provider_limits)?;
        return Ok(PreparedOcrInput { spec: resolved });
    }
    // Reuse existing upload via upload_id (frontend after POST /uploads)
    if !input.source.upload_id.trim().is_empty() {
        let existing = load_upload_or_404(ctx.db, input.source.upload_id.trim())?;
        let mut resolved = ResolvedJobSpec::from_input(input.clone());
        resolved.workflow = WorkflowKind::Ocr;
        resolved.source.upload_id = existing.upload_id.clone();
        validate_mineru_upload_limits(input, &existing, ctx.config.provider_limits)?;
        return Ok(PreparedOcrInput { spec: resolved });
    }
    if !input.source.source_url.trim().is_empty() {
        let mut resolved = ResolvedJobSpec::from_input(input.clone());
        resolved.workflow = WorkflowKind::Ocr;
        return Ok(PreparedOcrInput { spec: resolved });
    }
    eprintln!(
        "[prepare_ocr_input] no file/upload_id/source_url: upload={:?} upload_id='{}' source_url='{}' workflow={:?}",
        upload.map(|u| &u.upload_id),
        input.source.upload_id,
        input.source.source_url,
        input.workflow
    );
    return Err(AppError::bad_request(
        "either file, upload_id, or source_url is required",
    ));
}

fn require_translation_upload(
    ctx: &SnapshotBuildDeps<'_>,
    input: &CreateJobInput,
) -> Result<UploadRecord, AppError> {
    if input.source.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(input)?;
    validate_ocr_credential_reference(input, ctx.config.data_root)?;
    validate_render_options(input)?;
    validate_translation_modes(input)?;
    let upload = load_upload_or_404(ctx.db, &input.source.upload_id)?;
    validate_mineru_upload_limits(input, &upload, ctx.config.provider_limits)?;
    Ok(upload)
}

fn artifact_document_page_count(
    ctx: &SnapshotBuildDeps<'_>,
    artifact_job_id: &str,
) -> Result<Option<u32>, AppError> {
    Ok(ctx
        .db
        .get_document_by_job_id(artifact_job_id)?
        .map(|document| document.page_count))
}

fn reject_paddle_cli_artifact(source_job: &JobSnapshot) -> Result<(), AppError> {
    if uses_paddle_official_cli(&source_job.request_payload.ocr) {
        return Err(AppError::bad_request(format!(
            "artifact job {} was produced by PaddleOCR official_cli and cannot be used for translation or render because it does not provide the required bbox/prunedResult contract",
            source_job.job_id
        )));
    }
    Ok(())
}
