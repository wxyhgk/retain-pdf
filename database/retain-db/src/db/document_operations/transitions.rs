use anyhow::{bail, Context, Result};
use rusqlite::{params, Transaction};

use crate::models::domain::{DocumentOperationStatus, DocumentOperationWorkspaceState};

use super::super::Db;
use super::attempts::decode_attempt;
use super::events::append_event;

impl Db {
    pub fn transition_document_operation(
        &self,
        next: &DocumentOperationWorkspaceState,
        event: &str,
        payload_json: &str,
    ) -> Result<()> {
        let payload: serde_json::Value = serde_json::from_str(payload_json)
            .context("document operation event payload must be valid JSON")?;
        if !payload.is_object() {
            bail!("document operation event payload must be a JSON object");
        }

        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let (manifest_json, current_state_json): (String, String) = tx.query_row(
            r#"
            SELECT manifest_json, state_json
            FROM document_operation_attempts
            WHERE operation_id = ?1 AND attempt = ?2
            "#,
            params![next.operation_id, next.attempt],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let current = decode_attempt(&manifest_json, &current_state_json)?;
        next.validate_for(&current.manifest)
            .map_err(anyhow::Error::msg)?;
        if !current.state.status.can_transition_to(&next.status) {
            bail!(
                "invalid document operation transition: {} -> {}",
                current.state.status.as_str(),
                next.status.as_str()
            );
        }
        persist_state_transition(&tx, &current.state.status, next, event, payload_json)?;
        tx.commit()?;
        Ok(())
    }
}

pub(super) fn persist_state_transition(
    tx: &Transaction<'_>,
    current_status: &DocumentOperationStatus,
    next: &DocumentOperationWorkspaceState,
    event: &str,
    payload_json: &str,
) -> Result<()> {
    let changed = tx.execute(
        r#"
        UPDATE document_operation_attempts
        SET state_json = ?1, status = ?2, dispatch_intent_at = ?3,
            dispatch_receipt_json = ?4, terminal_receipt_at = ?5,
            candidate_pdf_sha256 = ?6, updated_at = ?7
        WHERE operation_id = ?8 AND attempt = ?9 AND status = ?10
        "#,
        params![
            serde_json::to_string(next)?,
            next.status.as_str(),
            next.dispatch_intent_at,
            next.dispatch_receipt
                .as_ref()
                .map(serde_json::to_string)
                .transpose()?,
            next.terminal_receipt_at,
            next.candidate_pdf_sha256,
            next.updated_at,
            next.operation_id,
            next.attempt,
            current_status.as_str(),
        ],
    )?;
    if changed != 1 {
        bail!("document operation attempt changed concurrently");
    }
    let operation_changed = tx.execute(
        r#"
        UPDATE document_operations
        SET status = ?1, updated_at = ?2
        WHERE operation_id = ?3 AND current_attempt = ?4 AND status = ?5
        "#,
        params![
            next.status.as_str(),
            next.updated_at,
            next.operation_id,
            next.attempt,
            current_status.as_str(),
        ],
    )?;
    if operation_changed != 1 {
        bail!("document operation changed concurrently");
    }
    append_event(
        tx,
        &next.operation_id,
        next.attempt,
        &next.updated_at,
        event,
        &next.status,
        payload_json,
    )?;
    Ok(())
}
