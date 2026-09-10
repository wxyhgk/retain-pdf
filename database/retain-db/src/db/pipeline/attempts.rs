use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde_json::json;

use super::events::append_state_event;
use super::tx::{validate_identity, ATTEMPT_RUNNING};
use super::types::PipelineAttemptCursor;
use crate::db::Db;
use crate::models::domain::now_iso;

impl Db {
    /// Claims the latest active attempt, or creates the next attempt after a
    /// terminal one. Claiming advances `generation`, fencing any previous
    /// worker that still has stdout to publish.
    pub fn acquire_pipeline_attempt(
        &self,
        job_id: &str,
        worker_id: &str,
        stage_key: &str,
        stage_order: u32,
    ) -> Result<PipelineAttemptCursor> {
        validate_identity("job_id", job_id)?;
        validate_identity("worker_id", worker_id)?;
        validate_identity("stage_key", stage_key)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let latest = tx
            .query_row(
                r#"
                SELECT attempt, generation, status, current_stage
                FROM pipeline_attempts
                WHERE job_id = ?1
                ORDER BY attempt DESC
                LIMIT 1
                "#,
                params![job_id],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .optional()?;
        let timestamp = now_iso();
        let (attempt, generation, event, effective_stage_key, effective_stage_order) = match latest
        {
            Some((attempt, generation, status, current_stage)) if status == ATTEMPT_RUNNING => {
                let effective_stage_key = current_stage
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| stage_key.to_string());
                let effective_stage_order = tx
                    .query_row(
                        r#"
                        SELECT stage_order FROM pipeline_stages
                        WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                        "#,
                        params![job_id, attempt, effective_stage_key],
                        |row| row.get::<_, i64>(0),
                    )
                    .optional()?
                    .map(|value| value as u32)
                    .unwrap_or(stage_order);
                let next_generation = generation + 1;
                let changed = tx.execute(
                    r#"
                    UPDATE pipeline_attempts
                    SET generation = ?1, worker_id = ?2, current_stage = ?3, updated_at = ?4
                    WHERE job_id = ?5 AND attempt = ?6 AND generation = ?7 AND status = 'running'
                    "#,
                    params![
                        next_generation,
                        worker_id,
                        effective_stage_key,
                        timestamp,
                        job_id,
                        attempt,
                        generation
                    ],
                )?;
                if changed != 1 {
                    bail!("pipeline attempt claim raced for job {job_id}");
                }
                (
                    attempt,
                    next_generation,
                    "pipeline_attempt_resumed",
                    effective_stage_key,
                    effective_stage_order,
                )
            }
            Some((attempt, _, _, _)) => {
                let next_attempt = attempt + 1;
                tx.execute(
                    r#"
                    INSERT INTO pipeline_attempts (
                        job_id, attempt, generation, status, worker_id, current_stage,
                        created_at, updated_at
                    ) VALUES (?1, ?2, 1, 'running', ?3, ?4, ?5, ?5)
                    "#,
                    params![job_id, next_attempt, worker_id, stage_key, timestamp],
                )?;
                (
                    next_attempt,
                    1,
                    "pipeline_attempt_started",
                    stage_key.to_string(),
                    stage_order,
                )
            }
            None => {
                tx.execute(
                    r#"
                    INSERT INTO pipeline_attempts (
                        job_id, attempt, generation, status, worker_id, current_stage,
                        created_at, updated_at
                    ) VALUES (?1, 1, 1, 'running', ?2, ?3, ?4, ?4)
                    "#,
                    params![job_id, worker_id, stage_key, timestamp],
                )?;
                (
                    1,
                    1,
                    "pipeline_attempt_started",
                    stage_key.to_string(),
                    stage_order,
                )
            }
        };
        tx.execute(
            r#"
            INSERT INTO pipeline_stages (
                job_id, attempt, stage_key, stage_order, generation, status,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'running', ?6, ?6)
            ON CONFLICT(job_id, attempt, stage_key) DO UPDATE SET
                generation = excluded.generation,
                status = 'running',
                updated_at = excluded.updated_at,
                finished_at = NULL
            "#,
            params![
                job_id,
                attempt,
                effective_stage_key,
                effective_stage_order,
                generation,
                timestamp
            ],
        )?;
        append_state_event(
            &tx,
            job_id,
            &effective_stage_key,
            event,
            &format!("pipeline attempt {attempt} claimed by {worker_id}"),
            json!({
                "attempt": attempt,
                "generation": generation,
                "worker_id": worker_id,
                "stage": effective_stage_key,
                "stage_order": effective_stage_order,
            }),
        )?;
        tx.commit()?;
        Ok(PipelineAttemptCursor {
            job_id: job_id.to_string(),
            attempt: attempt as u32,
            generation: generation as u64,
            worker_id: worker_id.to_string(),
            stage_key: effective_stage_key,
        })
    }

    /// Finalizes the active attempt after the job-row CAS has accepted the
    /// terminal result. This coordinator action also closes any still-running
    /// stages, which covers stages whose workers do not yet emit unit commits.
    pub fn finish_latest_pipeline_attempt(&self, job_id: &str, status: &str) -> Result<bool> {
        if !matches!(status, "succeeded" | "failed" | "canceled") {
            bail!("invalid terminal pipeline attempt status: {status}");
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current = tx
            .query_row(
                r#"
                SELECT attempt, generation, current_stage
                FROM pipeline_attempts
                WHERE job_id = ?1 AND status = 'running'
                ORDER BY attempt DESC LIMIT 1
                "#,
                params![job_id],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .optional()?;
        let Some((attempt, generation, current_stage)) = current else {
            return Ok(false);
        };
        let timestamp = now_iso();
        let next_generation = generation + 1;
        tx.execute(
            r#"
            UPDATE pipeline_attempts
            SET generation = ?1, status = ?2, updated_at = ?3, finished_at = ?3
            WHERE job_id = ?4 AND attempt = ?5 AND generation = ?6 AND status = 'running'
            "#,
            params![
                next_generation,
                status,
                timestamp,
                job_id,
                attempt,
                generation
            ],
        )?;
        let stage_status = if status == "succeeded" {
            "completed"
        } else {
            status
        };
        tx.execute(
            r#"
            UPDATE pipeline_stages
            SET generation = ?1, status = ?2, updated_at = ?3, finished_at = ?3
            WHERE job_id = ?4 AND attempt = ?5 AND status = 'running'
            "#,
            params![next_generation, stage_status, timestamp, job_id, attempt],
        )?;
        let stage = current_stage.unwrap_or_else(|| "pipeline".to_string());
        append_state_event(
            &tx,
            job_id,
            &stage,
            "pipeline_attempt_terminal",
            &format!("pipeline attempt {attempt} {status}"),
            json!({
                "attempt": attempt,
                "generation": next_generation,
                "status": status,
                "stage": stage,
            }),
        )?;
        tx.commit()?;
        Ok(true)
    }
}
