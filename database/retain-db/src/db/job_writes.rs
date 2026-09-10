use anyhow::Result;
use rusqlite::params;

use crate::models::domain::{JobArtifactRecord, JobSnapshot};
use crate::storage_paths::{collect_job_artifact_entries, normalize_job_paths_for_storage};

use super::Db;

pub(super) struct PreparedJobWrite {
    stored_job: JobSnapshot,
    artifacts_json: Option<String>,
    artifact_entries: Vec<JobArtifactRecord>,
    runtime_json: Option<String>,
    failure_json: Option<String>,
}

pub(super) fn prepare_job_write(db: &Db, job: &JobSnapshot) -> Result<PreparedJobWrite> {
    let mut stored_job = job.clone();
    stored_job.sync_runtime_state();
    normalize_job_paths_for_storage(&db.data_root, &mut stored_job)?;
    let artifacts_json = stored_job
        .artifacts
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    let artifact_entries = collect_job_artifact_entries(&stored_job, &db.data_root)?;
    let runtime_json = stored_job
        .runtime
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    let failure_json = stored_job
        .failure
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;
    Ok(PreparedJobWrite {
        stored_job,
        artifacts_json,
        artifact_entries,
        runtime_json,
        failure_json,
    })
}

pub(super) fn persist_prepared_job(
    tx: &rusqlite::Transaction<'_>,
    prepared: PreparedJobWrite,
) -> Result<()> {
    let PreparedJobWrite {
        stored_job,
        artifacts_json,
        artifact_entries,
        runtime_json,
        failure_json,
    } = prepared;
    tx.execute(
        r#"
        INSERT INTO jobs (
            job_id, workflow, status_json, created_at, updated_at, started_at, finished_at,
            upload_id, pid, command_json, request_json, error, stage, stage_detail,
            progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
            workflow=excluded.workflow,
            status_json=excluded.status_json,
            created_at=excluded.created_at,
            updated_at=excluded.updated_at,
            started_at=excluded.started_at,
            finished_at=excluded.finished_at,
            upload_id=excluded.upload_id,
            pid=excluded.pid,
            command_json=excluded.command_json,
            request_json=excluded.request_json,
            error=excluded.error,
            stage=excluded.stage,
            stage_detail=excluded.stage_detail,
            progress_current=excluded.progress_current,
            progress_total=excluded.progress_total,
            log_tail_json=excluded.log_tail_json,
            result_json=excluded.result_json,
            runtime_json=excluded.runtime_json,
            failure_json=excluded.failure_json
        "#,
        params![
            stored_job.job_id,
            serde_json::to_string(&stored_job.workflow)?,
            serde_json::to_string(&stored_job.status)?,
            stored_job.created_at,
            stored_job.updated_at,
            stored_job.started_at,
            stored_job.finished_at,
            stored_job.upload_id,
            stored_job.pid.map(|v| v as i64),
            serde_json::to_string(&stored_job.command)?,
            serde_json::to_string(&stored_job.request_payload)?,
            stored_job.error,
            stored_job.stage,
            stored_job.stage_detail,
            stored_job.progress_current,
            stored_job.progress_total,
            serde_json::to_string(&stored_job.log_tail)?,
            serde_json::to_string(&stored_job.result)?,
            runtime_json,
            failure_json,
        ],
    )?;
    persist_job_artifacts(tx, &stored_job.job_id, artifacts_json, &artifact_entries)
}

impl Db {
    pub fn save_job(&self, job: &JobSnapshot) -> Result<()> {
        let prepared = prepare_job_write(self, job)?;
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        persist_prepared_job(&tx, prepared)?;
        tx.commit()?;
        Ok(())
    }

    /// CAS terminal write: only succeeds if current DB status is in expected_statuses.
    /// Returns true if row was updated, false if already terminal (no-op).
    pub fn cas_save_job(&self, job: &JobSnapshot, expected_statuses: &[&str]) -> Result<bool> {
        let mut stored_job = job.clone();
        stored_job.sync_runtime_state();
        normalize_job_paths_for_storage(&self.data_root, &mut stored_job)?;
        let artifacts_json = stored_job
            .artifacts
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let artifact_entries = collect_job_artifact_entries(&stored_job, &self.data_root)?;
        let runtime_json = stored_job
            .runtime
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let failure_json = stored_job
            .failure
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        let mut conn = self.connect()?;
        let tx = conn.transaction()?;
        // Check current status
        let current_status: Option<String> = tx
            .query_row(
                "SELECT status_json FROM jobs WHERE job_id = ?1",
                params![stored_job.job_id],
                |row| row.get(0),
            )
            .ok();
        if let Some(current) = current_status {
            let is_expected = expected_statuses.iter().any(|s| {
                let quoted = format!("\"{}\"", s);
                current == quoted || current == *s
            });
            if !is_expected {
                return Ok(false);
            }
        }
        tx.execute(
            r#"
            INSERT INTO jobs (
                job_id, workflow, status_json, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(job_id) DO UPDATE SET
                workflow=excluded.workflow,
                status_json=excluded.status_json,
                created_at=excluded.created_at,
                updated_at=excluded.updated_at,
                started_at=excluded.started_at,
                finished_at=excluded.finished_at,
                upload_id=excluded.upload_id,
                pid=excluded.pid,
                command_json=excluded.command_json,
                request_json=excluded.request_json,
                error=excluded.error,
                stage=excluded.stage,
                stage_detail=excluded.stage_detail,
                progress_current=excluded.progress_current,
                progress_total=excluded.progress_total,
                log_tail_json=excluded.log_tail_json,
                result_json=excluded.result_json,
                runtime_json=excluded.runtime_json,
                failure_json=excluded.failure_json
            "#,
            params![
                stored_job.job_id,
                serde_json::to_string(&stored_job.workflow)?,
                serde_json::to_string(&stored_job.status)?,
                stored_job.created_at,
                stored_job.updated_at,
                stored_job.started_at,
                stored_job.finished_at,
                stored_job.upload_id,
                stored_job.pid.map(|v| v as i64),
                serde_json::to_string(&stored_job.command)?,
                serde_json::to_string(&stored_job.request_payload)?,
                stored_job.error,
                stored_job.stage,
                stored_job.stage_detail,
                stored_job.progress_current,
                stored_job.progress_total,
                serde_json::to_string(&stored_job.log_tail)?,
                serde_json::to_string(&stored_job.result)?,
                runtime_json,
                failure_json,
            ],
        )?;
        persist_job_artifacts(&tx, &stored_job.job_id, artifacts_json, &artifact_entries)?;
        tx.commit()?;
        Ok(true)
    }
}

fn persist_job_artifacts(
    tx: &rusqlite::Transaction<'_>,
    job_id: &str,
    artifacts_json: Option<String>,
    artifact_entries: &[JobArtifactRecord],
) -> Result<()> {
    if let Some(artifacts_json) = artifacts_json {
        tx.execute(
            r#"
            INSERT INTO artifacts (job_id, artifacts_json)
            VALUES (?1, ?2)
            ON CONFLICT(job_id) DO UPDATE SET
                artifacts_json=excluded.artifacts_json
            "#,
            params![job_id, artifacts_json],
        )?;
    } else {
        tx.execute("DELETE FROM artifacts WHERE job_id = ?1", params![job_id])?;
    }
    tx.execute(
        "DELETE FROM job_artifact_entries WHERE job_id = ?1",
        params![job_id],
    )?;
    for item in artifact_entries {
        tx.execute(
            r#"
            INSERT INTO job_artifact_entries (
                job_id, artifact_key, artifact_group, artifact_kind, relative_path,
                file_name, content_type, ready, size_bytes, checksum, source_stage,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            params![
                item.job_id,
                item.artifact_key,
                item.artifact_group,
                item.artifact_kind,
                item.relative_path,
                item.file_name,
                item.content_type,
                if item.ready { 1 } else { 0 },
                item.size_bytes.map(|value| value as i64),
                item.checksum,
                item.source_stage,
                item.created_at,
                item.updated_at,
            ],
        )?;
    }
    Ok(())
}
