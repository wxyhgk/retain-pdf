use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use rusqlite::Connection;

#[path = "db/artifacts.rs"]
mod artifacts;
#[path = "db/assets.rs"]
mod assets;
#[path = "db/collections.rs"]
mod collections;
#[path = "db/conversations.rs"]
mod conversations;
#[path = "db/documents.rs"]
pub mod documents;
#[path = "db/events.rs"]
mod events;
#[path = "db/glossaries.rs"]
mod glossaries;
#[path = "db/job_writes.rs"]
mod job_writes;
#[path = "db/jobs.rs"]
mod jobs;
#[path = "db/retention.rs"]
mod retention;
#[path = "db/rows.rs"]
mod rows;
#[path = "db/schema.rs"]
mod schema;
#[path = "db/uploads.rs"]
mod uploads;

use schema::{
    ensure_events_column, ensure_glossaries_column, ensure_jobs_column,
    ensure_no_legacy_artifacts_json, ensure_uploads_column, run_versioned_migrations,
};

/// How long a connection will wait for a lock held by another writer before
/// giving up with `SQLITE_BUSY`. Without this, concurrent writers (e.g. the
/// job runner appending events while a route handler reads job state) can
/// fail outright instead of just waiting briefly for the other side to
/// finish its transaction.
const BUSY_TIMEOUT: Duration = Duration::from_millis(5_000);

#[derive(Clone)]
pub struct Db {
    path: PathBuf,
    data_root: PathBuf,
    /// Guards one-time (per `Db` instance) execution of the schema-creation
    /// batch; see `ensure_schema()`.
    schema_ready: Arc<Mutex<bool>>,
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
        Self {
            path,
            data_root,
            schema_ready: Arc::new(Mutex::new(false)),
        }
    }

    /// Opens a connection to the database file.
    ///
    /// This only does cheap, strictly per-connection setup (busy timeout,
    /// `foreign_keys`, which SQLite does not persist across connections) and
    /// otherwise reuses the file as-is. The expensive one-time `CREATE TABLE
    /// IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` schema batch used to run
    /// on every single call to `connect()` (i.e. on every DB operation);
    /// it now runs at most once per `Db` instance via `ensure_schema()`.
    fn connect(&self) -> Result<Connection> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("failed to create db directory: {}", parent.display()))?;
        }
        let conn = Connection::open(&self.path)?;
        conn.busy_timeout(BUSY_TIMEOUT)?;
        // `journal_mode=WAL` is persisted in the database file header, so it
        // only needs to be set once ever per file (done in `ensure_schema`).
        // `foreign_keys` is a per-connection setting that SQLite resets to
        // off for every new connection, so it must be reapplied here.
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        self.ensure_schema(&conn)?;
        Ok(conn)
    }

    /// Runs the schema/migration-safe `CREATE TABLE IF NOT EXISTS` batch and
    /// enables WAL mode, but only the first time it's needed for this `Db`
    /// instance. Safe to call redundantly (all statements are idempotent);
    /// the mutex just avoids doing that redundant work under concurrent
    /// first callers.
    fn ensure_schema(&self, conn: &Connection) -> Result<()> {
        let mut ready = self
            .schema_ready
            .lock()
            .expect("db schema_ready mutex poisoned");
        if *ready {
            return Ok(());
        }
        conn.execute_batch(
            r#"
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS uploads (
                upload_id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                bytes INTEGER NOT NULL,
                page_count INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                developer_mode INTEGER NOT NULL,
                content_hash TEXT NOT NULL DEFAULT ''
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
                document_id TEXT
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
                description TEXT NOT NULL DEFAULT '',
                source_lang TEXT NOT NULL DEFAULT '',
                target_lang TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 1,
                entries_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_glossaries_updated_at ON glossaries(updated_at DESC);
            "#,
        )?;
        // Các bảng thư viện được di chuyển theo phiên bản, đảm bảo tồn tại cùng schema (không phụ thuộc vào việc gọi init)
        run_versioned_migrations(&conn)?;
        *ready = true;
        Ok(())
    }

    pub fn init(&self) -> Result<()> {
        let conn = self.connect()?;
        ensure_jobs_column(&conn, "runtime_json", "TEXT")?;
        ensure_jobs_column(&conn, "failure_json", "TEXT")?;
        ensure_glossaries_column(&conn, "description", "TEXT NOT NULL DEFAULT ''")?;
        ensure_glossaries_column(&conn, "source_lang", "TEXT NOT NULL DEFAULT ''")?;
        ensure_glossaries_column(&conn, "target_lang", "TEXT NOT NULL DEFAULT ''")?;
        ensure_glossaries_column(&conn, "enabled", "INTEGER NOT NULL DEFAULT 1")?;
        ensure_events_column(&conn, "stage_detail", "TEXT")?;
        ensure_events_column(&conn, "provider", "TEXT")?;
        ensure_events_column(&conn, "provider_stage", "TEXT")?;
        ensure_events_column(&conn, "event_type", "TEXT")?;
        ensure_events_column(&conn, "progress_current", "INTEGER")?;
        ensure_events_column(&conn, "progress_total", "INTEGER")?;
        ensure_events_column(&conn, "retry_count", "INTEGER")?;
        ensure_events_column(&conn, "elapsed_ms", "INTEGER")?;
        ensure_no_legacy_artifacts_json(&conn)?;
        ensure_uploads_column(&conn, "content_hash", "TEXT NOT NULL DEFAULT ''")?;
        ensure_jobs_column(&conn, "document_id", "TEXT")?;
        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_uploads_content_hash ON uploads(content_hash);",
        )?;
        self.backfill_library_records()?;
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

    pub fn ping(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.query_row("SELECT 1", [], |_| Ok(()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use rusqlite::{params, Connection};

    use super::*;
    use crate::models::domain::{
        now_iso, JobArtifacts, JobFailureInfo, JobSnapshot, JobStatusKind, WorkflowKind,
    };
    use crate::models::request::CreateJobInput;

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
            summary: "Yêu cầu dịch vụ bên ngoài quá thời gian chờ".to_string(),
            root_cause: Some("Nguyên nhân thất bại kiểm tra".to_string()),
            retryable: true,
            upstream_host: Some("api.deepseek.com".to_string()),
            provider: Some("mineru".to_string()),
            suggestion: Some("Thử lại".to_string()),
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
