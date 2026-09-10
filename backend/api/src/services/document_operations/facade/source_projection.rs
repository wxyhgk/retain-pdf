use std::path::{Path, PathBuf};

use retain_core::models::domain::{now_iso, DocumentOperationStatus, UploadRecord};
use retain_core::storage_paths::resolve_data_path;
use retain_data::db::Db;

use crate::config::AppConfig;
use crate::error::AppError;

use super::super::workspace::require_regular_file;
use super::super::RESTRICTED_PAGE_PROGRAM_PROFILE;
use super::shared::{internal_error, require_operation};

pub(super) fn resolve_operation_source(
    db: &Db,
    data_root: &Path,
    document_id: &str,
    base_version_id: Option<&str>,
) -> Result<PathBuf, AppError> {
    let path = if let Some(version_id) = base_version_id {
        let version = db
            .get_document_version(version_id)
            .map_err(internal_error)?
            .ok_or_else(|| AppError::conflict("active document version is missing"))?;
        if version.document_id != document_id || version.status != "committed" {
            return Err(AppError::conflict(
                "active document version is not a committed version for this document",
            ));
        }
        resolve_data_path(data_root, &version.artifact_key).map_err(internal_error)?
    } else {
        let upload = db
            .find_upload_for_document(document_id)
            .map_err(internal_error)?
            .ok_or_else(|| AppError::not_found("document source PDF is missing"))?;
        PathBuf::from(upload.stored_path)
    };
    require_regular_file(&path, "active document source PDF").map_err(internal_error)?;
    let canonical_root = data_root.canonicalize().map_err(internal_error)?;
    let canonical_path = path.canonicalize().map_err(internal_error)?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err(AppError::conflict(
            "active document source PDF is outside the backend data root",
        ));
    }
    Ok(canonical_path)
}

pub(super) fn project_committed_candidate_as_source(
    db: &Db,
    config: &AppConfig,
    operation_id: &str,
) -> Result<(), AppError> {
    let operation = require_operation(db, operation_id)?;
    if operation.status != DocumentOperationStatus::Committed {
        return Ok(());
    }
    let attempt = db
        .get_document_operation_attempt(operation_id, operation.current_attempt)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("document operation attempt is missing"))?;
    if attempt.manifest.executor_profile != RESTRICTED_PAGE_PROGRAM_PROFILE {
        return Ok(());
    }
    let version = db
        .get_document_version_for_operation(operation_id)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("committed document version is missing"))?;
    if version.status != "committed" || version.document_id != operation.document_id {
        return Err(AppError::internal(
            "committed document version identity is inconsistent",
        ));
    }
    let candidate_path =
        resolve_data_path(&config.data_root, &version.artifact_key).map_err(internal_error)?;
    require_regular_file(&candidate_path, "committed candidate PDF").map_err(internal_error)?;
    let candidate = lopdf::Document::load(&candidate_path).map_err(internal_error)?;
    let page_count = candidate.get_pages().len() as u32;
    let bytes = std::fs::metadata(&candidate_path)
        .map_err(internal_error)?
        .len();
    let document = db
        .get_document(&operation.document_id)
        .map_err(internal_error)?;
    db.save_upload(&UploadRecord {
        upload_id: format!("version-upload-{}", version.version_id),
        filename: if document.source_filename.trim().is_empty() {
            format!("{}.pdf", operation.document_id)
        } else {
            document.source_filename
        },
        stored_path: version.artifact_key,
        bytes,
        page_count,
        uploaded_at: version.committed_at.unwrap_or_else(now_iso),
        developer_mode: false,
        // document_id becomes the stable lineage identity after the first
        // committed edit; the immutable version keeps the actual content hash.
        content_hash: operation.document_id,
    })
    .map_err(internal_error)?;
    let projected = db
        .find_upload_for_document(&version.document_id)
        .map_err(internal_error)?
        .ok_or_else(|| AppError::internal("committed source projection is missing"))?;
    db.upsert_document_from_upload(&projected)
        .map_err(internal_error)?;
    Ok(())
}
