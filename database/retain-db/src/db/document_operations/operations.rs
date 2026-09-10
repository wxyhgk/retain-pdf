use std::str::FromStr;

use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, Transaction};

use crate::models::domain::{
    DocumentOperationStatus, DocumentOperationWorkspaceManifest, DocumentOperationWorkspaceState,
};

use super::super::Db;
use super::attempts::insert_attempt;
use super::events::append_event;
use super::StoredDocumentOperation;

impl Db {
    pub fn create_document_operation(
        &self,
        manifest: &DocumentOperationWorkspaceManifest,
        state: &DocumentOperationWorkspaceState,
        base_version_id: Option<&str>,
    ) -> Result<()> {
        manifest.validate().map_err(anyhow::Error::msg)?;
        state.validate_for(manifest).map_err(anyhow::Error::msg)?;
        if state.status != DocumentOperationStatus::Draft {
            bail!("new document operation must start in draft");
        }

        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        tx.execute(
            r#"
            INSERT INTO document_operations (
                operation_id, conversation_id, request_message_id, document_id,
                base_job_id, base_version_id, intent_summary, status,
                current_attempt, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
            "#,
            params![
                manifest.operation_id,
                non_empty(&manifest.conversation_id),
                manifest.request_message_id,
                manifest.document_id,
                manifest.base_job_id,
                base_version_id,
                manifest.intent_summary,
                state.status.as_str(),
                manifest.attempt,
                manifest.created_at,
            ],
        )?;
        insert_attempt(&tx, manifest, state, "")?;
        append_event(
            &tx,
            &manifest.operation_id,
            manifest.attempt,
            &manifest.created_at,
            "created",
            &state.status,
            "{}",
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn get_document_operation(
        &self,
        operation_id: &str,
    ) -> Result<Option<StoredDocumentOperation>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT operation_id, conversation_id, request_message_id, document_id,
                   base_job_id, base_version_id, intent_summary, status,
                   current_attempt, created_at, updated_at
            FROM document_operations WHERE operation_id = ?1
            "#,
            params![operation_id],
            row_to_operation,
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn list_document_operations_for_conversation(
        &self,
        conversation_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<StoredDocumentOperation>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT operation_id, conversation_id, request_message_id, document_id,
                   base_job_id, base_version_id, intent_summary, status,
                   current_attempt, created_at, updated_at
            FROM document_operations
            WHERE conversation_id = ?1
            ORDER BY updated_at DESC, operation_id DESC
            LIMIT ?2 OFFSET ?3
            "#,
        )?;
        let rows = stmt.query_map(
            params![conversation_id, i64::from(limit), i64::from(offset)],
            row_to_operation,
        )?;
        let mut operations = Vec::new();
        for row in rows {
            operations.push(row?);
        }
        Ok(operations)
    }

    pub fn count_document_operations_for_conversation(&self, conversation_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM document_operations WHERE conversation_id = ?1",
            params![conversation_id],
            |row| row.get(0),
        )?;
        Ok(count.max(0) as u64)
    }
}

pub(super) fn load_operation(
    tx: &Transaction<'_>,
    operation_id: &str,
) -> Result<StoredDocumentOperation> {
    tx.query_row(
        r#"
        SELECT operation_id, conversation_id, request_message_id, document_id,
               base_job_id, base_version_id, intent_summary, status,
               current_attempt, created_at, updated_at
        FROM document_operations WHERE operation_id = ?1
        "#,
        params![operation_id],
        row_to_operation,
    )
    .map_err(Into::into)
}

pub(super) fn row_to_operation(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<StoredDocumentOperation> {
    let status: String = row.get(7)?;
    let status = DocumentOperationStatus::from_str(&status).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            7,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
        )
    })?;
    Ok(StoredDocumentOperation {
        operation_id: row.get(0)?,
        conversation_id: row.get(1)?,
        request_message_id: row.get(2)?,
        document_id: row.get(3)?,
        base_job_id: row.get(4)?,
        base_version_id: row.get(5)?,
        intent_summary: row.get(6)?,
        status,
        current_attempt: row.get::<_, i64>(8)? as u32,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn non_empty(value: &str) -> Option<&str> {
    (!value.trim().is_empty()).then_some(value)
}
