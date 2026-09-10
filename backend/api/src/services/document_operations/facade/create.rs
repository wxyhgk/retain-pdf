use retain_core::models::domain::{
    now_iso, DocumentOperationStatus, DocumentOperationWorkspaceManifest,
    DocumentOperationWorkspaceState, DOCUMENT_OPERATION_MANIFEST_SCHEMA,
    DOCUMENT_OPERATION_SCHEMA_VERSION, DOCUMENT_OPERATION_STATE_SCHEMA,
};
use retain_data::db::Db;

use crate::config::AppConfig;
use crate::error::AppError;

use super::super::contracts::{
    CreateDocumentOperationInput, DocumentOperationView, DOCUMENT_OPERATION_CREATE_INPUT_SCHEMA,
};
use super::super::program::canonical_program_sha256;
use super::super::workspace::{materialize_operation_workspace, sha256_file};
use super::super::{CONTROL_PLANE_PREVIEW_PROFILE, RESTRICTED_PAGE_PROGRAM_PROFILE};
use super::query::get_document_operation_view;
use super::shared::{
    default_limits, ensure_create_replay_matches, internal_error, operation_identity,
    short_identity, validate_idempotency_key, validate_schema,
};
use super::source_projection::resolve_operation_source;

pub fn create_document_operation(
    db: &Db,
    config: &AppConfig,
    input: &CreateDocumentOperationInput,
) -> Result<DocumentOperationView, AppError> {
    validate_schema(
        &input.schema,
        DOCUMENT_OPERATION_CREATE_INPUT_SCHEMA,
        "create",
    )?;
    validate_idempotency_key(&input.idempotency_key)?;
    let (operation_id, dispatch_id) = operation_identity(input);

    if let Some(existing) = db
        .get_document_operation(&operation_id)
        .map_err(internal_error)?
    {
        let attempt = db
            .get_document_operation_attempt(&operation_id, existing.current_attempt)
            .map_err(internal_error)?
            .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
        ensure_create_replay_matches(input, &attempt.manifest)?;
        return get_document_operation_view(db, config, &operation_id, true);
    }

    let document = db
        .get_document(&input.document_id)
        .map_err(|_| AppError::not_found(format!("document not found: {}", input.document_id)))?;
    if !input.conversation_id.trim().is_empty() {
        let conversation = db
            .get_conversation(input.conversation_id.trim())
            .map_err(internal_error)?
            .ok_or_else(|| {
                AppError::not_found(format!(
                    "conversation not found: {}",
                    input.conversation_id.trim()
                ))
            })?;
        if conversation
            .document_id
            .as_deref()
            .is_some_and(|document_id| document_id != input.document_id)
        {
            return Err(AppError::conflict(
                "conversation is scoped to a different document",
            ));
        }
        if db
            .get_message(
                input.conversation_id.trim(),
                input.request_message_id.trim(),
            )
            .map_err(internal_error)?
            .is_none()
        {
            return Err(AppError::not_found(format!(
                "request message not found: {}",
                input.request_message_id.trim()
            )));
        }
    }
    let base_version_id = db
        .get_active_document_version_id(&input.document_id)
        .map_err(internal_error)?;
    let base_job_id = input
        .base_job_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or(document.active_job_id)
        .unwrap_or_else(|| format!("source-{}", short_identity(&input.document_id)));
    let (executor_profile, source_path, source_pdf_sha256) = match &input.program {
        Some(program) => {
            let actual_program_sha = canonical_program_sha256(program).map_err(|error| {
                AppError::bad_request(format!("invalid document operation program: {error}"))
            })?;
            if actual_program_sha != input.program_sha256 {
                return Err(AppError::bad_request(
                    "program_sha256 does not match canonical program content",
                ));
            }
            let source_path = resolve_operation_source(
                db,
                &config.data_root,
                &input.document_id,
                base_version_id.as_deref(),
            )?;
            let actual_source_sha = sha256_file(&source_path).map_err(internal_error)?;
            if input
                .source_pdf_sha256
                .as_deref()
                .is_some_and(|expected| expected != actual_source_sha)
            {
                return Err(AppError::conflict(
                    "source_pdf_sha256 does not match the active document version",
                ));
            }
            (
                RESTRICTED_PAGE_PROGRAM_PROFILE,
                Some(source_path),
                actual_source_sha,
            )
        }
        None => (
            CONTROL_PLANE_PREVIEW_PROFILE,
            None,
            input
                .source_pdf_sha256
                .clone()
                .unwrap_or_else(|| input.document_id.clone()),
        ),
    };
    let created_at = now_iso();
    let manifest = DocumentOperationWorkspaceManifest {
        schema: DOCUMENT_OPERATION_MANIFEST_SCHEMA.to_string(),
        schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
        operation_id: operation_id.clone(),
        attempt: 1,
        dispatch_id,
        document_id: input.document_id.clone(),
        base_job_id,
        conversation_id: input.conversation_id.trim().to_string(),
        request_message_id: input.request_message_id.trim().to_string(),
        intent_summary: input.intent_summary.trim().to_string(),
        source_pdf_sha256,
        normalized_document_sha256: input.normalized_document_sha256.clone(),
        program_sha256: input.program_sha256.clone(),
        executor_profile: executor_profile.to_string(),
        limits: input.limits.clone().unwrap_or_else(default_limits),
        created_at: created_at.clone(),
    };
    manifest
        .validate()
        .map_err(|error| AppError::bad_request(format!("invalid operation manifest: {error}")))?;
    if manifest.request_message_id.is_empty() {
        return Err(AppError::bad_request("request_message_id is required"));
    }
    let state = DocumentOperationWorkspaceState {
        schema: DOCUMENT_OPERATION_STATE_SCHEMA.to_string(),
        schema_version: DOCUMENT_OPERATION_SCHEMA_VERSION,
        operation_id: operation_id.clone(),
        attempt: 1,
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
    if let (Some(program), Some(source_path)) = (&input.program, source_path.as_deref()) {
        materialize_operation_workspace(&config.data_root, source_path, program, &manifest, &state)
            .map_err(|error| {
                AppError::conflict(format!(
                    "prepare document operation workspace failed: {error}"
                ))
            })?;
    }
    db.create_document_operation(&manifest, &state, base_version_id.as_deref())
        .map_err(|error| {
            AppError::conflict(format!("create document operation failed: {error}"))
        })?;
    get_document_operation_view(db, config, &operation_id, false)
}
