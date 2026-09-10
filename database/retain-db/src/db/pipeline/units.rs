use std::collections::{HashMap, HashSet};

use anyhow::{bail, Result};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde_json::json;

use super::events::append_state_event;
use super::tx::{assert_cursor, stage_checkpoint, validate_identity, validate_sha256};
use super::types::{PipelineAttemptCursor, PipelineCheckpoint, PipelineUnitCommit};
use crate::db::Db;
use crate::models::domain::now_iso;

impl Db {
    /// Atomically commits one durable unit and advances the attempt fencing
    /// generation. The event row is inserted in the same transaction and is
    /// therefore a projection of committed state, never of raw stdout.
    pub fn commit_pipeline_unit(
        &self,
        cursor: &PipelineAttemptCursor,
        unit: &PipelineUnitCommit,
    ) -> Result<PipelineCheckpoint> {
        self.commit_pipeline_units(cursor, std::slice::from_ref(unit))
    }

    /// Atomically commits every durable unit emitted by one producer
    /// checkpoint. All units share one authoritative generation; either every
    /// page becomes visible to readers or none of them does.
    pub fn commit_pipeline_units(
        &self,
        cursor: &PipelineAttemptCursor,
        units: &[PipelineUnitCommit],
    ) -> Result<PipelineCheckpoint> {
        if units.is_empty() {
            bail!("pipeline unit batch must not be empty");
        }
        let mut unit_keys = HashSet::new();
        let mut unit_orders = HashMap::new();
        let producer_generation = units[0].producer_generation;
        for unit in units {
            validate_identity("unit_key", &unit.unit_key)?;
            validate_sha256("page_hash", &unit.page_hash)?;
            if unit.unit_order > i64::MAX as u64 {
                bail!("pipeline unit order exceeds SQLite INTEGER range");
            }
            if !unit_keys.insert(unit.unit_key.as_str()) {
                bail!(
                    "pipeline unit batch contains duplicate key {}",
                    unit.unit_key
                );
            }
            if let Some(previous_key) = unit_orders.insert(unit.unit_order, unit.unit_key.as_str())
            {
                bail!(
                    "pipeline unit order {} belongs to both {} and {}",
                    unit.unit_order,
                    previous_key,
                    unit.unit_key
                );
            }
            if unit.producer_generation != producer_generation {
                bail!("pipeline unit batch mixes producer generations");
            }
        }
        let mut conn = self.connect()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        assert_cursor(&tx, cursor)?;
        let previous = stage_checkpoint(&tx, cursor)?;
        let latest_producer_generation = tx.query_row(
            r#"
            SELECT MAX(producer_generation)
            FROM pipeline_units
            WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
            "#,
            params![cursor.job_id, cursor.attempt, cursor.stage_key],
            |row| row.get::<_, Option<i64>>(0),
        )?;
        if let (Some(incoming), Some(latest)) = (
            producer_generation,
            latest_producer_generation.map(|v| v as u64),
        ) {
            if incoming < latest {
                bail!(
                    "producer checkpoint generation regressed for job {}: {} < {}",
                    cursor.job_id,
                    incoming,
                    latest
                );
            }
            if incoming == latest {
                let mut duplicate_count = 0;
                for unit in units {
                    let duplicate = tx
                        .query_row(
                            r#"
                        SELECT 1 FROM pipeline_units
                        WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                          AND unit_key = ?4 AND page_hash = ?5
                          AND producer_generation = ?6 AND unit_order = ?7
                          AND page_index IS ?8
                        "#,
                            params![
                                cursor.job_id,
                                cursor.attempt,
                                cursor.stage_key,
                                unit.unit_key,
                                unit.page_hash,
                                incoming,
                                unit.unit_order as i64,
                                unit.page_index,
                            ],
                            |_| Ok(()),
                        )
                        .optional()?
                        .is_some();
                    duplicate_count += usize::from(duplicate);
                }
                if duplicate_count == units.len() {
                    return Ok(previous);
                }
                bail!(
                    "producer checkpoint generation {} conflicts for job {}",
                    incoming,
                    cursor.job_id
                );
            }
        }

        for unit in units {
            let existing = tx
                .query_row(
                    r#"
                    SELECT unit_order FROM pipeline_units
                    WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                      AND unit_key = ?4
                    "#,
                    params![
                        cursor.job_id,
                        cursor.attempt,
                        cursor.stage_key,
                        unit.unit_key
                    ],
                    |row| row.get::<_, i64>(0),
                )
                .optional()?;
            if let Some(existing_order) = existing {
                if existing_order as u64 != unit.unit_order {
                    bail!(
                        "pipeline unit {} changed order for job {}: {} != {}",
                        unit.unit_key,
                        cursor.job_id,
                        unit.unit_order,
                        existing_order
                    );
                }
                continue;
            }
            // Translation workers finish pages concurrently, so a previously
            // unseen lower document order is not a state regression. The
            // stage checkpoint remains the highest committed order below;
            // generation fencing and unique unit identities provide the
            // authoritative mutation order.
            let conflicting_key = tx
                .query_row(
                    r#"
                    SELECT unit_key FROM pipeline_units
                    WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
                      AND unit_order = ?4 AND unit_key != ?5
                    LIMIT 1
                    "#,
                    params![
                        cursor.job_id,
                        cursor.attempt,
                        cursor.stage_key,
                        unit.unit_order as i64,
                        unit.unit_key
                    ],
                    |row| row.get::<_, String>(0),
                )
                .optional()?;
            if let Some(conflicting_key) = conflicting_key {
                bail!(
                    "pipeline unit order {} already belongs to {} for job {}",
                    unit.unit_order,
                    conflicting_key,
                    cursor.job_id
                );
            }
        }

        let next_generation = cursor.generation + 1;
        let timestamp = now_iso();
        for unit in units {
            let payload_json = serde_json::to_string(&unit.payload)?;
            tx.execute(
                r#"
                INSERT INTO pipeline_units (
                    job_id, attempt, stage_key, unit_key, unit_order, generation,
                    producer_generation, status, page_index, page_hash, payload_json,
                    committed_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'committed', ?8, ?9, ?10, ?11, ?11)
                ON CONFLICT(job_id, attempt, stage_key, unit_key) DO UPDATE SET
                    generation = excluded.generation,
                    producer_generation = excluded.producer_generation,
                    status = 'committed',
                    page_index = excluded.page_index,
                    page_hash = excluded.page_hash,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                "#,
                params![
                    cursor.job_id,
                    cursor.attempt,
                    cursor.stage_key,
                    unit.unit_key,
                    unit.unit_order,
                    next_generation,
                    unit.producer_generation,
                    unit.page_index,
                    unit.page_hash,
                    payload_json,
                    timestamp,
                ],
            )?;
        }
        let changed = tx.execute(
            r#"
            UPDATE pipeline_attempts
            SET generation = ?1, current_stage = ?2, updated_at = ?3
            WHERE job_id = ?4 AND attempt = ?5 AND generation = ?6
              AND worker_id = ?7 AND status = 'running'
            "#,
            params![
                next_generation,
                cursor.stage_key,
                timestamp,
                cursor.job_id,
                cursor.attempt,
                cursor.generation,
                cursor.worker_id,
            ],
        )?;
        if changed != 1 {
            bail!("stale pipeline generation while committing unit");
        }
        let mut latest_key = previous.last_committed_unit_key.clone();
        let mut latest_order = previous.last_committed_unit_order;
        let mut latest_hash = previous.last_page_hash.clone();
        for unit in units {
            if latest_order.is_none_or(|order| unit.unit_order >= order) {
                latest_key = Some(unit.unit_key.clone());
                latest_order = Some(unit.unit_order);
                latest_hash = Some(unit.page_hash.clone());
            }
        }
        tx.execute(
            r#"
            UPDATE pipeline_stages
            SET generation = ?1, status = 'running', last_committed_unit_key = ?2,
                last_committed_unit_order = ?3, last_page_hash = ?4, updated_at = ?5
            WHERE job_id = ?6 AND attempt = ?7 AND stage_key = ?8
            "#,
            params![
                next_generation,
                latest_key,
                latest_order,
                latest_hash,
                timestamp,
                cursor.job_id,
                cursor.attempt,
                cursor.stage_key,
            ],
        )?;
        for unit in units {
            let changed_item_ids = unit
                .payload
                .get("changed_item_ids")
                .cloned()
                .unwrap_or_else(|| json!([unit.unit_key]));
            append_state_event(
                &tx,
                &cursor.job_id,
                &cursor.stage_key,
                "pipeline_unit_committed",
                &format!("committed pipeline unit {}", unit.unit_key),
                json!({
                    "attempt": cursor.attempt,
                    "generation": next_generation,
                    "stage": cursor.stage_key,
                    "unit_key": unit.unit_key,
                    "unit_order": unit.unit_order,
                    "page_index": unit.page_index,
                    "page_hash": unit.page_hash,
                    "producer_generation": unit.producer_generation,
                    "changed_item_ids": changed_item_ids,
                }),
            )?;
        }
        tx.commit()?;
        Ok(PipelineCheckpoint {
            job_id: cursor.job_id.clone(),
            attempt: cursor.attempt,
            generation: next_generation,
            stage_key: cursor.stage_key.clone(),
            last_committed_unit_key: latest_key,
            last_committed_unit_order: latest_order,
            last_page_hash: latest_hash,
        })
    }
}
