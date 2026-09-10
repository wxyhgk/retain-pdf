//! OCR-from-library: reuse a document's stored upload without exposing upload_id.

use crate::error::AppError;
use crate::models::api::JobSubmissionView;
use crate::models::domain::WorkflowKind;
use crate::models::request::CreateJobInput;
use crate::services::jobs::JobsFacade;

use super::documents::require_document_upload;
use super::LibraryDeps;

/// Bind an OCR request to the document's stored upload and create an OCR-only job.
pub async fn ocr_document(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    mut request: CreateJobInput,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    let (_document, upload) = require_document_upload(deps, document_id)?;

    if !request.source.upload_id.trim().is_empty()
        && request.source.upload_id.trim() != upload.upload_id
    {
        return Err(AppError::bad_request(
            "source.upload_id does not match this document's stored upload",
        ));
    }

    request.workflow = WorkflowKind::Ocr;
    let upload_id = upload.upload_id;
    request.source.upload_id = upload_id.clone();
    request.source.source_url.clear();
    request.source.artifact_job_id.clear();

    let submission = jobs.create_ocr_submission(base_url, &request, None).await?;
    let linked_document_id = deps
        .db
        .link_job_to_document(&submission.job_id, &upload_id)?
        .ok_or_else(|| AppError::internal("failed to bind OCR job to document"))?;
    if linked_document_id != document_id {
        return Err(AppError::internal(
            "OCR job was bound to an unexpected document",
        ));
    }
    Ok(submission)
}
