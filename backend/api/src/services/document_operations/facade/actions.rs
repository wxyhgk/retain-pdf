use retain_core::models::domain::{now_iso, DocumentOperationStatus};
use retain_data::db::{CommitDocumentCandidateResult, Db};

use crate::config::AppConfig;
use crate::error::AppError;

use super::super::contracts::{
    CancelDocumentOperationInput, CommitDocumentOperationInput, DocumentOperationView,
    DOCUMENT_OPERATION_CANCEL_INPUT_SCHEMA, DOCUMENT_OPERATION_COMMIT_INPUT_SCHEMA,
};
use super::super::DocumentOperationControl;
use super::query::get_document_operation_view;
use super::shared::{
    conflict_error, executor_for, internal_error, require_operation, validate_idempotency_key,
    validate_schema,
};
use super::source_projection::project_committed_candidate_as_source;

pub fn cancel_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &CancelDocumentOperationInput,
) -> Result<DocumentOperationView, AppError> {
    validate_schema(
        &input.schema,
        DOCUMENT_OPERATION_CANCEL_INPUT_SCHEMA,
        "cancel",
    )?;
    validate_idempotency_key(&input.idempotency_key)?;
    let operation = require_operation(db, operation_id)?;
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    let executor = executor_for(config, &attempt.manifest.executor_profile)?;
    DocumentOperationControl::new(db, executor.as_ref())
        .cancel(operation_id, &input.reason)
        .map_err(conflict_error)?;
    get_document_operation_view(db, config, operation_id, false)
}

pub fn commit_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &CommitDocumentOperationInput,
) -> Result<DocumentOperationView, AppError> {
    validate_schema(
        &input.schema,
        DOCUMENT_OPERATION_COMMIT_INPUT_SCHEMA,
        "commit",
    )?;
    validate_idempotency_key(&input.idempotency_key)?;
    let operation = require_operation(db, operation_id)?;
    if operation.status == DocumentOperationStatus::Committed {
        project_committed_candidate_as_source(db, config, operation_id)?;
        return get_document_operation_view(db, config, operation_id, true);
    }
    if operation.status != DocumentOperationStatus::ResultReady {
        return Err(AppError::conflict(format!(
            "document operation cannot commit from status {}",
            operation.status.as_str()
        )));
    }
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    let mut committed = attempt.state;
    committed.status = DocumentOperationStatus::Committed;
    committed.updated_at = now_iso();
    match db
        .commit_document_candidate(&committed)
        .map_err(conflict_error)?
    {
        CommitDocumentCandidateResult::Committed => {
            project_committed_candidate_as_source(db, config, operation_id)?;
            get_document_operation_view(db, config, operation_id, false)
        }
        CommitDocumentCandidateResult::StaleBase => Err(AppError::conflict(
            "document candidate base version is stale",
        )),
    }
}
