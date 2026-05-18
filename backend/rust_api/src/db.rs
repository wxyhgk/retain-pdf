use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use serde_json::Value;

#[path = "db/rows.rs"]
mod rows;
#[path = "db/schema.rs"]
mod schema;

use crate::models::{
    now_iso, GlossaryRecord, JobArtifactRecord, JobEventRecord, JobFailureInfo, JobRuntimeInfo,
    JobSnapshot, JobStatusKind, UploadRecord, WorkflowKind,
};
use crate::storage_paths::{
    collect_job_artifact_entries, normalize_job_paths_for_storage, resolve_data_path,
    to_relative_data_path,
};
use rows::{
    row_to_glossary_record, row_to_job_artifact_record, row_to_job_event, row_to_job_snapshot,
    JOB_SELECT_SQL,
};
use schema::{ensure_events_column, ensure_jobs_column, ensure_no_legacy_artifacts_json};

#[derive(Clone)]
pub struct Db {
    path: PathBuf,
    data_root: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JobProcessRecord {
    pub job_id: String,
    pub pid: Option<u32>,
    pub stage: Option<String>,
    pub updated_at: String,
}

impl Db {
    pub fn new(path: PathBuf, data_root: PathBuf) -> Self {
        Self { path, data_root }
    }

    fn connect(&self) -> Result<Connection> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("failed to create db directory: {}", parent.display()))?;
        }
        let conn = Connection::open(&self.path)?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS uploads (
                upload_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                bytes INTEGER NOT NULL,
                page_count INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                developer_mode INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                workflow TEXT NOT NULL,
                status_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                upload_id TEXT,
                pid INTEGER,
                command_json TEXT NOT NULL,
                request_json TEXT NOT NULL,
                error TEXT,
                stage TEXT,
                stage_detail TEXT,
                progress_current INTEGER,
                progress_total INTEGER,
                log_tail_json TEXT NOT NULL,
                result_json TEXT,
                runtime_json TEXT,
                failure_json TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_jobs_upload_id ON jobs(upload_id);
            CREATE TABLE IF NOT EXISTS artifacts (
                job_id TEXT PRIMARY KEY,
                artifacts_json TEXT NOT NULL,
                FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON artifacts(job_id);
            CREATE TABLE IF NOT EXISTS job_artifact_entries (
                job_id TEXT NOT NULL,
                artifact_key TEXT NOT NULL,
                artifact_group TEXT NOT NULL,
                artifact_kind TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                file_name TEXT,
                content_type TEXT NOT NULL,
                ready INTEGER NOT NULL,
                size_bytes INTEGER,
                checksum TEXT,
                source_stage TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY(job_id, artifact_key),
                FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_job_artifact_entries_job_id ON job_artifact_entries(job_id);
            CREATE TABLE IF NOT EXISTS events (
                job_id TEXT NOT NULL,
                seq INTEGER NOT NULL,
                ts TEXT NOT NULL,
                level TEXT NOT NULL,
                stage TEXT,
                stage_detail TEXT,
                provider TEXT,
                provider_stage TEXT,
                event TEXT NOT NULL,
                event_type TEXT,
                progress_current INTEGER,
                progress_total INTEGER,
                payload_json TEXT,
                retry_count INTEGER,
                elapsed_ms INTEGER,
                message TEXT NOT NULL,
                PRIMARY KEY(job_id, seq)
            );
            CREATE INDEX IF NOT EXISTS idx_events_job_seq ON events(job_id, seq);
            CREATE TABLE IF NOT EXISTS glossaries (
                glossary_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                entries_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_glossaries_updated_at ON glossaries(updated_at DESC);
            "#,
        )?;
        Ok(conn)
    }

    pub fn init(&self) -> Result<()> {
        let conn = self.connect()?;
        ensure_jobs_column(&conn, "runtime_json", "TEXT")?;
        ensure_jobs_column(&conn, "failure_json", "TEXT")?;
        ensure_events_column(&conn, "stage_detail", "TEXT")?;
        ensure_events_column(&conn, "provider", "TEXT")?;
        ensure_events_column(&conn, "provider_stage", "TEXT")?;
        ensure_events_column(&conn, "event_type", "TEXT")?;
        ensure_events_column(&conn, "progress_current", "INTEGER")?;
        ensure_events_column(&conn, "progress_total", "INTEGER")?;
        ensure_events_column(&conn, "retry_count", "INTEGER")?;
        ensure_events_column(&conn, "elapsed_ms", "INTEGER")?;
        ensure_no_legacy_artifacts_json(&conn)?;
        Ok(())
    }

    pub fn cleanup_legacy_workflows(&self) -> Result<usize> {
        let conn = self.connect()?;
        let changed_jobs = conn.execute(
            r#"
            UPDATE jobs
            SET workflow = '"book"'
            WHERE workflow = '"mineru"'
            "#,
            [],
        )?;
        conn.execute(
            r#"
            UPDATE jobs
            SET request_json = replace(request_json, '"workflow":"mineru"', '"workflow":"book"')
            WHERE request_json LIKE '%"workflow":"mineru"%'
            "#,
            [],
        )?;
        conn.execute(
            r#"
            UPDATE events
            SET payload_json = replace(payload_json, '"workflow":"mineru"', '"workflow":"book"')
            WHERE payload_json LIKE '%"workflow":"mineru"%'
            "#,
            [],
        )?;
        Ok(changed_jobs)
    }

    pub fn save_upload(&self, upload: &UploadRecord) -> Result<()> {
        let stored_path = to_relative_data_path(&self.data_root, Path::new(&upload.stored_path))?;
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO uploads (
                upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(upload_id) DO UPDATE SET
                filename=excluded.filename,
                stored_path=excluded.stored_path,
                bytes=excluded.bytes,
                page_count=excluded.page_count,
                uploaded_at=excluded.uploaded_at,
                developer_mode=excluded.developer_mode
            "#,
            params![
                upload.upload_id,
                upload.filename,
                stored_path,
                upload.bytes as i64,
                upload.page_count as i64,
                upload.uploaded_at,
                if upload.developer_mode { 1 } else { 0 },
            ],
        )?;
        Ok(())
    }

    pub fn get_upload(&self, upload_id: &str) -> Result<UploadRecord> {
        let conn = self.connect()?;
        let upload = conn
            .query_row(
                "SELECT upload_id, filename, stored_path, bytes, page_count, uploaded_at, developer_mode FROM uploads WHERE upload_id = ?1",
                params![upload_id],
                |row| {
                    Ok(UploadRecord {
                        upload_id: row.get(0)?,
                        filename: row.get(1)?,
                        stored_path: row.get(2)?,
                        bytes: row.get::<_, i64>(3)? as u64,
                        page_count: row.get::<_, i64>(4)? as u32,
                        uploaded_at: row.get(5)?,
                        developer_mode: row.get::<_, i64>(6)? != 0,
                    })
                },
            )
            .with_context(|| format!("upload not found: {upload_id}"))?;
        Ok(UploadRecord {
            stored_path: resolve_data_path(&self.data_root, &upload.stored_path)?
                .to_string_lossy()
                .to_string(),
            ..upload
        })
    }

    pub fn save_job(&self, job: &JobSnapshot) -> Result<()> {
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
        if let Some(artifacts_json) = artifacts_json {
            tx.execute(
                r#"
                INSERT INTO artifacts (job_id, artifacts_json)
                VALUES (?1, ?2)
                ON CONFLICT(job_id) DO UPDATE SET
                    artifacts_json=excluded.artifacts_json
                "#,
                params![stored_job.job_id, artifacts_json],
            )?;
        } else {
            tx.execute(
                "DELETE FROM artifacts WHERE job_id = ?1",
                params![stored_job.job_id],
            )?;
        }
        tx.execute(
            "DELETE FROM job_artifact_entries WHERE job_id = ?1",
            params![stored_job.job_id],
        )?;
        for item in &artifact_entries {
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
        tx.commit()?;
        Ok(())
    }

    pub fn save_glossary(&self, glossary: &GlossaryRecord) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO glossaries (glossary_id, name, entries_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(glossary_id) DO UPDATE SET
                name=excluded.name,
                entries_json=excluded.entries_json,
                created_at=excluded.created_at,
                updated_at=excluded.updated_at
            "#,
            params![
                glossary.glossary_id,
                glossary.name,
                serde_json::to_string(&glossary.entries)?,
                glossary.created_at,
                glossary.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_glossary(&self, glossary_id: &str) -> Result<GlossaryRecord> {
        let conn = self.connect()?;
        let glossary = conn
            .query_row(
                "SELECT glossary_id, name, entries_json, created_at, updated_at FROM glossaries WHERE glossary_id = ?1",
                params![glossary_id],
                row_to_glossary_record,
            )
            .with_context(|| format!("glossary not found: {glossary_id}"))?;
        Ok(glossary)
    }

    pub fn list_glossaries(&self) -> Result<Vec<GlossaryRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            "SELECT glossary_id, name, entries_json, created_at, updated_at FROM glossaries ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], row_to_glossary_record)?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }
        Ok(items)
    }

    pub fn delete_glossary(&self, glossary_id: &str) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            "DELETE FROM glossaries WHERE glossary_id = ?1",
            params![glossary_id],
        )?;
        Ok(())
    }

    pub fn get_job(&self, job_id: &str) -> Result<JobSnapshot> {
        let conn = self.connect()?;
        let job = conn
            .query_row(
                &format!("{JOB_SELECT_SQL} WHERE jobs.job_id = ?1"),
                params![job_id],
                row_to_job_snapshot,
            )
            .with_context(|| format!("job not found: {job_id}"))?;
        Ok(job)
    }

    pub fn list_jobs(
        &self,
        limit: u32,
        offset: u32,
        status: Option<&JobStatusKind>,
        workflow: Option<&WorkflowKind>,
    ) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let status_json = status.map(serde_json::to_string).transpose()?;
        let workflow_json = workflow.map(serde_json::to_string).transpose()?;
        let base_sql = JOB_SELECT_SQL;
        let query = match (status_json.as_ref(), workflow_json.as_ref()) {
            (Some(_), Some(_)) => format!("{base_sql} WHERE jobs.status_json = ?1 AND jobs.workflow = ?2 ORDER BY jobs.updated_at DESC LIMIT ?3 OFFSET ?4"),
            (Some(_), None) => format!("{base_sql} WHERE jobs.status_json = ?1 ORDER BY jobs.updated_at DESC LIMIT ?2 OFFSET ?3"),
            (None, Some(_)) => format!("{base_sql} WHERE jobs.workflow = ?1 ORDER BY jobs.updated_at DESC LIMIT ?2 OFFSET ?3"),
            (None, None) => format!("{base_sql} ORDER BY jobs.updated_at DESC LIMIT ?1 OFFSET ?2"),
        };
        let mut stmt = conn.prepare(&query)?;
        let rows = match (status_json.as_ref(), workflow_json.as_ref()) {
            (Some(status_json), Some(workflow_json)) => stmt.query_map(
                params![status_json, workflow_json, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (Some(status_json), None) => stmt.query_map(
                params![status_json, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (None, Some(workflow_json)) => stmt.query_map(
                params![workflow_json, limit as i64, offset as i64],
                row_to_job_snapshot,
            )?,
            (None, None) => {
                stmt.query_map(params![limit as i64, offset as i64], row_to_job_snapshot)?
            }
        };
        let mut jobs = Vec::new();
        for row in rows {
            match row {
                Ok(job) => jobs.push(job),
                Err(error) => {
                    eprintln!("[db] skipping malformed job row during list_jobs: {error}");
                }
            }
        }
        Ok(jobs)
    }

    pub fn list_jobs_with_status(&self, status: &JobStatusKind) -> Result<Vec<JobSnapshot>> {
        let conn = self.connect()?;
        let status_json = serde_json::to_string(status)?;
        let query =
            format!("{JOB_SELECT_SQL} WHERE jobs.status_json = ?1 ORDER BY jobs.updated_at DESC");
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(params![status_json], row_to_job_snapshot)?;
        let mut jobs = Vec::new();
        for row in rows {
            match row {
                Ok(job) => jobs.push(job),
                Err(error) => {
                    eprintln!(
                        "[db] skipping malformed job row during list_jobs_with_status: {error}"
                    );
                }
            }
        }
        Ok(jobs)
    }

    pub fn delete_job(&self, job_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM events WHERE job_id = ?1", params![job_id])?;
        let changed = conn.execute("DELETE FROM jobs WHERE job_id = ?1", params![job_id])?;
        Ok(changed > 0)
    }

    pub fn list_job_process_records_with_status(
        &self,
        status: &JobStatusKind,
    ) -> Result<Vec<JobProcessRecord>> {
        let conn = self.connect()?;
        let status_json = serde_json::to_string(status)?;
        let mut stmt = conn.prepare(
            r#"
            SELECT job_id, pid, stage, updated_at
            FROM jobs
            WHERE status_json = ?1
            ORDER BY updated_at DESC
            "#,
        )?;
        let rows = stmt.query_map(params![status_json], |row| {
            Ok(JobProcessRecord {
                job_id: row.get(0)?,
                pid: row.get::<_, Option<i64>>(1)?.map(|value| value as u32),
                stage: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        let mut jobs = Vec::new();
        for row in rows {
            jobs.push(row?);
        }
        Ok(jobs)
    }

    pub fn recover_stale_running_job(
        &self,
        job_id: &str,
        detail: &str,
        timestamp: &str,
    ) -> Result<()> {
        let conn = self.connect()?;
        let failed_status_json = serde_json::to_string(&JobStatusKind::Failed)?;
        let failure = JobFailureInfo {
            stage: "startup_recovery".to_string(),
            category: "worker_process_missing".to_string(),
            code: None,
            failed_stage: Some("startup_recovery".to_string()),
            failure_code: Some("worker_process_missing".to_string()),
            failure_category: Some("internal".to_string()),
            provider_stage: None,
            provider_code: None,
            summary: "后端启动时回收了遗留 running 任务".to_string(),
            root_cause: Some(detail.to_string()),
            retryable: true,
            upstream_host: None,
            provider: None,
            suggestion: Some("该任务对应的 worker 已不在运行；请重新提交或手动重试".to_string()),
            last_log_line: Some(detail.to_string()),
            raw_excerpt: Some(detail.to_string()),
            raw_error_excerpt: Some(detail.to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        };
        let runtime = JobRuntimeInfo {
            current_stage: Some("failed".to_string()),
            stage_started_at: Some(timestamp.to_string()),
            last_stage_transition_at: Some(timestamp.to_string()),
            terminal_reason: Some("failed".to_string()),
            last_error_at: Some(timestamp.to_string()),
            final_failure_category: Some(failure.category.clone()),
            final_failure_summary: Some(failure.summary.clone()),
            ..JobRuntimeInfo::default()
        };
        conn.execute(
            r#"
            UPDATE jobs
            SET status_json = ?1,
                updated_at = ?2,
                finished_at = ?3,
                pid = NULL,
                error = ?4,
                stage = 'failed',
                stage_detail = 'startup stale running job recovered',
                runtime_json = ?5,
                failure_json = ?6
            WHERE job_id = ?7
            "#,
            params![
                failed_status_json,
                timestamp,
                timestamp,
                detail,
                serde_json::to_string(&runtime)?,
                serde_json::to_string(&failure)?,
                job_id,
            ],
        )?;
        Ok(())
    }

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
        let user_stage = user_stage_for_event(stage.as_deref());
        let substage = provider_stage.clone();
        let progress_unit = progress_unit_for_event(stage.as_deref(), event);
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
            ts,
            level: level.to_string(),
            user_stage,
            stage,
            substage,
            stage_detail,
            provider,
            provider_stage,
            event: event.to_string(),
            event_type: event_type.or_else(|| Some(event.to_string())),
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

    pub fn list_job_artifact_entries(&self, job_id: &str) -> Result<Vec<JobArtifactRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT
                job_id, artifact_key, artifact_group, artifact_kind, relative_path,
                file_name, content_type, ready, size_bytes, checksum, source_stage,
                created_at, updated_at
            FROM job_artifact_entries
            WHERE job_id = ?1
            ORDER BY artifact_group ASC, artifact_key ASC
            "#,
        )?;
        let rows = stmt.query_map(params![job_id], row_to_job_artifact_record)?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }
        Ok(items)
    }

    pub fn count_jobs_with_status(&self, status: &JobStatusKind) -> Result<i64> {
        let conn = self.connect()?;
        let status_json = serde_json::to_string(status)?;
        let count = conn.query_row(
            "SELECT COUNT(*) FROM jobs WHERE status_json = ?1",
            params![status_json],
            |row| row.get::<_, i64>(0),
        )?;
        Ok(count)
    }

    pub fn ping(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.query_row("SELECT 1", [], |_| Ok(()))?;
        Ok(())
    }
}

fn user_stage_for_event(stage: Option<&str>) -> Option<String> {
    match stage.map(str::trim).unwrap_or_default() {
        "ocr_upload" | "ocr_processing" | "ocr_result_ready" | "normalizing" => {
            Some("ocr".to_string())
        }
        "translation_prepare"
        | "translating"
        | "translation_batches"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair" => Some("translate".to_string()),
        "render_prepare" | "rendering" | "compile" | "overlay" | "saving" => {
            Some("render".to_string())
        }
        "finished" | "done" => Some("done".to_string()),
        _ => None,
    }
}

fn progress_unit_for_event(stage: Option<&str>, event: &str) -> Option<String> {
    let unit = match stage.map(str::trim).unwrap_or_default() {
        "translating" | "translation_batches" => "batch",
        "ocr_processing"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair"
        | "rendering" => "page",
        "compile"
        | "overlay"
        | "saving"
        | "render_prepare"
        | "translation_prepare"
        | "normalizing" => "step",
        _ if event == "stage_progress" => "step",
        _ => "none",
    };
    Some(unit.to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use rusqlite::Connection;

    use super::*;
    use crate::models::{CreateJobInput, JobArtifacts};

    struct TestDbFs {
        root: PathBuf,
        data_root: PathBuf,
        db_path: PathBuf,
    }

    impl TestDbFs {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("rust-api-db-{}", fastrand::u64(..)));
            let data_root = root.join("data");
            let db_path = root.join("db").join("jobs.db");
            fs::create_dir_all(&data_root).expect("create data root");
            fs::create_dir_all(db_path.parent().expect("db parent")).expect("create db dir");
            Self {
                root,
                data_root,
                db_path,
            }
        }

        fn db(&self) -> Db {
            Db::new(self.db_path.clone(), self.data_root.clone())
        }
    }

    impl Drop for TestDbFs {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn sample_job(job_id: &str, data_root: &Path) -> JobSnapshot {
        let mut job = JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        let artifacts = job.artifacts.get_or_insert_with(JobArtifacts::default);
        artifacts.job_root = Some(
            data_root
                .join("jobs")
                .join(job_id)
                .to_string_lossy()
                .to_string(),
        );
        artifacts.output_pdf = Some(
            data_root
                .join("jobs")
                .join(job_id)
                .join("rendered")
                .join("out.pdf")
                .to_string_lossy()
                .to_string(),
        );
        artifacts.summary = Some(
            data_root
                .join("jobs")
                .join(job_id)
                .join("artifacts")
                .join("summary.json")
                .to_string_lossy()
                .to_string(),
        );
        job
    }

    #[test]
    fn save_job_splits_artifacts_into_dedicated_table() {
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");

        fs::create_dir_all(fs.data_root.join("jobs/job-split/rendered")).expect("rendered dir");
        fs::create_dir_all(fs.data_root.join("jobs/job-split/artifacts")).expect("artifacts dir");
        fs::write(fs.data_root.join("jobs/job-split/rendered/out.pdf"), b"pdf")
            .expect("output pdf");
        fs::write(
            fs.data_root.join("jobs/job-split/artifacts/summary.json"),
            br#"{"ok":true}"#,
        )
        .expect("summary json");

        let job = sample_job("job-split", &fs.data_root);
        db.save_job(&job).expect("save job");

        let conn = Connection::open(&fs.db_path).expect("open sqlite");
        let split_artifacts_json: String = conn
            .query_row(
                "SELECT artifacts_json FROM artifacts WHERE job_id = ?1",
                params![job.job_id],
                |row| row.get(0),
            )
            .expect("query split artifacts json");
        assert!(split_artifacts_json.contains("jobs/job-split/rendered/out.pdf"));

        let artifact_keys = {
            let mut stmt = conn
                .prepare(
                    "SELECT artifact_key FROM job_artifact_entries WHERE job_id = ?1 ORDER BY artifact_key",
                )
                .expect("prepare artifact registry query");
            let rows = stmt
                .query_map(params![job.job_id.clone()], |row| row.get::<_, String>(0))
                .expect("query artifact keys");
            let mut out = Vec::new();
            for row in rows {
                out.push(row.expect("artifact row"));
            }
            out
        };
        assert!(artifact_keys.contains(&"translated_pdf".to_string()));
        assert!(artifact_keys.contains(&"pipeline_summary".to_string()));

        let loaded = db.get_job("job-split").expect("load job");
        let artifacts = loaded.artifacts.expect("artifacts");
        assert_eq!(artifacts.job_root.as_deref(), Some("jobs/job-split"));
        assert_eq!(
            artifacts.output_pdf.as_deref(),
            Some("jobs/job-split/rendered/out.pdf")
        );
    }

    #[test]
    fn save_job_persists_runtime_and_failure_json() {
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");

        let mut job = sample_job("job-runtime", &fs.data_root);
        job.status = JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.stage_detail = Some("provider timeout".to_string());
        job.error = Some("ReadTimeout".to_string());
        job.updated_at = now_iso();
        job.sync_runtime_state();
        job.replace_failure_info(Some(JobFailureInfo {
            stage: "translation".to_string(),
            category: "upstream_timeout".to_string(),
            code: None,
            failed_stage: Some("translation".to_string()),
            failure_code: Some("upstream_timeout".to_string()),
            failure_category: Some("timeout".to_string()),
            provider_stage: None,
            provider_code: None,
            summary: "外部服务请求超时".to_string(),
            root_cause: Some("测试失败归因".to_string()),
            retryable: true,
            upstream_host: Some("api.deepseek.com".to_string()),
            provider: Some("mineru".to_string()),
            suggestion: Some("重试".to_string()),
            last_log_line: Some("ReadTimeout".to_string()),
            raw_excerpt: Some("ReadTimeout".to_string()),
            raw_error_excerpt: Some("ReadTimeout".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        }));

        db.save_job(&job).expect("save job");
        let loaded = db.get_job("job-runtime").expect("load job");
        assert_eq!(
            loaded
                .runtime
                .as_ref()
                .and_then(|runtime| runtime.current_stage.as_deref()),
            Some("failed")
        );
        assert_eq!(
            loaded
                .failure
                .as_ref()
                .map(|failure| failure.category.as_str()),
            Some("upstream_timeout")
        );
    }

    #[test]
    fn init_rejects_legacy_artifacts_json_storage() {
        let fs = TestDbFs::new();
        let job = sample_job("job-legacy", &fs.data_root);
        let artifacts_json = serde_json::to_string(&job.artifacts).expect("serialize artifacts");

        let conn = Connection::open(&fs.db_path).expect("open sqlite");
        conn.execute_batch(
            r#"
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY,
                workflow TEXT NOT NULL,
                status_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                upload_id TEXT,
                pid INTEGER,
                command_json TEXT NOT NULL,
                request_json TEXT NOT NULL,
                error TEXT,
                stage TEXT,
                stage_detail TEXT,
                progress_current INTEGER,
                progress_total INTEGER,
                log_tail_json TEXT NOT NULL,
                result_json TEXT,
                runtime_json TEXT,
                failure_json TEXT,
                artifacts_json TEXT
            );
            "#,
        )
        .expect("create legacy jobs table");
        conn.execute(
            r#"
            INSERT INTO jobs (
                job_id, workflow, status_json, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json, artifacts_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
            "#,
            params![
                job.job_id,
                serde_json::to_string(&job.workflow).expect("workflow json"),
                serde_json::to_string(&job.status).expect("status json"),
                job.created_at,
                job.updated_at,
                job.started_at,
                job.finished_at,
                job.upload_id,
                job.pid.map(|value| value as i64),
                serde_json::to_string(&job.command).expect("command json"),
                serde_json::to_string(&job.request_payload).expect("request json"),
                job.error,
                job.stage,
                job.stage_detail,
                job.progress_current,
                job.progress_total,
                serde_json::to_string(&job.log_tail).expect("log tail json"),
                Option::<String>::None,
                Option::<String>::None,
                Option::<String>::None,
                artifacts_json,
            ],
        )
        .expect("insert legacy row");
        drop(conn);

        let db = fs.db();
        let error = db
            .init()
            .expect_err("legacy artifacts_json storage should be rejected");
        let detail = format!("{error:#}");
        assert!(detail.contains("legacy jobs.artifacts_json storage is no longer supported"));
        assert!(detail.contains("clear the DB or rerun those jobs"));
    }

    #[test]
    fn list_jobs_skips_malformed_rows_instead_of_failing() {
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");

        let valid_job = sample_job("job-valid", &fs.data_root);
        db.save_job(&valid_job).expect("save valid job");

        let conn = Connection::open(&fs.db_path).expect("open sqlite");
        conn.execute(
            r#"
            INSERT INTO jobs (
                job_id, workflow, status_json, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                "job-bad",
                serde_json::to_string(&WorkflowKind::Book).expect("workflow json"),
                serde_json::to_string(&JobStatusKind::Succeeded).expect("status json"),
                now_iso(),
                now_iso(),
                Option::<String>::None,
                Option::<String>::None,
                Option::<String>::None,
                Option::<i64>::None,
                "[]",
                "{\"invalid\":true}",
                Option::<String>::None,
                Option::<String>::None,
                Option::<String>::None,
                Option::<i64>::None,
                Option::<i64>::None,
                "[]",
                Option::<String>::None,
                Option::<String>::None,
                Option::<String>::None,
            ],
        )
        .expect("insert malformed row");
        drop(conn);

        let jobs = db.list_jobs(20, 0, None, None).expect("list jobs");
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].job_id, "job-valid");
    }
}
