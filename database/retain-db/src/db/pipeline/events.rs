use anyhow::Result;
use rusqlite::{params, Transaction};
use serde_json::{json, Value};

use super::types::{PipelineAttemptCursor, PipelineStageObservation};
use crate::models::domain::now_iso;

pub(super) fn append_stage_observation_event(
    tx: &Transaction<'_>,
    cursor: &PipelineAttemptCursor,
    generation: u64,
    stage_key: &str,
    activate_stage: bool,
    observation: &PipelineStageObservation,
) -> Result<()> {
    let next_seq: i64 = tx.query_row(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM events WHERE job_id = ?1",
        params![cursor.job_id],
        |row| row.get(0),
    )?;
    let timestamp = now_iso();
    let payload = json!({
        "raw_source_kind": "pipeline_state",
        "authority": {
            "attempt": cursor.attempt,
            "generation": generation,
            "stage_key": stage_key,
            "producer_seq": observation.producer_seq,
            "producer_ts": observation.producer_ts,
            "lane": if activate_stage { "main" } else { "background" },
        },
        "observation": observation.payload,
    });
    tx.execute(
        r#"
        INSERT INTO events (
            job_id, seq, ts, level, stage, stage_detail, provider,
            provider_stage, event, event_type, progress_current,
            progress_total, payload_json, message
        ) VALUES (?1, ?2, ?3, 'info', ?4, ?5, ?6, ?7, ?8, ?8, ?9,
                  ?10, ?11, ?12)
        "#,
        params![
            cursor.job_id,
            next_seq,
            timestamp,
            observation.raw_stage,
            observation.stage_detail,
            observation.provider,
            observation
                .substage
                .as_ref()
                .or(observation.provider_stage.as_ref()),
            observation.event_type,
            observation.progress_current,
            observation.progress_total,
            serde_json::to_string(&payload)?,
            observation.message,
        ],
    )?;
    Ok(())
}

pub(in crate::db) fn append_state_event(
    tx: &Transaction<'_>,
    job_id: &str,
    stage: &str,
    event: &str,
    message: &str,
    payload: Value,
) -> Result<()> {
    let next_seq: i64 = tx.query_row(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM events WHERE job_id = ?1",
        params![job_id],
        |row| row.get(0),
    )?;
    let timestamp = now_iso();
    tx.execute(
        r#"
        INSERT INTO events (
            job_id, seq, ts, level, stage, stage_detail, event, event_type,
            payload_json, message
        ) VALUES (?1, ?2, ?3, 'info', ?4, ?5, ?6, ?6, ?7, ?8)
        "#,
        params![
            job_id,
            next_seq,
            timestamp,
            stage,
            message,
            event,
            serde_json::to_string(&payload)?,
            message,
        ],
    )?;
    Ok(())
}
