use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde_json::json;

use super::events::{append_stage_observation_event, append_state_event};
use super::tx::{assert_cursor, stage_checkpoint, validate_identity};
use super::types::{PipelineAttemptCursor, PipelineCheckpoint, PipelineStageObservation};
use crate::db::Db;
use crate::models::domain::now_iso;

impl Db {
    /// Commits the latest worker stage observation under the attempt fencing
    /// token, then derives the public progress event in the same transaction.
    /// `activate_stage=false` records a background lane (currently render
    /// prewarm) without completing or replacing the attempt's main stage.
    pub fn observe_pipeline_stage(
        &self,
        cursor: &PipelineAttemptCursor,
        stage_key: &str,
        stage_order: u32,
        activate_stage: bool,
        observation: &PipelineStageObservation,
    ) -> Result<PipelineAttemptCursor> {
        validate_identity("stage_key", stage_key)?;
        validate_identity("raw_stage", &observation.raw_stage)?;
        if !matches!(
            observation.event_type.as_str(),
            "stage_transition" | "stage_progress"
        ) {
            bail!(
                "unsupported pipeline stage observation event: {}",
                observation.event_type
            );
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        assert_cursor(&tx, cursor)?;
        if activate_stage && cursor.stage_key != stage_key {
            let current_order = tx
                .query_row(
                    r#"
                    SELECT stage_order FROM pipeline_stages
                    WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                    "#,
                    params![cursor.job_id, cursor.attempt, cursor.stage_key],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?
                .map(|value| value as u32)
                .unwrap_or(0);
            if stage_order < current_order {
                bail!(
                    "pipeline stage order regressed for job {}: {}({}) -> {}({})",
                    cursor.job_id,
                    cursor.stage_key,
                    current_order,
                    stage_key,
                    stage_order
                );
            }
        }

        let existing = tx
            .query_row(
                r#"
                SELECT producer_seq, raw_stage, substage, stage_detail,
                       progress_current, progress_total, progress_unit,
                       observation_payload_json
                FROM pipeline_stages
                WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                "#,
                params![cursor.job_id, cursor.attempt, stage_key],
                |row| {
                    Ok((
                        row.get::<_, Option<i64>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<i64>>(4)?,
                        row.get::<_, Option<i64>>(5)?,
                        row.get::<_, Option<String>>(6)?,
                        row.get::<_, String>(7)?,
                    ))
                },
            )
            .optional()?;
        if let Some((Some(previous_seq), ..)) = existing.as_ref() {
            if observation.producer_seq <= *previous_seq as u64 {
                bail!(
                    "pipeline stage observation sequence regressed for job {} stage {}: {} <= {}",
                    cursor.job_id,
                    stage_key,
                    observation.producer_seq,
                    previous_seq
                );
            }
        }
        let mut accepted_observation = observation.clone();
        if let Some((
            _,
            _,
            previous_substage,
            _,
            previous_current,
            previous_total,
            previous_unit,
            _,
        )) = existing.as_ref()
        {
            let same_progress_lane = previous_substage.as_deref()
                == accepted_observation.substage.as_deref()
                && previous_total == &accepted_observation.progress_total
                && previous_unit.as_deref() == accepted_observation.progress_unit.as_deref();
            if same_progress_lane {
                if let (Some(previous), Some(incoming)) =
                    (*previous_current, accepted_observation.progress_current)
                {
                    accepted_observation.progress_current = Some(previous.max(incoming));
                }
            }
        }

        let next_generation = cursor.generation + 1;
        let timestamp = now_iso();
        if activate_stage && cursor.stage_key != stage_key {
            tx.execute(
                r#"
                UPDATE pipeline_stages
                SET generation = ?1, status = 'completed', updated_at = ?2,
                    finished_at = COALESCE(finished_at, ?2)
                WHERE job_id = ?3 AND attempt = ?4 AND stage_key = ?5
                  AND status = 'running'
                "#,
                params![
                    next_generation,
                    timestamp,
                    cursor.job_id,
                    cursor.attempt,
                    cursor.stage_key,
                ],
            )?;
        }
        let payload_json = serde_json::to_string(&accepted_observation.payload)?;
        tx.execute(
            r#"
            INSERT INTO pipeline_stages (
                job_id, attempt, stage_key, stage_order, generation, status,
                raw_stage, substage, stage_detail, progress_current,
                progress_total, progress_unit, producer_seq,
                observation_payload_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'running', ?6, ?7, ?8, ?9,
                      ?10, ?11, ?12, ?13, ?14, ?14)
            ON CONFLICT(job_id, attempt, stage_key) DO UPDATE SET
                stage_order = excluded.stage_order,
                generation = excluded.generation,
                status = 'running',
                raw_stage = excluded.raw_stage,
                substage = excluded.substage,
                stage_detail = excluded.stage_detail,
                progress_current = excluded.progress_current,
                progress_total = excluded.progress_total,
                progress_unit = excluded.progress_unit,
                producer_seq = excluded.producer_seq,
                observation_payload_json = excluded.observation_payload_json,
                updated_at = excluded.updated_at,
                finished_at = NULL
            "#,
            params![
                cursor.job_id,
                cursor.attempt,
                stage_key,
                stage_order,
                next_generation,
                accepted_observation.raw_stage,
                accepted_observation.substage,
                accepted_observation.stage_detail,
                accepted_observation.progress_current,
                accepted_observation.progress_total,
                accepted_observation.progress_unit,
                accepted_observation.producer_seq,
                payload_json,
                timestamp,
            ],
        )?;
        let current_stage = if activate_stage {
            stage_key
        } else {
            cursor.stage_key.as_str()
        };
        let changed = tx.execute(
            r#"
            UPDATE pipeline_attempts
            SET generation = ?1, current_stage = ?2, updated_at = ?3
            WHERE job_id = ?4 AND attempt = ?5 AND generation = ?6
              AND worker_id = ?7 AND status = 'running'
            "#,
            params![
                next_generation,
                current_stage,
                timestamp,
                cursor.job_id,
                cursor.attempt,
                cursor.generation,
                cursor.worker_id,
            ],
        )?;
        if changed != 1 {
            bail!("stale pipeline generation while observing stage");
        }
        append_stage_observation_event(
            &tx,
            cursor,
            next_generation,
            stage_key,
            activate_stage,
            &accepted_observation,
        )?;
        tx.commit()?;
        Ok(PipelineAttemptCursor {
            job_id: cursor.job_id.clone(),
            attempt: cursor.attempt,
            generation: next_generation,
            worker_id: cursor.worker_id.clone(),
            stage_key: current_stage.to_string(),
        })
    }

    pub fn complete_pipeline_stage(
        &self,
        cursor: &PipelineAttemptCursor,
    ) -> Result<PipelineCheckpoint> {
        transition_stage(self, cursor, "completed", "pipeline_stage_completed")
    }
}

fn transition_stage(
    db: &Db,
    cursor: &PipelineAttemptCursor,
    status: &str,
    event: &str,
) -> Result<PipelineCheckpoint> {
    let mut conn = db.connect()?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    assert_cursor(&tx, cursor)?;
    let previous = stage_checkpoint(&tx, cursor)?;
    let next_generation = cursor.generation + 1;
    let timestamp = now_iso();
    tx.execute(
        r#"
        UPDATE pipeline_stages
        SET generation = ?1, status = ?2, updated_at = ?3, finished_at = ?3
        WHERE job_id = ?4 AND attempt = ?5 AND stage_key = ?6
        "#,
        params![
            next_generation,
            status,
            timestamp,
            cursor.job_id,
            cursor.attempt,
            cursor.stage_key,
        ],
    )?;
    tx.execute(
        r#"
        UPDATE pipeline_attempts
        SET generation = ?1, updated_at = ?2
        WHERE job_id = ?3 AND attempt = ?4 AND generation = ?5
          AND worker_id = ?6 AND status = 'running'
        "#,
        params![
            next_generation,
            timestamp,
            cursor.job_id,
            cursor.attempt,
            cursor.generation,
            cursor.worker_id,
        ],
    )?;
    append_state_event(
        &tx,
        &cursor.job_id,
        &cursor.stage_key,
        event,
        &format!("pipeline stage {} {status}", cursor.stage_key),
        json!({
            "attempt": cursor.attempt,
            "generation": next_generation,
            "stage": cursor.stage_key,
            "last_committed_unit_key": previous.last_committed_unit_key,
            "last_committed_unit_order": previous.last_committed_unit_order,
            "last_page_hash": previous.last_page_hash,
        }),
    )?;
    tx.commit()?;
    Ok(PipelineCheckpoint {
        generation: next_generation,
        ..previous
    })
}
