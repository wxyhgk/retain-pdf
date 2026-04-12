use crate::error::AppError;
use crate::models::WorkflowKind;
use crate::models::{CreateJobInput, JobSnapshot, ResolvedJobSpec, UploadRecord};
use crate::services::glossaries::resolve_task_glossary_request;
use crate::services::job_factory::{
    build_and_start_job, require_upload_path, JobCommandKind, JobInit,
};
use crate::services::jobs::{
    validate_mineru_upload_limits, validate_ocr_provider_request, validate_provider_credentials,
};
use crate::AppState;

pub fn create_translation_job(
    state: &AppState,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    match input.workflow {
        WorkflowKind::Ocr => {
            return Err(AppError::bad_request(
                "use /api/v1/ocr/jobs for workflow=ocr",
            ));
        }
        WorkflowKind::Render => return create_render_job(state, input),
        WorkflowKind::Translate => return create_translate_only_job(state, input),
        WorkflowKind::Mineru => {}
    }
    create_full_pipeline_job(state, input)
}

fn create_full_pipeline_job(
    state: &AppState,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let input = resolve_task_glossary_request(state, input)?;
    if input.source.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(&input)?;
    let upload = state.db.get_upload(&input.source.upload_id).map_err(|_| {
        AppError::not_found(format!("upload not found: {}", input.source.upload_id))
    })?;
    validate_mineru_upload_limits(&input, &upload)?;
    let spec = ResolvedJobSpec::from_input(input);
    let upload_path = require_upload_path(&upload)?;
    build_and_start_job(
        state,
        spec,
        JobCommandKind::TranslationFromUpload { upload_path },
        JobInit::default(),
    )
}

fn create_translate_only_job(
    state: &AppState,
    input: &CreateJobInput,
) -> Result<JobSnapshot, AppError> {
    let input = resolve_task_glossary_request(state, input)?;
    if input.source.upload_id.trim().is_empty() {
        return Err(AppError::bad_request("upload_id is required"));
    }
    validate_provider_credentials(&input)?;
    let upload = state.db.get_upload(&input.source.upload_id).map_err(|_| {
        AppError::not_found(format!("upload not found: {}", input.source.upload_id))
    })?;
    validate_mineru_upload_limits(&input, &upload)?;
    let mut spec = ResolvedJobSpec::from_input(input);
    spec.workflow = WorkflowKind::Translate;
    build_and_start_job(
        state,
        spec,
        JobCommandKind::Deferred {
            label: "translate-workflow-pending-ocr",
        },
        JobInit::translate_default(),
    )
}

fn create_render_job(state: &AppState, input: &CreateJobInput) -> Result<JobSnapshot, AppError> {
    if input.source.artifact_job_id.trim().is_empty() {
        return Err(AppError::bad_request(
            "source.artifact_job_id is required for render workflow",
        ));
    }
    if state.db.get_job(&input.source.artifact_job_id).is_err() {
        return Err(AppError::not_found(format!(
            "artifact job not found: {}",
            input.source.artifact_job_id
        )));
    }
    let mut spec = ResolvedJobSpec::from_input(input.clone());
    spec.workflow = WorkflowKind::Render;
    build_and_start_job(
        state,
        spec,
        JobCommandKind::Deferred {
            label: "render-workflow-pending-artifacts",
        },
        JobInit::render_default(),
    )
}

pub fn create_ocr_job(
    state: &AppState,
    input: &CreateJobInput,
    upload: Option<&UploadRecord>,
) -> Result<JobSnapshot, AppError> {
    validate_ocr_provider_request(input)?;
    if upload.is_none() && input.source.source_url.trim().is_empty() {
        return Err(AppError::bad_request(
            "either file or source_url is required",
        ));
    }

    let mut resolved = ResolvedJobSpec::from_input(input.clone());
    resolved.workflow = crate::models::WorkflowKind::Ocr;
    if let Some(upload) = upload {
        resolved.source.upload_id = upload.upload_id.clone();
        validate_mineru_upload_limits(input, upload)?;
    }
    let upload_path = upload.map(require_upload_path).transpose()?;
    build_and_start_job(
        state,
        resolved,
        JobCommandKind::Ocr { upload_path },
        JobInit::ocr_default(),
    )
}
