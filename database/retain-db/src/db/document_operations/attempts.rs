use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, Transaction};

use crate::models::domain::{
    DocumentOperationStatus, DocumentOperationWorkspaceManifest, DocumentOperationWorkspaceState,
};

use super::super::Db;
use super::events::append_event;
use super::operations::load_operation;
use super::{CreateDocumentOperationAttemptResult, StoredDocumentOperationAttempt};

impl Db {
    pub fn get_document_operation_attempt(
        &self,
        operation_id: &str,
        attempt: u32,
    ) -> Result<Option<StoredDocumentOperationAttempt>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT manifest_json, state_json
            FROM document_operation_attempts
            WHERE operation_id = ?1 AND attempt = ?2
            "#,
            params![operation_id, attempt],
            |row| {
                let manifest_json: String = row.get(0)?;
                let state_json: String = row.get(1)?;
                Ok((manifest_json, state_json))
            },
        )
        .optional()?
        .map(|(manifest_json, state_json)| decode_attempt(&manifest_json, &state_json))
        .transpose()
    }

    pub fn create_next_document_operation_attempt(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
        state: &DocumentOperationWorkspaceState,
        retry_idempotency_key: &str,
        accept_duplicate_risk: bool,
    ) -> Result<CreateDocumentOperationAttemptResult> {
        manifest.validate().map_err(anyhow::Error::msg)?;
        state.validate_for(manifest).map_err(anyhow::Error::msg)?;
        if state.status != DocumentOperationStatus::Draft {
            bail!("new document operation attempt must start in draft");
        }
        if retry_idempotency_key.trim().is_empty()
            || retry_idempotency_key.len() > 128
            || retry_idempotency_key.chars().any(char::is_whitespace)
        {
            bail!("retry idempotency key is invalid");
        }

        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let existing: Option<i64> = tx
            .query_row(
                r#"
                SELECT attempt FROM document_operation_attempts
                WHERE operation_id = ?1 AND retry_idempotency_key = ?2
                "#,
                params![manifest.operation_id, retry_idempotency_key],
                |row| row.get(0),
            )
            .optional()?;
        if existing.is_some() {
            tx.commit()?;
            return Ok(CreateDocumentOperationAttemptResult::IdempotentReplay);
        }
        let operation = load_operation(&tx, &manifest.operation_id)?;
        if !matches!(
            operation.status,
            DocumentOperationStatus::Failed | DocumentOperationStatus::Ambiguous
        ) {
            bail!("document operation is not retryable");
        }
        if operation.status == DocumentOperationStatus::Ambiguous && !accept_duplicate_risk {
            bail!("ambiguous document operation retry requires accepting duplicate execution risk");
        }
        if manifest.attempt != operation.current_attempt + 1 {
            bail!("retry attempt must increment current_attempt by one");
        }
        let previous = load_attempt(&tx, &manifest.operation_id, operation.current_attempt)?;
        if previous.state.status != operation.status {
            bail!("document operation and current attempt status disagree");
        }
        if !retry_manifest_preserves_scope(manifest, &previous.manifest) {
            bail!("retry manifest changed immutable operation scope");
        }
        let active_version_id: Option<String> = tx.query_row(
            "SELECT active_version_id FROM documents WHERE document_id = ?1",
            params![operation.document_id],
            |row| row.get(0),
        )?;
        if active_version_id != operation.base_version_id {
            bail!("document operation base version is stale");
        }
        let changed = tx.execute(
            r#"
            UPDATE document_operations
            SET status = 'draft', current_attempt = ?1, updated_at = ?2
            WHERE operation_id = ?3 AND current_attempt = ?4 AND status = ?5
            "#,
            params![
                manifest.attempt,
                state.updated_at,
                manifest.operation_id,
                operation.current_attempt,
                operation.status.as_str(),
            ],
        )?;
        if changed != 1 {
            bail!("document operation changed concurrently while creating retry attempt");
        }
        insert_attempt(&tx, manifest, state, retry_idempotency_key)?;
        let payload = serde_json::to_string(&serde_json::json!({
            "retry": true,
            "previous_attempt": operation.current_attempt,
            "previous_status": operation.status.as_str(),
            "accepted_duplicate_risk": operation.status == DocumentOperationStatus::Ambiguous
                && accept_duplicate_risk,
        }))?;
        append_event(
            &tx,
            &manifest.operation_id,
            manifest.attempt,
            &state.updated_at,
            "retry_attempt_created",
            &state.status,
            &payload,
        )?;
        tx.commit()?;
        Ok(CreateDocumentOperationAttemptResult::Created)
    }

    pub fn get_document_operation_attempt_by_retry_key(
        &self,
        operation_id: &str,
        retry_idempotency_key: &str,
    ) -> Result<Option<StoredDocumentOperationAttempt>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT manifest_json, state_json
            FROM document_operation_attempts
            WHERE operation_id = ?1 AND retry_idempotency_key = ?2
            "#,
            params![operation_id, retry_idempotency_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?
        .map(|(manifest_json, state_json)| decode_attempt(&manifest_json, &state_json))
        .transpose()
    }
}

pub(super) fn insert_attempt(
    tx: &Transaction<'_>,
    manifest: &DocumentOperationWorkspaceManifest,
    state: &DocumentOperationWorkspaceState,
    retry_idempotency_key: &str,
) -> Result<()> {
    let inserted = tx.execute(
        r#"
        INSERT INTO document_operation_attempts (
            operation_id, attempt, dispatch_id, program_sha256,
            manifest_json, state_json, status, dispatch_intent_at,
            dispatch_receipt_json, terminal_receipt_at, candidate_pdf_sha256,
            created_at, updated_at, retry_idempotency_key
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
        "#,
        params![
            manifest.operation_id,
            manifest.attempt,
            manifest.dispatch_id,
            manifest.program_sha256,
            serde_json::to_string(manifest)?,
            serde_json::to_string(state)?,
            state.status.as_str(),
            state.dispatch_intent_at,
            state
                .dispatch_receipt
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
            state.terminal_receipt_at,
            state.candidate_pdf_sha256,
            manifest.created_at,
            state.updated_at,
            retry_idempotency_key,
        ],
    )?;
    if inserted != 1 {
        bail!("document operation attempt was not inserted");
    }
    Ok(())
}

fn load_attempt(
    tx: &Transaction<'_>,
    operation_id: &str,
    attempt: u32,
) -> Result<StoredDocumentOperationAttempt> {
    let (manifest_json, state_json): (String, String) = tx.query_row(
        r#"
        SELECT manifest_json, state_json FROM document_operation_attempts
        WHERE operation_id = ?1 AND attempt = ?2
        "#,
        params![operation_id, attempt],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    decode_attempt(&manifest_json, &state_json)
}

fn retry_manifest_preserves_scope(
    next: &DocumentOperationWorkspaceManifest,
    previous: &DocumentOperationWorkspaceManifest,
) -> bool {
    next.operation_id == previous.operation_id
        && next.attempt == previous.attempt + 1
        && next.document_id == previous.document_id
        && next.base_job_id == previous.base_job_id
        && next.conversation_id == previous.conversation_id
        && next.request_message_id == previous.request_message_id
        && next.intent_summary == previous.intent_summary
        && next.source_pdf_sha256 == previous.source_pdf_sha256
        && next.normalized_document_sha256 == previous.normalized_document_sha256
        && next.program_sha256 == previous.program_sha256
        && next.executor_profile == previous.executor_profile
        && next.limits == previous.limits
}

pub(super) fn decode_attempt(
    manifest_json: &str,
    state_json: &str,
) -> Result<StoredDocumentOperationAttempt> {
    let manifest: DocumentOperationWorkspaceManifest = serde_json::from_str(manifest_json)?;
    let state: DocumentOperationWorkspaceState = serde_json::from_str(state_json)?;
    manifest.validate().map_err(anyhow::Error::msg)?;
    state.validate_for(&manifest).map_err(anyhow::Error::msg)?;
    Ok(StoredDocumentOperationAttempt { manifest, state })
}
