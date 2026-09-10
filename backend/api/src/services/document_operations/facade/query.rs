use retain_core::models::domain::{now_iso, DocumentOperationStatus};
use retain_data::db::Db;

use crate::config::AppConfig;
use crate::error::AppError;

use super::super::contracts::{
    DocumentOperationEventView, DocumentOperationView, DOCUMENT_OPERATION_VIEW_SCHEMA,
};
use super::super::workspace::{write_state_mirror, OperationWorkspacePaths};
use super::super::{DocumentOperationControl, RESTRICTED_PAGE_PROGRAM_PROFILE};
use super::candidate_validation::validate_and_publish_candidate;
use super::shared::{executor_for, internal_error, require_operation};

pub fn get_document_operation_view(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
    idempotent_replay: bool,
) -> Result<DocumentOperationView, AppError> {
    refresh_and_publish(db, config, operation_id)?;
    let operation = require_operation(db, operation_id)?;
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    let events = db
        .list_document_operation_events(operation_id)
        .map_err(internal_error)?
        .into_iter()
        .map(|event| {
            let payload = serde_json::from_str(&event.payload_json).map_err(internal_error)?;
            Ok(DocumentOperationEventView {
                seq: event.seq,
                attempt: event.attempt,
                ts: event.ts,
                event: event.event,
                status: event.status,
                payload,
            })
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    let candidate_version = db
        .get_document_version_for_operation(operation_id)
        .map_err(internal_error)?
        .map(Into::into);
    Ok(DocumentOperationView {
        schema: DOCUMENT_OPERATION_VIEW_SCHEMA,
        operation_id: operation.operation_id,
        conversation_id: operation.conversation_id,
        request_message_id: operation.request_message_id,
        document_id: operation.document_id,
        base_job_id: operation.base_job_id,
        base_version_id: operation.base_version_id,
        intent_summary: operation.intent_summary,
        status: operation.status,
        current_attempt: operation.current_attempt,
        manifest: attempt.manifest,
        state: attempt.state,
        candidate_version,
        events,
        idempotent_replay,
        created_at: operation.created_at,
        updated_at: operation.updated_at,
    })
}

pub(super) fn refresh_and_publish(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
) -> Result<(), AppError> {
    let operation = require_operation(db, operation_id)?;
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    if attempt.manifest.executor_profile == RESTRICTED_PAGE_PROGRAM_PROFILE
        && matches!(
            operation.status,
            DocumentOperationStatus::Queued | DocumentOperationStatus::Running
        )
    {
        let executor = executor_for(config, &attempt.manifest.executor_profile)?;
        let control = DocumentOperationControl::new(db, executor.as_ref());
        if operation.status == DocumentOperationStatus::Queued {
            control
                .reconcile_unreceipted_operation(operation_id)
                .map_err(internal_error)?;
        } else {
            control.refresh(operation_id).map_err(internal_error)?;
        }
    }
    let operation = require_operation(db, operation_id)?;
    if operation.status != DocumentOperationStatus::Validating {
        return Ok(());
    }
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    if let Err(error) = validate_and_publish_candidate(db, config, &operation, &attempt) {
        let mut failed = attempt.state;
        failed.status = DocumentOperationStatus::Failed;
        failed.error_code = Some("candidate_validation_failed".to_string());
        failed.detail = Some(
            error
                .to_string()
                .replace(
                    &config.data_root.to_string_lossy().to_string(),
                    "[DATA_ROOT]",
                )
                .chars()
                .take(2000)
                .collect(),
        );
        failed.updated_at = now_iso();
        db.transition_document_operation(
            &failed,
            "candidate_validation_failed",
            r#"{"failed":true}"#,
        )
        .map_err(internal_error)?;
        let paths = OperationWorkspacePaths::for_manifest(&config.data_root, &attempt.manifest);
        let _ = write_state_mirror(&paths, &failed);
    }
    Ok(())
}
