use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Context, Result};
use rusqlite::Connection;

#[path = "db/accounts.rs"]
mod accounts;
#[path = "db/admin_users.rs"]
mod admin_users;
#[path = "db/invites.rs"]
mod invites;
#[path = "db/ownership.rs"]
mod ownership;
#[path = "db/page_quota.rs"]
mod page_quota;
#[path = "db/platform_settings.rs"]
mod platform_settings;
#[path = "db/artifacts.rs"]
mod artifacts;
#[path = "db/backup.rs"]
pub mod backup;
#[path = "db/collections.rs"]
mod collections;
#[path = "db/document_metadata_suggestions.rs"]
mod document_metadata_suggestions;
#[path = "db/documents.rs"]
pub mod documents;
#[path = "db/event_feed.rs"]
mod event_feed;
#[path = "db/event_projection_inputs.rs"]
mod event_projection_inputs;
#[path = "db/events.rs"]
mod events;
#[path = "db/glossaries.rs"]
mod glossaries;
#[path = "db/job_writes.rs"]
mod job_writes;
#[path = "db/jobs.rs"]
mod jobs;
#[path = "db/maintenance.rs"]
mod maintenance;
#[path = "db/model_requests.rs"]
mod model_requests;
#[path = "db/ocr_recovery.rs"]
mod ocr_recovery;
#[path = "db/pipeline/mod.rs"]
mod pipeline;
#[path = "db/retention.rs"]
mod retention;
#[path = "db/rows.rs"]
mod rows;
#[path = "db/schema/mod.rs"]
mod schema;
#[path = "db/snapshot_diff.rs"]
pub mod snapshot_diff;
#[path = "db/sync.rs"]
pub mod sync;
#[path = "db/translation_versions.rs"]
mod translation_versions;
#[path = "db/uploads.rs"]
mod uploads;

pub use accounts::{username_key, UserRecord, UsernameTaken};
pub use admin_users::{OwnerJobRow, UserListPage, UserListQuery, UserListRow, UserSortKey, UserStats, UserStatusFilter};
pub use invites::{InviteRecord, InviteUnavailable, InviteUser};
pub use ownership::OwnedKind;
pub use platform_settings::PlatformSettingsRecord;
pub use translation_versions::TranslationVersionRecord;
pub use page_quota::{
    BillingSource, PageBalanceWouldGoNegative, PageChargeRecord, PageLedgerEntry, PageReservation,
};

/// 单机模式的本机用户，也是归属列的默认值。
pub const LOCAL_OWNER: &str = "local";

use schema::{
    ensure_legacy_columns, ensure_no_legacy_artifacts_json, run_versioned_migrations,
};

/// How long a connection will wait for a lock held by another writer before
/// giving up with `SQLITE_BUSY`. Without this, concurrent writers (e.g. the
/// job runner appending events while a route handler reads job state) can
/// fail outright instead of just waiting briefly for the other side to
/// finish its transaction.
/// Tunable via `RUST_API_DB_BUSY_TIMEOUT_MS` (default 5000), also exposed
/// via `retainpdf_core::config::DbConfig`.
/// 进程里第一次打开 SQLite 之前关掉它的内存统计（`SQLITE_CONFIG_MEMSTATUS`）。
///
/// 自带编译的 SQLite 默认开着这项统计，每次分配内存都要拿一把全进程共享的锁；我们每次库操作都新开连接、
/// 重新解析表结构，分配很多，并行时全在这把锁上排队（2026-10-30 实测：rust_api 的 557 个测试并行和串行
/// 一样慢，关掉后 109 s → 27 s）。代码里没有用到内存统计（`sqlite3_memory_used`、`soft_heap_limit`）。
/// 这个设置只在 SQLite 初始化之前有效，所以每个打开连接的地方先调它；之后再调什么都不做。
pub fn configure_sqlite_process() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        // SAFETY: sqlite3_config 只能在 sqlite3_initialize 之前、没有别的线程用 SQLite 时调用；
        // Once 保证只调一次，而且这里在本进程第一次打开连接之前。已经初始化过时它返回 SQLITE_MISUSE，不改任何东西。
        unsafe {
            rusqlite::ffi::sqlite3_config(rusqlite::ffi::SQLITE_CONFIG_MEMSTATUS, 0 as std::os::raw::c_int);
        }
    });
}

fn db_busy_timeout() -> Duration {
    // Single source: retainpdf_core::config::env_vars::env_u64 (handles trimming/0-filter)
    // Fallback keeps Db usable even without AppConfig (unit tests / jobsd standalone).
    Duration::from_millis(retainpdf_core::config::env_vars::env_u64(
        "RUST_API_DB_BUSY_TIMEOUT_MS",
        5_000,
    ))
}

#[derive(Clone)]
pub struct Db {
    path: PathBuf,
    data_root: PathBuf,
    /// Guards one-time (per `Db` instance) execution of the schema-creation
    /// batch; see `ensure_schema()`.
    schema_ready: Arc<Mutex<bool>>,
    /// 恢复备份期间拿写锁，建任务、上传落库拿读锁（见 `backup.rs` 的 [`Db::hold_off_restore`]）。
    /// 同一个 `Db` 的克隆共用；只管本进程。
    restore_gate: Arc<std::sync::RwLock<()>>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct JobProcessRecord {
    pub job_id: String,
    pub pid: Option<u32>,
    /// spawn 时记下的进程身份（`<pid>@<指纹>`）；老行、读不到身份的平台为 None。
    pub worker_identity: Option<String>,
    pub stage: Option<String>,
    pub updated_at: String,
}

pub use document_metadata_suggestions::{
    ApplyDocumentMetadataSuggestionResult, StoredDocumentMetadataSuggestion,
};
pub use event_feed::{
    EventSourceVersion, NewFeedItem, SourceEvent, StoredEventFeed, StoredFeedItem,
};
pub use event_projection_inputs::EventProjectionInput;
pub use job_writes::NewRunWrite;
pub use jobs::JobListSelection;
pub use maintenance::CompactReport;
pub use model_requests::{
    ModelOperation, ModelRecoverySummary, ModelReservation, ModelSession, ModelSessionConflict,
};
pub use pipeline::AutoResumeTally;
pub use pipeline::{
    PipelineAttemptCursor, PipelineCheckpoint, PipelineCommitEventRecord, PipelineDispatchBegin,
    PipelineDispatchIntent, PipelineDispatchRecord, PipelineStageObservation, PipelineStageState,
    PipelineUnitCommit, PipelineUnitRecord, RevisedPagePublication, RevisedPageStatus,
    RevisedTranslationPage,
};

impl Db {
    pub fn new(path: PathBuf, data_root: PathBuf) -> Self {
        Self {
            path,
            data_root,
            schema_ready: Arc::new(Mutex::new(false)),
            restore_gate: Arc::new(std::sync::RwLock::new(())),
        }
    }

    /// 数据库文件路径。
    pub fn path(&self) -> &std::path::Path {
        &self.path
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
        configure_sqlite_process();
        let conn = Connection::open(&self.path)?;
        conn.busy_timeout(db_busy_timeout())?;
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
        // 结构要升级时先存一份备份(只在这个 Db 第一次连上时看一次)。
        let require_backup = retainpdf_core::config::DbConfig::from_env().require_upgrade_backup;
        backup::backup_before_upgrade(conn, &self.data_root, require_backup)?;
        Self::apply_schema(conn)?;
        *ready = true;
        Ok(())
    }

    /// 建表、补列、跑版本化迁移(都幂等)。恢复备份后也用它把旧结构补到最新。
    fn apply_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            // 最早几张表的幂等建表：schema/base.sql
            include_str!("db/schema/base.sql"),
        )?;
        // 早的编号迁移要用到老表后来加的列（pre-library 的库上没有），先补列再跑迁移阶梯。
        ensure_legacy_columns(conn)?;
        // 图书馆表走版本化迁移,随 schema 保证存在(不依赖 init 被调用)
        run_versioned_migrations(conn)?;
        // 上传按内容找书用的索引：建在迁移之后（很老的库上 uploads.content_hash 是迁移补的）。以前写在 init() 里。
        conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_uploads_content_hash ON uploads(content_hash);")?;
        Ok(())
    }

    pub fn init(&self) -> Result<()> {
        // 老表的列在 connect() 里的 apply_schema 已经补齐（`LEGACY_COLUMNS`）。
        let conn = self.connect()?;
        ensure_no_legacy_artifacts_json(&conn)?;
        self.backfill_library_records()?;
        Ok(())
    }

    pub fn ping(&self) -> Result<()> {
        let conn = self.connect()?;
        conn.query_row("SELECT 1", [], |_| Ok(()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    /// 测试里直接开的连接也先关内存统计：有的测试先于 `Db` 开连接，不然 SQLite 按默认初始化。
    fn open_raw(path: impl AsRef<std::path::Path>) -> rusqlite::Result<Connection> {
        super::configure_sqlite_process();
        Connection::open(path)
    }

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
    fn the_dead_tables_are_gone_after_the_migrations() {
        // v31（2026-11-20）：RetainPDF 自己的 AI 留下的表和收藏删了；它们身上的同步触发器、索引也跟着没了，
        // 书照常能写（documents 上没有指向它们的外键）
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");
        let conn = open_raw(&fs.db_path).expect("open sqlite");
        let dead = [
            "favorites", "assets", "ai_conversations", "ai_messages", "agent_calculation_runs",
            "agent_calculation_artifacts", "document_operations", "document_operation_attempts",
            "document_operation_events", "document_versions",
        ];
        for table in dead {
            let left: i64 = conn
                .query_row("SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = ?1", params![table], |row| row.get(0))
                .expect("query sqlite_master");
            assert_eq!(left, 0, "{table} 和它的索引、触发器都该删了");
        }
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute(
            "INSERT INTO documents(document_id, title, source_filename, added_at, updated_at) VALUES('d1', 'Book', 'b.pdf', 't', 't')",
            [],
        )
        .expect("documents still writable");
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

        let conn = open_raw(&fs.db_path).expect("open sqlite");
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
            resume_from: None,
            recovery_hint: None,
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

    /// 编号迁移以前的老库：四张老表都缺后来加的列（`LEGACY_COLUMNS`）。
    ///
    /// 要是 WAL：真实的库从第一次连上就是（`apply_schema` 头一句），这个模式记在文件里。造成默认的回滚日志模式的话，
    /// 几个连接同时把它切成 WAL 会直接 `database is locked`（切日志模式不等忙），测的就不是补列的竞争了。
    fn create_pre_library_tables(db_path: &Path) {
        let conn = open_raw(db_path).expect("open sqlite");
        conn.execute_batch(
            r#"
            PRAGMA journal_mode=WAL;
            CREATE TABLE uploads (
                upload_id TEXT PRIMARY KEY, filename TEXT NOT NULL, stored_path TEXT NOT NULL,
                bytes INTEGER NOT NULL, page_count INTEGER NOT NULL, uploaded_at TEXT NOT NULL,
                developer_mode INTEGER NOT NULL
            );
            CREATE TABLE jobs (
                job_id TEXT PRIMARY KEY, workflow TEXT NOT NULL, status_json TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL, started_at TEXT, finished_at TEXT,
                upload_id TEXT, pid INTEGER, command_json TEXT NOT NULL, request_json TEXT NOT NULL,
                error TEXT, stage TEXT, stage_detail TEXT, progress_current INTEGER,
                progress_total INTEGER, log_tail_json TEXT NOT NULL, result_json TEXT
            );
            CREATE TABLE events (
                job_id TEXT NOT NULL, seq INTEGER NOT NULL, ts TEXT NOT NULL, level TEXT NOT NULL,
                stage TEXT, event TEXT NOT NULL, payload_json TEXT, message TEXT NOT NULL,
                PRIMARY KEY(job_id, seq)
            );
            CREATE TABLE glossaries (
                glossary_id TEXT PRIMARY KEY, name TEXT NOT NULL, entries_json TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            "#,
        )
        .expect("create pre-library tables");
    }

    fn columns_of(db_path: &Path, table: &str) -> Vec<String> {
        let conn = open_raw(db_path).expect("open sqlite");
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})")).unwrap();
        let rows = stmt.query_map([], |row| row.get::<_, String>(1)).unwrap();
        rows.map(Result::unwrap).collect()
    }

    #[test]
    fn a_pre_library_database_gets_every_later_column_and_runs_the_migrations() {
        let fs = TestDbFs::new();
        create_pre_library_tables(&fs.db_path);

        fs.db().init().expect("upgrade old database");

        // 以前一半在 apply_schema 里补、一半只在 init 里补；这里不照抄 LEGACY_COLUMNS，少了哪一列都要红。
        for (table, expected) in [
            ("jobs", &["document_id", "run_generation", "worker_identity", "runtime_json", "failure_json"][..]),
            (
                "events",
                &[
                    "stage_detail", "provider", "provider_stage", "event_type",
                    "progress_current", "progress_total", "retry_count", "elapsed_ms",
                ][..],
            ),
            ("glossaries", &["description", "source_lang", "target_lang", "enabled"][..]),
            ("uploads", &["content_hash"][..]),
        ] {
            let columns = columns_of(&fs.db_path, table);
            for column in expected {
                assert!(columns.iter().any(|c| c == column), "{table}.{column} 没补上：{columns:?}");
            }
        }
        let version: i64 = open_raw(&fs.db_path)
            .unwrap()
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, schema::versioned_migration_count());
        // 再起一次什么都不用补。
        fs.db().init().expect("second start");
    }

    /// 新建空库跑完全部建表和迁移的结构快照（2026-11-20）：`database/retainpdf-db/schema.sql`。
    /// 看「现在每张表长什么样」只看那一个文件；结构变了这里红，`UPDATE_SCHEMA=1` 重新生成，看 diff。
    fn fresh_schema(canonical: bool) -> String {
        let fs = TestDbFs::new();
        fs.db().init().expect("init fresh database");
        schema::describe_schema(&open_raw(&fs.db_path).unwrap(), canonical).unwrap()
    }

    #[test]
    fn the_schema_snapshot_is_up_to_date() {
        let got = format!(
            "-- 现在每张表的完整样子：新建空库跑完 schema/base.sql、LEGACY_COLUMNS 和全部编号迁移以后的结果。\n\
             -- 测试生成，不要手改：UPDATE_SCHEMA=1 cargo test -p retainpdf-db schema_snapshot\n\
             -- 主键写成 PRIMARY KEY#n（复合主键里的第几列）；FTS5 自己的影子表不单列。\n{}",
            fresh_schema(false)
        );
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("schema.sql");
        if std::env::var_os("UPDATE_SCHEMA").is_some() {
            fs::write(&path, &got).expect("write schema snapshot");
            return;
        }
        let want = fs::read_to_string(&path).unwrap_or_default();
        assert!(got == want, "表结构和 schema.sql 不一样：UPDATE_SCHEMA=1 cargo test -p retainpdf-db schema_snapshot 重新生成，看 diff");
    }

    /// 老库一路升上来，和新建的库应当一模一样（列顺序不算：ALTER 补的列排在最后）。
    #[test]
    fn an_old_database_upgraded_matches_a_fresh_one() {
        let fs = TestDbFs::new();
        create_pre_library_tables(&fs.db_path);
        fs.db().init().expect("upgrade old database");
        let upgraded = schema::describe_schema(&open_raw(&fs.db_path).unwrap(), true).unwrap();
        let fresh = fresh_schema(true);
        let only = |a: &str, b: &str| a.lines().filter(|line| !b.lines().any(|other| other == *line)).map(str::to_string).collect::<Vec<_>>();
        assert!(
            upgraded == fresh,
            "老库升上来和新建的库不一样\n只在老库：{:#?}\n只在新库：{:#?}",
            only(&upgraded, &fresh),
            only(&fresh, &upgraded)
        );
    }

    /// 只读比对一个真实的库和新建的库（默认不跑）：
    /// `RETAINPDF_COMPARE_DB=<库文件> cargo test -p retainpdf-db compare_a_real_database -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn compare_a_real_database_with_a_fresh_one() {
        let path = std::env::var("RETAINPDF_COMPARE_DB").expect("RETAINPDF_COMPARE_DB");
        let conn = rusqlite::Connection::open_with_flags(&path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).unwrap();
        let real = schema::describe_schema(&conn, true).unwrap();
        let fresh = fresh_schema(true);
        let only = |a: &str, b: &str| a.lines().filter(|line| !b.lines().any(|other| other == *line)).map(str::to_string).collect::<Vec<_>>();
        println!("只在真实库：{:#?}", only(&real, &fresh));
        println!("只在新库：{:#?}", only(&fresh, &real));
    }

    /// rust_api 和 jobsd 同时起来升级同一个老库：以前两边都看到缺列、都去 ALTER，后到的报 duplicate column。
    #[test]
    fn processes_upgrading_an_old_database_together_all_start() {
        for _ in 0..10 {
            let fs = TestDbFs::new();
            create_pre_library_tables(&fs.db_path);
            let barrier = std::sync::Arc::new(std::sync::Barrier::new(4));
            let handles: Vec<_> = (0..4)
                .map(|_| {
                    let db = fs.db();
                    let barrier = barrier.clone();
                    std::thread::spawn(move || {
                        barrier.wait();
                        db.init().map_err(|error| format!("{error:#}"))
                    })
                })
                .collect();
            for handle in handles {
                handle.join().expect("thread").expect("every process starts");
            }
        }
    }

    #[test]
    fn init_rejects_legacy_artifacts_json_storage() {
        let fs = TestDbFs::new();
        let job = sample_job("job-legacy", &fs.data_root);
        let artifacts_json = serde_json::to_string(&job.artifacts).expect("serialize artifacts");

        let conn = open_raw(&fs.db_path).expect("open sqlite");
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

    /// 插一条读不出来的任务行（request_json 对不上当前的类型），可选地挂到一本书上。
    fn insert_malformed_job(db_path: &Path, job_id: &str, document_id: Option<&str>) {
        let conn = open_raw(db_path).expect("open sqlite");
        conn.execute(
            r#"
            INSERT INTO jobs (
                job_id, workflow, status, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                job_id,
                WorkflowKind::Book.as_str(),
                JobStatusKind::Succeeded.as_str(),
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
        if let Some(document_id) = document_id {
            conn.execute(
                "UPDATE jobs SET document_id = ?1 WHERE job_id = ?2",
                params![document_id, job_id],
            )
            .expect("attach malformed row to a document");
        }
    }

    #[test]
    fn list_jobs_skips_malformed_rows_instead_of_failing() {
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");

        let valid_job = sample_job("job-valid", &fs.data_root);
        db.save_job(&valid_job).expect("save valid job");
        insert_malformed_job(&fs.db_path, "job-bad", None);

        let jobs = db.list_jobs(20, 0, None, None).expect("list jobs");
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].job_id, "job-valid");
    }

    #[test]
    fn list_jobs_for_document_skips_malformed_rows_like_the_other_lists() {
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");

        db.save_job(&sample_job("job-valid", &fs.data_root)).expect("save valid job");
        let conn = open_raw(&fs.db_path).expect("open sqlite");
        conn.execute("UPDATE jobs SET document_id = 'doc-1' WHERE job_id = 'job-valid'", [])
            .expect("attach valid job");
        drop(conn);
        insert_malformed_job(&fs.db_path, "job-bad", Some("doc-1"));

        let jobs = db.list_jobs_for_document("doc-1", 20, 0).expect("one bad row must not fail the list");
        assert_eq!(jobs.iter().map(|job| job.job_id.as_str()).collect::<Vec<_>>(), ["job-valid"]);
    }

    #[test]
    fn get_job_tells_a_missing_row_from_one_that_cannot_be_read() {
        let fs = TestDbFs::new();
        let db = fs.db();
        db.init().expect("init db");
        insert_malformed_job(&fs.db_path, "job-bad", None);

        let is_no_rows = |error: &anyhow::Error| {
            matches!(error.downcast_ref::<rusqlite::Error>(), Some(rusqlite::Error::QueryReturnedNoRows))
        };
        let missing = db.get_job("job-nope").expect_err("missing row");
        assert!(is_no_rows(&missing), "{missing:#}");
        let unreadable = db.get_job("job-bad").expect_err("unreadable row");
        assert!(!is_no_rows(&unreadable), "{unreadable:#}");
        // 书、上传：「没有」同样带 QueryReturnedNoRows，调用方才能把它和别的错误分开。
        assert!(is_no_rows(&db.get_document("doc-nope").expect_err("missing document")));
        assert!(is_no_rows(&db.get_upload("up-nope").expect_err("missing upload")));
    }
}
