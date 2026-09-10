use anyhow::Result;
use rusqlite::params;
use serde_json::Value;

use super::rows::row_to_job_event;
use super::{Db, PipelineCommitEventRecord};
use crate::models::api::JobEventRecord;
use crate::models::domain::{event_progress_unit, job_user_stage, now_iso};

impl Db {
    pub fn append_event(
        &self,
        job_id: &str,
        level: &str,
        stage: Option<String>,
        stage_detail: Option<String>,
        provider: Option<String>,
        provider_stage: Option<String>,
        event: &str,
        event_type: Option<String>,
        message: &str,
        progress_current: Option<i64>,
        progress_total: Option<i64>,
        payload: Option<Value>,
        retry_count: Option<u32>,
        elapsed_ms: Option<i64>,
    ) -> Result<JobEventRecord> {
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        let next_seq: i64 = tx.query_row(
            "SELECT COALESCE(MAX(seq), 0) + 1 FROM events WHERE job_id = ?1",
            params![job_id],
            |row| row.get(0),
        )?;
        let ts = now_iso();
        let payload_json = payload.as_ref().map(serde_json::to_string).transpose()?;
        let user_stage = job_user_stage(stage.as_deref()).map(str::to_string);
        let substage = provider_stage.clone();
        let progress_unit = Some(event_progress_unit(stage.as_deref(), event).to_string());
        tx.execute(
            r#"
            INSERT INTO events (
                job_id, seq, ts, level, stage, stage_detail, provider, provider_stage,
                event, event_type, progress_current, progress_total, payload_json, retry_count,
                elapsed_ms, message
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            "#,
            params![
                job_id,
                next_seq,
                ts,
                level,
                stage,
                stage_detail,
                provider,
                provider_stage,
                event,
                event_type,
                progress_current,
                progress_total,
                payload_json,
                retry_count.map(|value| value as i64),
                elapsed_ms,
                message
            ],
        )?;
        tx.commit()?;
        Ok(JobEventRecord {
            job_id: job_id.to_string(),
            seq: next_seq,
            ts: ts.clone(),
            created_at: ts,
            level: level.to_string(),
            lane: None,
            display_stage: None,
            user_stage,
            stage,
            substage,
            stage_detail,
            provider,
            provider_stage,
            event: event.to_string(),
            event_type: event_type.or_else(|| Some(event.to_string())),
            raw_event_type: Some(event.to_string()),
            raw: None,
            progress: None,
            message: message.to_string(),
            progress_current,
            progress_total,
            progress_unit,
            retry_count,
            elapsed_ms,
            payload,
        })
    }

    pub fn list_job_events(
        &self,
        job_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<JobEventRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                job_id, seq, ts, level, stage, stage_detail, provider, provider_stage,
                event, event_type, progress_current, progress_total, payload_json,
                retry_count, elapsed_ms, message
            FROM events
            WHERE job_id = ?1
            ORDER BY seq ASC
            LIMIT ?2 OFFSET ?3
            "#,
        )?;
        let rows = stmt.query_map(
            params![job_id, limit as i64, offset as i64],
            row_to_job_event,
        )?;
        let mut events = Vec::new();
        for row in rows {
            events.push(row?);
        }
        Ok(events)
    }

    /// Returns the authoritative event rows created in the same transaction as
    /// a committed translation unit. Unlike the presentation event list, these
    /// sequence numbers are never synthesized or reordered.
    pub fn list_translation_commit_events_after(
        &self,
        job_id: &str,
        after_seq: i64,
        limit: u32,
    ) -> Result<Vec<PipelineCommitEventRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT seq, payload_json
            FROM events
            WHERE job_id = ?1 AND seq > ?2
              AND event = 'pipeline_unit_committed' AND stage = 'translate'
            ORDER BY seq ASC
            LIMIT ?3
            "#,
        )?;
        let rows = stmt.query_map(params![job_id, after_seq.max(0), limit as i64], |row| {
            let payload_json: Option<String> = row.get(1)?;
            Ok(PipelineCommitEventRecord {
                seq: row.get(0)?,
                payload: payload_json
                    .and_then(|value| serde_json::from_str(&value).ok())
                    .unwrap_or(Value::Null),
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }
}
