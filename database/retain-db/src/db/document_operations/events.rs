use std::str::FromStr;

use anyhow::Result;
use rusqlite::{params, Transaction};

use crate::models::domain::DocumentOperationStatus;

use super::super::Db;
use super::DocumentOperationEventRecord;

impl Db {
    pub fn list_document_operation_events(
        &self,
        operation_id: &str,
    ) -> Result<Vec<DocumentOperationEventRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT seq, attempt, ts, event, status, payload_json
            FROM document_operation_events
            WHERE operation_id = ?1 ORDER BY seq
            "#,
        )?;
        let rows = stmt.query_map(params![operation_id], |row| {
            let status: String = row.get(4)?;
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                status,
                row.get::<_, String>(5)?,
            ))
        })?;
        let mut events = Vec::new();
        for row in rows {
            let (seq, attempt, ts, event, status, payload_json) = row?;
            events.push(DocumentOperationEventRecord {
                seq: seq as u64,
                attempt: attempt as u32,
                ts,
                event,
                status: DocumentOperationStatus::from_str(&status).map_err(anyhow::Error::msg)?,
                payload_json,
            });
        }
        Ok(events)
    }
}

pub(super) fn append_event(
    tx: &Transaction<'_>,
    operation_id: &str,
    attempt: u32,
    ts: &str,
    event: &str,
    status: &DocumentOperationStatus,
    payload_json: &str,
) -> Result<()> {
    let seq: i64 = tx.query_row(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM document_operation_events WHERE operation_id = ?1",
        params![operation_id],
        |row| row.get(0),
    )?;
    tx.execute(
        r#"
        INSERT INTO document_operation_events (
            operation_id, seq, attempt, ts, event, status, payload_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![
            operation_id,
            seq,
            attempt,
            ts,
            event,
            status.as_str(),
            payload_json
        ],
    )?;
    Ok(())
}
