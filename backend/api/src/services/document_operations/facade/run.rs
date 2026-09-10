use retain_core::models::domain::{
    now_iso, DocumentOperationStatus, DocumentOperationWorkspaceManifest,
    DocumentOperationWorkspaceState, DOCUMENT_OPERATION_SCHEMA_VERSION,
    DOCUMENT_OPERATION_STATE_SCHEMA,
};
use retain_data::db::Db;
use serde_json::Value;

use crate::config::AppConfig;
use crate::error::AppError;

use super::super::contracts::{
    DocumentOperationView, RunDocumentOperationInput, DOCUMENT_OPERATION_RUN_INPUT_SCHEMA,
};
use super::super::program::canonical_program_sha256;
use super::super::workspace::{
    materialize_operation_workspace, require_regular_file, sha256_file, OperationWorkspacePaths,
};
use super::super::{
    DocumentOperationControl, CONTROL_PLANE_PREVIEW_PROFILE, RESTRICTED_PAGE_PROGRAM_PROFILE,
};
use super::query::{get_document_operation_view, refresh_and_publish};
use super::shared::{
    conflict_error, executor_for, internal_error, require_operation, retry_dispatch_identity,
    validate_idempotency_key, validate_schema,
};

pub fn run_document_operation(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    input: &RunDocumentOperationInput,
) -> Result<DocumentOperationView, AppError> {
    validate_schema(&input.schema, DOCUMENT_OPERATION_RUN_INPUT_SCHEMA, "run")?;
    validate_idempotency_key(&input.idempotency_key)?;
    if input.accept_duplicate_risk && !input.retry {
        return Err(AppError::bad_request(
            "accept_duplicate_risk is valid only for an explicit retry",
        ));
    }
    let mut operation = require_operation(db, operation_id)?;
    let mut retry_replay = false;
    if input.retry {
        if !input.confirmed {
            return Err(AppError::conflict(
                "document operation retry requires explicit confirmation",
            ));
        }
        if let Some(existing_retry) = db
            .get_document_operation_attempt_by_retry_key(operation_id, &input.idempotency_key)
            .map_err(internal_error)?
        {
            retry_replay = true;
            if existing_retry.manifest.attempt != operation.current_attempt {
                return get_document_operation_view(db, config, operation_id, true);
            }
            materialize_retry_workspace(db, config, &existing_retry.manifest)?;
            if !matches!(
                operation.status,
                DocumentOperationStatus::Draft | DocumentOperationStatus::AwaitingConfirmation
            ) {
                refresh_and_publish(db, config, operation_id)?;
                return get_document_operation_view(db, config, operation_id, true);
            }
        } else {
            if !matches!(
                operation.status,
                DocumentOperationStatus::Failed | DocumentOperationStatus::Ambiguous
            ) {
                return Err(AppError::conflict(format!(
                    "document operation cannot retry from status {}",
                    operation.status.as_str()
                )));
            }
            if operation.status == DocumentOperationStatus::Ambiguous
                && !input.accept_duplicate_risk
            {
                return Err(AppError::conflict(
                    "ambiguous document operation retry requires accept_duplicate_risk=true",
                ));
            }
            create_retry_attempt(db, config, &operation, input)?;
            operation = require_operation(db, operation_id)?;
        }
    }
    if matches!(
        operation.status,
        DocumentOperationStatus::Queued
            | DocumentOperationStatus::Running
            | DocumentOperationStatus::Validating
            | DocumentOperationStatus::ResultReady
            | DocumentOperationStatus::Committed
    ) {
        refresh_and_publish(db, config, operation_id)?;
        return get_document_operation_view(db, config, operation_id, true);
    }
    if operation.status == DocumentOperationStatus::Draft && !input.confirmed {
        return Err(AppError::conflict(
            "document operation requires explicit confirmation before dispatch",
        ));
    }
    if !matches!(
        operation.status,
        DocumentOperationStatus::Draft | DocumentOperationStatus::AwaitingConfirmation
    ) {
        return Err(AppError::conflict(format!(
            "document operation cannot run from status {}",
            operation.status.as_str()
        )));
    }
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    let executor = executor_for(config, &attempt.manifest.executor_profile)?;
    let control = DocumentOperationControl::new(db, executor.as_ref());
    if operation.status == DocumentOperationStatus::Draft {
        control.confirm(operation_id).map_err(conflict_error)?;
    }
    control.dispatch(operation_id).map_err(conflict_error)?;
    refresh_and_publish(db, config, operation_id)?;
    get_document_operation_view(db, config, operation_id, retry_replay)
}

fn create_retry_attempt(
    db: &Db,
    config: &AppConfig,
    operation: &retain_data::db::StoredDocumentOperation,
    input: &RunDocumentOperationInput,
) -> Result<(), AppError> {
    let previous = db
        .get_document_operation_attempt(&operation.operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    let attempt_number = operation
        .current_attempt
        .checked_add(1)
        .ok_or_else(|| AppError::conflict("document operation attempt limit was reached"))?;
    let created_at = now_iso();
    let mut manifest = previous.manifest;
    manifest.attempt = attempt_number;
    manifest.dispatch_id = retry_dispatch_identity(&operation.operation_id, attempt_number);
    manifest.created_at = created_at.clone();
    let state = DocumentOperationWorkspaceState {
        schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
        schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
        operation_id: operation.operation_id.clone(),
        attempt: attempt_number,
        dispatch_id: manifest.dispatch_id.clone(),
        program_sha256: manifest.program_sha256.clone(),
        status: DocumentOperationStatus::Draft,
        dispatch_intent_at: None,
        dispatch_receipt: None,
        terminal_receipt_at: None,
        candidate_pdf_sha256: None,
        error_code: None,
        detail: None,
        updated_at: created_at,
    };
    db.create_next_document_operation_attempt(
        &manifest,
        &state,
        &input.idempotency_key,
        input.accept_duplicate_risk,
    )
    .map_err(conflict_error)?;
    materialize_retry_workspace(db, config, &manifest)
}

fn materialize_retry_workspace(
    db: &Db,
    config: &AppConfig,
    manifest: &DocumentOperationWorkspaceManifest,
) -> Result<(), AppError> {
    if manifest.attempt <= 1 || manifest.executor_profile == CONTROL_PLANE_PREVIEW_PROFILE {
        return Ok(());
    }
    if manifest.executor_profile != RESTRICTED_PAGE_PROGRAM_PROFILE {
        return Err(AppError::conflict(format!(
            "document operation executor profile is unavailable: {}",
            manifest.executor_profile
        )));
    }
    let previous = db
        .get_document_operation_attempt(&manifest.operation_id, manifest.attempt - 1)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("previous document operation attempt is missing"))?;
    let previous_paths =
        OperationWorkspacePaths::for_manifest(&config.data_root, &previous.manifest);
    require_regular_file(&previous_paths.source_pdf, "previous operation source PDF")
        .map_err(internal_error)?;
    require_regular_file(
        &previous_paths.program_json,
        "previous operation page program",
    )
    .map_err(internal_error)?;
    if sha256_file(&previous_paths.source_pdf).map_err(internal_error)?
        != manifest.source_pdf_sha256
        || sha256_file(&previous_paths.program_json).map_err(internal_error)?
            != manifest.program_sha256
    {
        return Err(AppError::conflict(
            "previous operation workspace no longer matches immutable retry inputs",
        ));
    }
    let program: Value = serde_json::from_slice(
        &std::fs::read(&previous_paths.program_json).map_err(internal_error)?,
    )
    .map_err(internal_error)?;
    if canonical_program_sha256(&program).map_err(AppError::conflict)? != manifest.program_sha256 {
        return Err(AppError::conflict(
            "previous operation page program is not canonical",
        ));
    }
    let attempt = db
        .get_document_operation_attempt(&manifest.operation_id, manifest.attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("retry document operation attempt is missing"))?;
    materialize_operation_workspace(
        &config.data_root,
        &previous_paths.source_pdf,
        &program,
        manifest,
        &attempt.state,
    )
    .map(|_| ())
    .map_err(|error| {
        AppError::conflict(format!(
            "prepare retry document operation workspace failed: {error}"
        ))
    })
}
