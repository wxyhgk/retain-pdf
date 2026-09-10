use retain_core::models::domain::{DocumentOperationLimits, DocumentOperationWorkspaceManifest};
use retain_data::db::Db;
use sha2::{Digest, Sha256};

use crate::config::AppConfig;
use crate::error::AppError;

use super::super::contracts::CreateDocumentOperationInput;
use super::super::{
    ControlPlanePreviewExecutor, DocumentOperationExecutor, RestrictedPageProgramExecutor,
    CONTROL_PLANE_PREVIEW_PROFILE, RESTRICTED_PAGE_PROGRAM_PROFILE,
};

pub(super) fn executor_for(
    config: &AppConfig,
    profile: &str,
) -> Result<Box<dyn DocumentOperationExecutor>, AppError> {
    match profile {
        CONTROL_PLANE_PREVIEW_PROFILE => Ok(Box::new(ControlPlanePreviewExecutor)),
        RESTRICTED_PAGE_PROGRAM_PROFILE => Ok(Box::new(
            RestrictedPageProgramExecutor::new(&config.data_root, &config.pipeline_command),
        )),
        _ => Err(AppError::conflict(format!(
            "document operation executor profile is unavailable: {profile}"
        ))),
    }
}

pub(super) fn require_operation(
    db: &Db,
    operation_id: &str,
) -> Result<retain_data::db::StoredDocumentOperation, AppError> {
    retain_core::models::domain::validate_operation_id(operation_id)
        .map_err(AppError::bad_request)?;
    db.get_document_operation(operation_id)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::not_found(format!("document operation not found: {operation_id}")))
}

pub(super) fn validate_schema(actual: &str, expected: &str, action: &str) -> Result<(), AppError> {
    if actual != expected {
        return Err(AppError::bad_request(format!(
            "unsupported document operation {action} schema: {actual}"
        )));
    }
    Ok(())
}

pub(super) fn validate_idempotency_key(value: &str) -> Result<(), AppError> {
    let value = value.trim();
    if value.is_empty() || value.len() > 128 || value.chars().any(char::is_whitespace) {
        return Err(AppError::bad_request(
            "idempotency_key must be 1..128 non-whitespace characters",
        ));
    }
    Ok(())
}

pub(super) fn operation_identity(input: &CreateDocumentOperationInput) -> (String, String) {
    let scope = if input.conversation_id.trim().is_empty() {
        input.document_id.trim()
    } else {
        input.conversation_id.trim()
    };
    let digest = Sha256::digest(format!("{scope}\0{}", input.idempotency_key.trim()).as_bytes());
    let hex = digest_hex(&digest);
    (
        format!("op-{}", &hex[..40]),
        format!("dispatch-{}", &hex[..40]),
    )
}

pub(super) fn retry_dispatch_identity(operation_id: &str, attempt: u32) -> String {
    let digest = Sha256::digest(format!("{operation_id}\0retry\0{attempt}").as_bytes());
    format!("dispatch-{}", &digest_hex(&digest)[..40])
}

pub(super) fn ensure_create_replay_matches(
    input: &CreateDocumentOperationInput,
    manifest: &DocumentOperationWorkspaceManifest,
) -> Result<(), AppError> {
    let base_job_matches = input
        .base_job_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none_or(|value| value == manifest.base_job_id);
    let source_matches = input
        .source_pdf_sha256
        .as_deref()
        .is_none_or(|value| value == manifest.source_pdf_sha256);
    if manifest.document_id != input.document_id
        || manifest.conversation_id != input.conversation_id.trim()
        || manifest.request_message_id != input.request_message_id.trim()
        || manifest.intent_summary != input.intent_summary.trim()
        || manifest.normalized_document_sha256 != input.normalized_document_sha256
        || manifest.program_sha256 != input.program_sha256
        || input
            .limits
            .as_ref()
            .is_some_and(|limits| limits != &manifest.limits)
        || !base_job_matches
        || !source_matches
    {
        return Err(AppError::conflict(
            "idempotency key was already used with a different create payload",
        ));
    }
    Ok(())
}

pub(super) fn short_identity(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    digest_hex(&digest)[..16].to_string()
}

pub(super) fn digest_hex(digest: &[u8]) -> String {
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(super) fn require_sha256(value: &str) -> anyhow::Result<()> {
    if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        anyhow::bail!("validation artifact contains an invalid SHA-256 identity");
    }
    Ok(())
}

pub(super) fn default_limits() -> DocumentOperationLimits {
    DocumentOperationLimits {
        wall_time_seconds: 60,
        cpu_time_seconds: 45,
        memory_bytes: 512 * 1024 * 1024,
        scratch_bytes: 256 * 1024 * 1024,
        output_bytes: 128 * 1024 * 1024,
        process_count: 1,
        file_descriptor_count: 32,
        file_count: 16,
        stdout_bytes: 1024 * 1024,
        stderr_bytes: 1024 * 1024,
    }
}

pub(super) fn internal_error(error: impl std::fmt::Display) -> AppError {
    AppError::internal(error.to_string())
}

pub(super) fn conflict_error(error: impl std::fmt::Display) -> AppError {
    AppError::conflict(error.to_string())
}
