use crate::error::AppError;
use crate::models::api::RetryStageKind;
use crate::models::domain::{CreateJobInput, JobSnapshot, WorkflowKind};
use crate::models::request::JobSourceInput;

pub(super) fn build_retry_request(
    source_job: &JobSnapshot,
    stage: &RetryStageKind,
) -> Result<CreateJobInput, AppError> {
    let workflow = match stage {
        RetryStageKind::Ocr => WorkflowKind::Book,
        RetryStageKind::Translation => WorkflowKind::Book,
        RetryStageKind::Render => WorkflowKind::Render,
    };
    let mut request = CreateJobInput {
        workflow,
        source: JobSourceInput::default(),
        ocr: source_job.request_payload.ocr.clone(),
        translation: source_job.request_payload.translation.clone(),
        render: source_job.request_payload.render.clone(),
        runtime: source_job.request_payload.runtime.clone(),
    };
    match stage {
        RetryStageKind::Ocr => {
            request.source.upload_id = source_job.request_payload.source.upload_id.clone();
            request.source.source_url = source_job.request_payload.source.source_url.clone();
            require_request_source(&request)?;
        }
        RetryStageKind::Translation => {
            let artifacts = source_job
                .artifacts
                .as_ref()
                .ok_or_else(|| AppError::bad_request("source job has no reusable artifacts"))?;
            require_artifact(
                artifacts.normalized_document_json.as_ref(),
                "normalized_document_json",
            )?;
            require_artifact(artifacts.source_pdf.as_ref(), "source_pdf")?;
            request.source.artifact_job_id = source_job.job_id.clone();
        }
        RetryStageKind::Render => {
            let artifacts = source_job
                .artifacts
                .as_ref()
                .ok_or_else(|| AppError::bad_request("source job has no reusable artifacts"))?;
            require_artifact(artifacts.translations_dir.as_ref(), "translations_dir")?;
            require_artifact(artifacts.source_pdf.as_ref(), "source_pdf")?;
            request.source.artifact_job_id = source_job.job_id.clone();
        }
    }
    request.runtime.job_id.clear();
    Ok(request)
}

fn require_request_source(request: &CreateJobInput) -> Result<(), AppError> {
    if !request.source.upload_id.trim().is_empty() || !request.source.source_url.trim().is_empty() {
        return Ok(());
    }
    Err(AppError::bad_request(
        "OCR retry requires the original upload_id or source_url",
    ))
}

fn require_artifact(value: Option<&String>, name: &str) -> Result<(), AppError> {
    if value.as_ref().is_some_and(|item| !item.trim().is_empty()) {
        return Ok(());
    }
    Err(AppError::bad_request(format!(
        "source job missing required artifact: {name}"
    )))
}
