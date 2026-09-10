use anyhow::{anyhow, bail, Context, Result};
use rusqlite::{params, OptionalExtension, Transaction};

use super::types::{PipelineAttemptCursor, PipelineCheckpoint};

pub(super) const ATTEMPT_RUNNING: &str = "running";

pub(super) fn assert_cursor(tx: &Transaction<'_>, cursor: &PipelineAttemptCursor) -> Result<()> {
    let current = tx
        .query_row(
            r#"
            SELECT generation, worker_id, status
            FROM pipeline_attempts
            WHERE job_id = ?1 AND attempt = ?2
            "#,
            params![cursor.job_id, cursor.attempt],
            |row| {
                Ok((
                    row.get::<_, i64>(0)? as u64,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| anyhow!("pipeline attempt not found for job {}", cursor.job_id))?;
    if current.0 != cursor.generation
        || current.1 != cursor.worker_id
        || current.2 != ATTEMPT_RUNNING
    {
        bail!(
            "stale pipeline cursor for job {}: expected generation {} worker {}, found generation {} worker {} status {}",
            cursor.job_id,
            cursor.generation,
            cursor.worker_id,
            current.0,
            current.1,
            current.2
        );
    }
    Ok(())
}

pub(super) fn stage_checkpoint(
    tx: &Transaction<'_>,
    cursor: &PipelineAttemptCursor,
) -> Result<PipelineCheckpoint> {
    tx.query_row(
        r#"
        SELECT last_committed_unit_key, last_committed_unit_order, last_page_hash
        FROM pipeline_stages
        WHERE job_id = ?1 AND attempt = ?2 AND stage_key = ?3
        "#,
        params![cursor.job_id, cursor.attempt, cursor.stage_key],
        |row| {
            Ok(PipelineCheckpoint {
                job_id: cursor.job_id.clone(),
                attempt: cursor.attempt,
                generation: cursor.generation,
                stage_key: cursor.stage_key.clone(),
                last_committed_unit_key: row.get(0)?,
                last_committed_unit_order: row.get::<_, Option<i64>>(1)?.map(|v| v as u64),
                last_page_hash: row.get(2)?,
            })
        },
    )
    .with_context(|| {
        format!(
            "pipeline stage {} missing for job {} attempt {}",
            cursor.stage_key, cursor.job_id, cursor.attempt
        )
    })
}

pub(super) fn advance_generation(
    tx: &Transaction<'_>,
    cursor: &PipelineAttemptCursor,
    next_generation: u64,
    timestamp: &str,
) -> Result<()> {
    let changed = tx.execute(
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
    if changed != 1 {
        bail!("stale pipeline generation while updating durable state");
    }
    tx.execute(
        r#"
        UPDATE pipeline_stages SET generation = ?1, updated_at = ?2
        WHERE job_id = ?3 AND attempt = ?4 AND stage_key = ?5
        "#,
        params![
            next_generation,
            timestamp,
            cursor.job_id,
            cursor.attempt,
            cursor.stage_key,
        ],
    )?;
    Ok(())
}

pub(in crate::db) fn validate_identity(label: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        bail!("{label} must not be empty");
    }
    Ok(())
}

pub(super) fn validate_sha256(label: &str, value: &str) -> Result<()> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        bail!("{label} must be a lowercase 64-character hexadecimal sha256");
    }
    Ok(())
}
