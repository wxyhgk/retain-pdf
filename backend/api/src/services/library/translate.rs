//! Translate-from-library: reuse a document's stored upload and submit via JobsFacade.

use crate::error::AppError;
use crate::models::api::JobSubmissionView;
use crate::models::domain::WorkflowKind;
use crate::models::request::CreateJobInput;
use crate::services::jobs::JobsFacade;
use crate::services::ocr_artifact_reuse::validate_ocr_artifact_reuse;

use super::documents::require_document_upload;
use super::LibraryDeps;

/// Bind `request` to the document's stored upload, normalize workflow, and create a job.
pub fn translate_document(
    deps: &LibraryDeps<'_>,
    jobs: &JobsFacade<'_>,
    document_id: &str,
    mut request: CreateJobInput,
    base_url: &str,
) -> Result<JobSubmissionView, AppError> {
    let (document, upload) = require_document_upload(deps, document_id)?;

    if !request.source.upload_id.trim().is_empty()
        && request.source.upload_id.trim() != upload.upload_id
    {
        return Err(AppError::bad_request(
            "source.upload_id does not match this document's stored upload",
        ));
    }
    let upload_id = upload.upload_id;
    request.source.upload_id = upload_id.clone();
    request.source.source_url.clear();

    if matches!(request.workflow, WorkflowKind::Ocr | WorkflowKind::Render) {
        return Err(AppError::bad_request(
            "document translate supports workflow=book or translate; default is book",
        ));
    }
    let reuses_ocr = !request.source.artifact_job_id.trim().is_empty();
    if reuses_ocr {
        validate_ocr_artifact_reuse(
            deps.db,
            deps.data_root,
            &request,
            Some(document_id),
            Some(document.page_count),
        )?;
    }

    if !matches!(request.workflow, WorkflowKind::Translate) {
        request.workflow = WorkflowKind::Book;
    } else if reuses_ocr {
        request.runtime.render_after_translation = true;
    }

    let submission = jobs.create_submission(base_url, &request)?;
    let linked_document_id = deps
        .db
        .link_job_to_document(&submission.job_id, &upload_id)?
        .ok_or_else(|| AppError::internal("failed to bind translation job to document"))?;
    if linked_document_id != document_id {
        return Err(AppError::internal(
            "translation job was bound to an unexpected document",
        ));
    }
    Ok(submission)
}
