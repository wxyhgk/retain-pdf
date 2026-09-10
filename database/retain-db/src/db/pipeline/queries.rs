use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use super::types::{
    PipelineCheckpoint, PipelineDispatchRecord, PipelineStageState, PipelineUnitRecord,
};
use crate::db::Db;

impl Db {
    pub fn has_pipeline_attempt(&self, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let exists = conn
            .query_row(
                "SELECT 1 FROM pipeline_attempts WHERE job_id = ?1 LIMIT 1",
                params![job_id],
                |_| Ok(()),
            )
            .optional()?
            .is_some();
        Ok(exists)
    }

    pub fn has_running_pipeline_attempt(&self, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let exists = conn
            .query_row(
                r#"
                SELECT 1 FROM pipeline_attempts
                WHERE job_id = ?1 AND status = 'running'
                ORDER BY attempt DESC LIMIT 1
                "#,
                params![job_id],
                |_| Ok(()),
            )
            .optional()?
            .is_some();
        Ok(exists)
    }

    pub fn running_pipeline_stage_key(&self, job_id: &str) -> Result<Option<String>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT current_stage FROM pipeline_attempts
            WHERE job_id = ?1 AND status = 'running'
            ORDER BY attempt DESC LIMIT 1
            "#,
            params![job_id],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map(|value| value.flatten())
        .map_err(Into::into)
    }

    pub fn list_resumable_pipeline_job_ids(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let queued = serde_json::to_string(&crate::models::domain::JobStatusKind::Queued)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT DISTINCT jobs.job_id
            FROM jobs
            JOIN pipeline_attempts ON pipeline_attempts.job_id = jobs.job_id
            WHERE jobs.status_json = ?1 AND pipeline_attempts.status = 'running'
            ORDER BY jobs.updated_at, jobs.job_id
            "#,
        )?;
        let rows = stmt.query_map(params![queued], |row| row.get::<_, String>(0))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    /// Queued jobs that never started a durable attempt and therefore are
    /// invisible to [`Self::list_resumable_pipeline_job_ids`].
    ///
    /// Startup-only contract: right after a runtime (re)start no driver task
    /// exists for any queued job, so every id returned here is safe to
    /// re-drive exactly once. Never call this outside startup: a live driver
    /// may own the job and a second driver would duplicate execution.
    pub fn list_stuck_queued_job_ids(&self) -> Result<Vec<String>> {
        let conn = self.connect()?;
        let queued = serde_json::to_string(&crate::models::domain::JobStatusKind::Queued)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT jobs.job_id
            FROM jobs
            WHERE jobs.status_json = ?1
              AND NOT EXISTS (
                SELECT 1 FROM pipeline_attempts
                WHERE pipeline_attempts.job_id = jobs.job_id
                  AND pipeline_attempts.status = 'running'
              )
            ORDER BY jobs.updated_at, jobs.job_id
            "#,
        )?;
        let rows = stmt.query_map(params![queued], |row| row.get::<_, String>(0))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    pub fn running_pipeline_stage_state(&self, job_id: &str) -> Result<Option<PipelineStageState>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT a.attempt, a.current_stage, s.generation, s.status,
                   s.raw_stage, s.substage, s.stage_detail,
                   s.progress_current, s.progress_total, s.progress_unit,
                   s.producer_seq, s.observation_payload_json
            FROM pipeline_attempts a
            JOIN pipeline_stages s
              ON s.job_id = a.job_id AND s.attempt = a.attempt
             AND s.stage_key = a.current_stage
            WHERE a.job_id = ?1 AND a.status = 'running'
            ORDER BY a.attempt DESC LIMIT 1
            "#,
            params![job_id],
            |row| {
                let payload_json: String = row.get(11)?;
                Ok(PipelineStageState {
                    job_id: job_id.to_string(),
                    attempt: row.get::<_, i64>(0)? as u32,
                    stage_key: row.get(1)?,
                    generation: row.get::<_, i64>(2)? as u64,
                    status: row.get(3)?,
                    raw_stage: row.get(4)?,
                    substage: row.get(5)?,
                    stage_detail: row.get(6)?,
                    progress_current: row.get(7)?,
                    progress_total: row.get(8)?,
                    progress_unit: row.get(9)?,
                    producer_seq: row.get::<_, Option<i64>>(10)?.map(|value| value as u64),
                    payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn pipeline_checkpoint(
        &self,
        job_id: &str,
        attempt: u32,
        stage_key: &str,
    ) -> Result<Option<PipelineCheckpoint>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT a.generation, s.last_committed_unit_key,
                   s.last_committed_unit_order, s.last_page_hash
            FROM pipeline_attempts a
            JOIN pipeline_stages s ON s.job_id = a.job_id AND s.attempt = a.attempt
            WHERE a.job_id = ?1 AND a.attempt = ?2 AND s.stage_key = ?3
            "#,
            params![job_id, attempt, stage_key],
            |row| {
                Ok(PipelineCheckpoint {
                    job_id: job_id.to_string(),
                    attempt,
                    generation: row.get::<_, i64>(0)? as u64,
                    stage_key: stage_key.to_string(),
                    last_committed_unit_key: row.get(1)?,
                    last_committed_unit_order: row.get::<_, Option<i64>>(2)?.map(|v| v as u64),
                    last_page_hash: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn list_pipeline_units(
        &self,
        job_id: &str,
        attempt: u32,
        stage_key: &str,
    ) -> Result<Vec<PipelineUnitRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT unit_key, unit_order, generation, producer_generation,
                   page_index, page_hash, payload_json
            FROM pipeline_units
            WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
            ORDER BY unit_order, unit_key
            "#,
        )?;
        let rows = stmt.query_map(params![job_id, attempt, stage_key], |row| {
            let payload_json: String = row.get(6)?;
            Ok(PipelineUnitRecord {
                attempt,
                unit_key: row.get(0)?,
                unit_order: row.get::<_, i64>(1)? as u64,
                generation: row.get::<_, i64>(2)? as u64,
                producer_generation: row.get::<_, Option<i64>>(3)?.map(|v| v as u64),
                page_index: row.get::<_, Option<i64>>(4)?.map(|v| v as u32),
                page_hash: row.get(5)?,
                payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(Into::into)
    }

    pub fn latest_pipeline_unit_for_page(
        &self,
        job_id: &str,
        stage_key: &str,
        page_index: u32,
    ) -> Result<Option<PipelineUnitRecord>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT attempt, unit_key, unit_order, generation, producer_generation,
                   page_index, page_hash, payload_json
            FROM pipeline_units
            WHERE job_id = ?1 AND stage_key = ?2 AND page_index = ?3
              AND status = 'committed'
            ORDER BY attempt DESC, generation DESC
            LIMIT 1
            "#,
            params![job_id, stage_key, page_index],
            |row| {
                let payload_json: String = row.get(7)?;
                Ok(PipelineUnitRecord {
                    attempt: row.get::<_, i64>(0)? as u32,
                    unit_key: row.get(1)?,
                    unit_order: row.get::<_, i64>(2)? as u64,
                    generation: row.get::<_, i64>(3)? as u64,
                    producer_generation: row.get::<_, Option<i64>>(4)?.map(|v| v as u64),
                    page_index: row.get::<_, Option<i64>>(5)?.map(|v| v as u32),
                    page_hash: row.get(6)?,
                    payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn pipeline_stage_state(
        &self,
        job_id: &str,
        attempt: u32,
        stage_key: &str,
    ) -> Result<Option<PipelineStageState>> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT generation, status, raw_stage, substage, stage_detail,
                   progress_current, progress_total, progress_unit,
                   producer_seq, observation_payload_json
            FROM pipeline_stages
            WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
            "#,
            params![job_id, attempt, stage_key],
            |row| {
                let payload_json: String = row.get(9)?;
                Ok(PipelineStageState {
                    job_id: job_id.to_string(),
                    attempt,
                    stage_key: stage_key.to_string(),
                    generation: row.get::<_, i64>(0)? as u64,
                    status: row.get(1)?,
                    raw_stage: row.get(2)?,
                    substage: row.get(3)?,
                    stage_detail: row.get(4)?,
                    progress_current: row.get(5)?,
                    progress_total: row.get(6)?,
                    progress_unit: row.get(7)?,
                    producer_seq: row.get::<_, Option<i64>>(8)?.map(|value| value as u64),
                    payload: serde_json::from_str(&payload_json).unwrap_or(Value::Null),
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn pipeline_dispatch(
        &self,
        job_id: &str,
        attempt: u32,
        dispatch_key: &str,
    ) -> Result<Option<PipelineDispatchRecord>> {
        let conn = self.connect()?;
        dispatch_record_by_identity(&conn, job_id, attempt, dispatch_key)
    }

    pub fn latest_pipeline_dispatch(
        &self,
        job_id: &str,
        dispatch_key: &str,
    ) -> Result<Option<PipelineDispatchRecord>> {
        super::tx::validate_identity("dispatch_key", dispatch_key)?;
        let conn = self.connect()?;
        let attempt = conn
            .query_row(
                r#"
                SELECT attempt FROM pipeline_dispatches
                WHERE job_id = ?1 AND dispatch_key = ?2
                ORDER BY attempt DESC LIMIT 1
                "#,
                params![job_id, dispatch_key],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        attempt
            .map(|attempt| dispatch_record_by_identity(&conn, job_id, attempt as u32, dispatch_key))
            .transpose()
            .map(Option::flatten)
    }
}

pub(super) fn dispatch_record_by_identity(
    conn: &Connection,
    job_id: &str,
    attempt: u32,
    dispatch_key: &str,
) -> Result<Option<PipelineDispatchRecord>> {
    conn.query_row(
        r#"
        SELECT stage_key, generation, provider, operation, request_hash,
               status, receipt_json, ambiguity_reason
        FROM pipeline_dispatches
        WHERE job_id = ?1 AND attempt = ?2 AND dispatch_key = ?3
        "#,
        params![job_id, attempt, dispatch_key],
        |row| {
            let receipt_json: Option<String> = row.get(6)?;
            Ok(PipelineDispatchRecord {
                job_id: job_id.to_string(),
                attempt,
                stage_key: row.get(0)?,
                dispatch_key: dispatch_key.to_string(),
                generation: row.get::<_, i64>(1)? as u64,
                provider: row.get(2)?,
                operation: row.get(3)?,
                request_hash: row.get(4)?,
                status: row.get(5)?,
                receipt: receipt_json
                    .as_deref()
                    .and_then(|value| serde_json::from_str(value).ok()),
                ambiguity_reason: row.get(7)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}
