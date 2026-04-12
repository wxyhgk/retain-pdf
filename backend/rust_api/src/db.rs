use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rusqlite::{params, Connection, Row};
use serde_json::Value;

use crate::models::{
    now_iso, GlossaryRecord, JobArtifactRecord, JobArtifacts, JobEventRecord, JobFailureInfo,
    JobRuntimeInfo, JobSnapshot, JobStatusKind, ResolvedJobSpec, UploadRecord, WorkflowKind,
};
use crate::storage_paths::{
    collect_job_artifact_entries, normalize_job_artifacts_for_storage,
    normalize_job_paths_for_storage, resolve_data_path, to_relative_data_path,
};

const JOB_SELECT_SQL: &str = r#"
    SELECT
        jobs.job_id, jobs.workflow, jobs.status_json, jobs.created_at, jobs.updated_at,
        jobs.started_at, jobs.finished_at, jobs.upload_id, jobs.pid, jobs.command_json,
        jobs.request_json, jobs.error, jobs.stage, jobs.stage_detail,
        jobs.progress_current, jobs.progress_total, jobs.log_tail_json, jobs.result_json,
        jobs.runtime_json, jobs.failure_json,
        artifacts.artifacts_json
    FROM jobs
    LEFT JOIN artifacts ON artifacts.job_id = jobs.job_id
"#;

fn row_to_job_snapshot(row: &Row<'_>) -> rusqlite::Result<JobSnapshot> {
    let result_json: Option<String> = row.get(17)?;
    let runtime_json: Option<String> = row.get(18)?;
    let failure_json: Option<String> = row.get(19)?;
    let artifacts_json: Option<String> = row.get(20)?;
    Ok(JobSnapshot {
        record: crate::models::JobRecord {
            job_id: row.get(0)?,
            workflow: serde_json::from_str::<_>(&row.get::<_, String>(1)?).unwrap(),
            status: serde_json::from_str::<_>(&row.get::<_, String>(2)?).unwrap(),
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
            started_at: row.get(5)?,
            finished_at: row.get(6)?,
            upload_id: row.get(7)?,
            pid: row.get::<_, Option<i64>>(8)?.map(|v| v as u32),
            command: serde_json::from_str(&row.get::<_, String>(9)?).unwrap_or_default(),
            request_payload: deserialize_request_spec(&row.get::<_, String>(10)?).unwrap(),
            error: row.get(11)?,
            stage: row.get(12)?,
            stage_detail: row.get(13)?,
            progress_current: row.get(14)?,
            progress_total: row.get(15)?,
            log_tail: serde_json::from_str(&row.get::<_, String>(16)?).unwrap_or_default(),
            result: result_json
                .and_then(|text| serde_json::from_str(&text).ok())
                .unwrap_or(None),
            runtime: runtime_json
                .and_then(|text| serde_json::from_str::<JobRuntimeInfo>(&text).ok()),
            failure: failure_json
                .and_then(|text| serde_json::from_str::<JobFailureInfo>(&text).ok()),
        },
        artifacts: artifacts_json
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(None),
    })
}

fn deserialize_request_spec(raw: &str) -> Result<ResolvedJobSpec> {
    serde_json::from_str::<ResolvedJobSpec>(raw).context("failed to deserialize job request/spec")
}

fn ensure_jobs_column(conn: &Connection, column: &str, column_def: &str) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(jobs)")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    let mut has_column = false;
    for row in rows {
        if row? == column {
            has_column = true;
            break;
        }
    }
    if !has_column {
        conn.execute(
            &format!("ALTER TABLE jobs ADD COLUMN {column} {column_def}"),
            [],
        )?;
    }
    Ok(())
}

fn row_to_job_event(row: &Row<'_>) -> rusqlite::Result<JobEventRecord> {
    let payload_json: Option<String> = row.get(6)?;
    Ok(JobEventRecord {
        job_id: row.get(0)?,
        seq: row.get(1)?,
        ts: row.get(2)?,
        level: row.get(3)?,
        stage: row.get(4)?,
        event: row.get(5)?,
        payload: payload_json.and_then(|text| serde_json::from_str(&text).ok()),
        message: row.get(7)?,
    })
}

fn row_to_job_artifact_record(row: &Row<'_>) -> rusqlite::Result<JobArtifactRecord> {
    Ok(JobArtifactRecord {
        job_id: row.get(0)?,
        artifact_key: row.get(1)?,
        artifact_group: row.get(2)?,
        artifact_kind: row.get(3)?,
        relative_path: row.get(4)?,
        file_name: row.get(5)?,
        content_type: row.get(6)?,
        ready: row.get::<_, i64>(7)? != 0,
        size_bytes: row.get::<_, Option<i64>>(8)?.map(|value| value as u64),
        checksum: row.get(9)?,
        source_stage: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn row_to_glossary_record(row: &Row<'_>) -> rusqlite::Result<GlossaryRecord> {
    let entries_json: String = row.get(2)?;
    Ok(GlossaryRecord {
        glossary_id: row.get(0)?,
        name: row.get(1)?,
        entries: serde_json::from_str(&entries_json).unwrap_or_default(),
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

#[derive(Clone)]
pub struct Db {
    path: PathBuf,
    data_root: PathBuf,
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
                failure_json TEXT,
                artifacts_json TEXT
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
                event TEXT NOT NULL,
                payload_json TEXT,
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
        let mut conn = self.connect()?;
        ensure_jobs_column(&conn, "runtime_json", "TEXT")?;
        ensure_jobs_column(&conn, "failure_json", "TEXT")?;
        migrate_legacy_artifacts(&mut conn, &self.data_root)?;
        Ok(())
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
                progress_current, progress_total, log_tail_json, result_json, runtime_json,
                failure_json, artifacts_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                failure_json=excluded.failure_json,
                artifacts_json=excluded.artifacts_json
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
                Option::<String>::None,
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
            jobs.push(row?);
        }
        Ok(jobs)
    }

    pub fn append_event(
        &self,
        job_id: &str,
        level: &str,
        stage: Option<String>,
        event: &str,
        message: &str,
        payload: Option<Value>,
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
        tx.execute(
            r#"
            INSERT INTO events (job_id, seq, ts, level, stage, event, payload_json, message)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                job_id,
                next_seq,
                ts,
                level,
                stage,
                event,
                payload_json,
                message
            ],
        )?;
        tx.commit()?;
        Ok(JobEventRecord {
            job_id: job_id.to_string(),
            seq: next_seq,
            ts,
            level: level.to_string(),
            stage,
            event: event.to_string(),
            message: message.to_string(),
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
            SELECT job_id, seq, ts, level, stage, event, payload_json, message
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

fn migrate_legacy_artifacts(conn: &mut Connection, data_root: &Path) -> Result<()> {
    let legacy_rows = {
        let mut stmt = conn.prepare(
            r#"
            SELECT job_id, artifacts_json
            FROM jobs
            WHERE artifacts_json IS NOT NULL AND TRIM(artifacts_json) <> ''
            "#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut rows_out = Vec::new();
        for row in rows {
            rows_out.push(row?);
        }
        rows_out
    };
    if legacy_rows.is_empty() {
        return Ok(());
    }

    let tx = conn.transaction()?;
    for (job_id, artifacts_json) in legacy_rows {
        let artifacts = parse_legacy_artifacts_json(&artifacts_json)?;
        if let Some(mut artifacts) = artifacts {
            normalize_job_artifacts_for_storage(data_root, &mut artifacts)?;
            tx.execute(
                r#"
                INSERT INTO artifacts (job_id, artifacts_json)
                VALUES (?1, ?2)
                ON CONFLICT(job_id) DO UPDATE SET
                    artifacts_json=excluded.artifacts_json
                "#,
                params![job_id, serde_json::to_string(&artifacts)?],
            )?;
        } else {
            tx.execute("DELETE FROM artifacts WHERE job_id = ?1", params![job_id])?;
        }
        tx.execute(
            "UPDATE jobs SET artifacts_json = NULL WHERE job_id = ?1",
            params![job_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

fn parse_legacy_artifacts_json(raw: &str) -> Result<Option<JobArtifacts>> {
    if let Ok(artifacts) = serde_json::from_str::<Option<JobArtifacts>>(raw) {
        return Ok(artifacts);
    }
    Ok(Some(serde_json::from_str::<JobArtifacts>(raw)?))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use rusqlite::Connection;

    use super::*;
    use crate::models::CreateJobInput;

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
        let legacy_artifacts_json: Option<String> = conn
            .query_row(
                "SELECT artifacts_json FROM jobs WHERE job_id = ?1",
                params![job.job_id],
                |row| row.get(0),
            )
            .expect("query legacy artifacts json");
        assert!(legacy_artifacts_json.is_none());

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
            summary: "外部服务请求超时".to_string(),
            root_cause: Some("测试失败归因".to_string()),
            retryable: true,
            upstream_host: Some("api.deepseek.com".to_string()),
            provider: Some("mineru".to_string()),
            suggestion: Some("重试".to_string()),
            last_log_line: Some("ReadTimeout".to_string()),
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
    fn init_migrates_legacy_artifacts_json_into_split_table() {
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
                progress_current, progress_total, log_tail_json, result_json, artifacts_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
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
                artifacts_json,
            ],
        )
        .expect("insert legacy row");
        drop(conn);

        let db = fs.db();
        db.init().expect("init db with migration");

        let conn = Connection::open(&fs.db_path).expect("reopen sqlite");
        let migrated_artifacts_json: String = conn
            .query_row(
                "SELECT artifacts_json FROM artifacts WHERE job_id = ?1",
                params!["job-legacy"],
                |row| row.get(0),
            )
            .expect("query migrated artifacts");
        assert!(migrated_artifacts_json.contains("jobs/job-legacy/rendered/out.pdf"));

        let legacy_artifacts_json: Option<String> = conn
            .query_row(
                "SELECT artifacts_json FROM jobs WHERE job_id = ?1",
                params!["job-legacy"],
                |row| row.get(0),
            )
            .expect("query cleared legacy artifacts");
        assert!(legacy_artifacts_json.is_none());

        let loaded = db.get_job("job-legacy").expect("load migrated job");
        let artifacts = loaded.artifacts.expect("artifacts");
        assert_eq!(
            artifacts.output_pdf.as_deref(),
            Some("jobs/job-legacy/rendered/out.pdf")
        );
    }
}
