use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension};

use crate::models::domain::{DocumentOperationStatus, DocumentOperationWorkspaceState};

use super::super::Db;
use super::attempts::decode_attempt;
use super::operations::load_operation;
use super::transitions::persist_state_transition;
use super::{CommitDocumentCandidateResult, DocumentVersionRecord};

impl Db {
    pub fn get_active_document_version_id(&self, document_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        let version_id = conn
            .query_row(
                "SELECT active_version_id FROM documents WHERE document_id = ?1",
                params![document_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        Ok(version_id)
    }

    pub fn get_document_version_for_operation(
        &self,
        operation_id: &str,
    ) -> Result<Option<DocumentVersionRecord>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT version_id, document_id, base_version_id, operation_id,
                   source_job_id, artifact_key, content_sha256, status,
                   created_at, committed_at
            FROM document_versions WHERE operation_id = ?1
            "#,
            params![operation_id],
            row_to_version,
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn get_document_version(&self, version_id: &str) -> Result<Option<DocumentVersionRecord>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT version_id, document_id, base_version_id, operation_id,
                   source_job_id, artifact_key, content_sha256, status,
                   created_at, committed_at
            FROM document_versions WHERE version_id = ?1
            "#,
            params![version_id],
            row_to_version,
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn list_document_versions(
        &self,
        document_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<DocumentVersionRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT version_id, document_id, base_version_id, operation_id,
                   source_job_id, artifact_key, content_sha256, status,
                   created_at, committed_at
            FROM document_versions
            WHERE document_id = ?1
            ORDER BY created_at DESC, version_id DESC
            LIMIT ?2 OFFSET ?3
            "#,
        )?;
        let rows = stmt.query_map(
            params![document_id, i64::from(limit), i64::from(offset)],
            row_to_version,
        )?;
        let mut versions = Vec::new();
        for row in rows {
            versions.push(row?);
        }
        Ok(versions)
    }

    pub fn count_document_versions(&self, document_id: &str) -> Result<u64> {
        let conn = self.connect()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM document_versions WHERE document_id = ?1",
            params![document_id],
            |row| row.get(0),
        )?;
        Ok(count.max(0) as u64)
    }

    pub fn publish_document_candidate(
        &self,
        version: &DocumentVersionRecord,
        next: &DocumentOperationWorkspaceState,
    ) -> Result<()> {
        if next.status != DocumentOperationStatus::ResultReady {
            bail!("candidate publication requires result_ready state");
        }
        if version.status != "candidate"
            || version.version_id.trim().is_empty()
            || version.artifact_key.trim().is_empty()
        {
            bail!("candidate version identity is incomplete");
        }
        if next.candidate_pdf_sha256.as_deref() != Some(version.content_sha256.as_str()) {
            bail!("candidate version hash does not match operation state");
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
            bail!("candidate publication requires a valid validating transition");
        }
        let operation = load_operation(&tx, &next.operation_id)?;
        if operation.document_id != version.document_id
            || operation.base_version_id != version.base_version_id
            || operation.operation_id != version.operation_id
        {
            bail!("candidate version identity does not match document operation");
        }
        tx.execute(
            r#"
            INSERT INTO document_versions (
                version_id, document_id, base_version_id, operation_id,
                source_job_id, artifact_key, content_sha256, status,
                created_at, committed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'candidate', ?8, NULL)
            "#,
            params![
                version.version_id,
                version.document_id,
                version.base_version_id,
                version.operation_id,
                version.source_job_id,
                version.artifact_key,
                version.content_sha256,
                version.created_at,
            ],
        )?;
        persist_state_transition(
            &tx,
            &current.state.status,
            next,
            "candidate_published",
            r#"{"candidate_ready":true}"#,
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn commit_document_candidate(
        &self,
        next: &DocumentOperationWorkspaceState,
    ) -> Result<CommitDocumentCandidateResult> {
        if next.status != DocumentOperationStatus::Committed {
            bail!("candidate commit requires committed state");
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let operation = load_operation(&tx, &next.operation_id)?;
        if operation.status != DocumentOperationStatus::ResultReady {
            bail!("document operation is not result_ready");
        }
        let version: DocumentVersionRecord = tx.query_row(
            r#"
            SELECT version_id, document_id, base_version_id, operation_id,
                   source_job_id, artifact_key, content_sha256, status,
                   created_at, committed_at
            FROM document_versions WHERE operation_id = ?1
            "#,
            params![next.operation_id],
            row_to_version,
        )?;
        if version.status != "candidate" {
            bail!("document version is not a candidate");
        }

        let changed = tx.execute(
            r#"
            UPDATE documents
            SET active_version_id = ?1, updated_at = ?2
            WHERE document_id = ?3 AND active_version_id IS ?4
            "#,
            params![
                version.version_id,
                next.updated_at,
                operation.document_id,
                operation.base_version_id,
            ],
        )?;
        if changed == 0 {
            return Ok(CommitDocumentCandidateResult::StaleBase);
        }

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
            bail!("invalid candidate commit transition");
        }
        tx.execute(
            r#"
            UPDATE document_versions
            SET status = 'committed', committed_at = ?1
            WHERE version_id = ?2
            "#,
            params![next.updated_at, version.version_id],
        )?;
        persist_state_transition(
            &tx,
            &current.state.status,
            next,
            "candidate_committed",
            r#"{"committed":true}"#,
        )?;
        tx.commit()?;
        Ok(CommitDocumentCandidateResult::Committed)
    }
}

fn row_to_version(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentVersionRecord> {
    Ok(DocumentVersionRecord {
        version_id: row.get(0)?,
        document_id: row.get(1)?,
        base_version_id: row.get(2)?,
        operation_id: row.get(3)?,
        source_job_id: row.get(4)?,
        artifact_key: row.get(5)?,
        content_sha256: row.get(6)?,
        status: row.get(7)?,
        created_at: row.get(8)?,
        committed_at: row.get(9)?,
    })
}
