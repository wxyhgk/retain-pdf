use crate::models::domain::{now_iso, DocumentOperationStatus, DocumentOperationWorkspaceState};
use anyhow::Result;

use super::super::Db;

impl Db {
    pub fn recover_unreceipted_document_operations(&self) -> Result<Vec<String>> {
        let states = self.list_unreceipted_document_operation_attempts()?;
        let mut recovered = Vec::new();
        for mut state in states {
            state.status = DocumentOperationStatus::Ambiguous;
            state.detail =
                Some("dispatch intent is durable but no executor receipt is available".to_string());
            state.updated_at = now_iso();
            self.transition_document_operation(
                &state,
                "recovered_unreceipted_dispatch",
                r#"{"requires_confirmation":true}"#,
            )?;
            recovered.push(state.operation_id);
        }
        Ok(recovered)
    }

    pub fn list_unreceipted_document_operation_attempts(
        &self,
    ) -> Result<Vec<DocumentOperationWorkspaceState>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT state_json
            FROM document_operation_attempts
            WHERE status = 'queued'
              AND dispatch_intent_at IS NOT NULL
              AND dispatch_receipt_json IS NULL
            ORDER BY updated_at
            "#,
        )?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut states = Vec::new();
        for row in rows {
            let state_json = row?;
            states.push(serde_json::from_str::<DocumentOperationWorkspaceState>(
                &state_json,
            )?);
        }
        Ok(states)
    }
}
