use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{Mutex, RwLock, Semaphore};
use tracing::warn;

use super::state_recovery::reconcile_stale_running_jobs;
use crate::config::AppConfig;
use crate::db::Db;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db: Arc<Db>,
    pub downloads_lock: Arc<Mutex<()>>,
    pub canceled_jobs: Arc<RwLock<HashSet<String>>>,
    pub job_slots: Arc<Semaphore>,
}

pub fn build_state(config: Arc<AppConfig>) -> Result<AppState> {
    let db = Arc::new(Db::new(
        config.jobs_db_path.clone(),
        config.data_root.clone(),
    ));
    db.init()?;
    let cleaned_legacy_workflows = db.cleanup_legacy_workflows()?;
    if cleaned_legacy_workflows > 0 {
        warn!(
            "startup cleanup migrated {cleaned_legacy_workflows} legacy workflow row(s) from mineru to book"
        );
    }
    reconcile_stale_running_jobs(config.as_ref(), db.as_ref())?;

    Ok(AppState {
        config: config.clone(),
        db,
        downloads_lock: Arc::new(Mutex::new(())),
        canceled_jobs: Arc::new(RwLock::new(HashSet::new())),
        job_slots: Arc::new(Semaphore::new(config.max_running_jobs)),
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Arc;

    use rusqlite::{params, Connection};

    use super::*;
    use crate::models::{now_iso, CreateJobInput, JobStatusKind};

    struct TestStateFs {
        root: PathBuf,
        data_root: PathBuf,
        jobs_db_path: PathBuf,
        output_root: PathBuf,
        rust_api_root: PathBuf,
        scripts_dir: PathBuf,
        uploads_dir: PathBuf,
        downloads_dir: PathBuf,
    }

    impl TestStateFs {
        fn new(test_name: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "rust-api-build-state-{test_name}-{}-{}",
                std::process::id(),
                now_iso().replace([':', '.'], "-")
            ));
            let data_root = root.join("data");
            let output_root = data_root.join("jobs");
            let uploads_dir = data_root.join("uploads");
            let downloads_dir = data_root.join("downloads");
            let jobs_db_path = data_root.join("db").join("jobs.db");
            let rust_api_root = root.join("rust_api");
            let scripts_dir = root.join("scripts");
            fs::create_dir_all(&output_root).expect("create output root");
            fs::create_dir_all(&uploads_dir).expect("create uploads dir");
            fs::create_dir_all(&downloads_dir).expect("create downloads dir");
            fs::create_dir_all(jobs_db_path.parent().expect("db dir")).expect("create db dir");
            fs::create_dir_all(&rust_api_root).expect("create rust_api root");
            fs::create_dir_all(&scripts_dir).expect("create scripts dir");
            Self {
                root,
                data_root,
                jobs_db_path,
                output_root,
                rust_api_root,
                scripts_dir,
                uploads_dir,
                downloads_dir,
            }
        }

        fn config(&self) -> Arc<AppConfig> {
            Arc::new(AppConfig {
                project_root: self.root.clone(),
                rust_api_root: self.rust_api_root.clone(),
                data_root: self.data_root.clone(),
                scripts_dir: self.scripts_dir.clone(),
                run_provider_case_script: self.scripts_dir.join("run_provider_case.py"),
                run_provider_ocr_script: self.scripts_dir.join("run_provider_ocr.py"),
                run_normalize_ocr_script: self.scripts_dir.join("run_normalize_ocr.py"),
                run_translate_from_ocr_script: self.scripts_dir.join("run_translate_from_ocr.py"),
                run_translate_only_script: self.scripts_dir.join("run_translate_only.py"),
                run_render_only_script: self.scripts_dir.join("run_render_only.py"),
                run_failure_ai_diagnosis_script: self
                    .scripts_dir
                    .join("diagnose_failure_with_ai.py"),
                uploads_dir: self.uploads_dir.clone(),
                downloads_dir: self.downloads_dir.clone(),
                jobs_db_path: self.jobs_db_path.clone(),
                output_root: self.output_root.clone(),
                python_bin: "python3".to_string(),
                bind_host: "127.0.0.1".to_string(),
                port: 41000,
                simple_port: 42000,
                upload_max_bytes: 0,
                upload_max_pages: 0,
                api_keys: HashSet::from(["test-key".to_string()]),
                max_running_jobs: 4,
                provider_limits: crate::config::ProviderLimitsConfig::default(),
                provider_runtime: crate::config::ProviderRuntimeConfig::default(),
                job_runner: crate::config::JobRunnerConfig::default(),
            })
        }

        fn db(&self) -> Db {
            Db::new(self.jobs_db_path.clone(), self.data_root.clone())
        }
    }

    impl Drop for TestStateFs {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn sample_running_job(job_id: &str, pid: Option<u32>) -> crate::models::JobSnapshot {
        let mut job = crate::models::JobSnapshot::new(
            job_id.to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.status = JobStatusKind::Running;
        job.started_at = Some("2026-04-02T00:00:00Z".to_string());
        job.updated_at = "2026-04-02T00:10:00Z".to_string();
        job.pid = pid;
        job.stage = Some("translation_prepare".to_string());
        job.stage_detail = Some("正在运行".to_string());
        job.sync_runtime_state();
        job
    }

    #[test]
    fn build_state_reconciles_running_jobs_without_pid() {
        let fs = TestStateFs::new("missing-pid");
        let db = fs.db();
        db.init().expect("init db");
        db.save_job(&sample_running_job("job-missing-pid", None))
            .expect("save job");

        let state = build_state(fs.config()).expect("build state");
        let job = state.db.get_job("job-missing-pid").expect("get job");

        assert_eq!(job.status, JobStatusKind::Failed);
        assert_eq!(job.pid, None);
        assert_eq!(job.stage.as_deref(), Some("failed"));
        assert_eq!(
            job.failure
                .as_ref()
                .map(|failure| failure.category.as_str()),
            Some("worker_process_missing")
        );
        assert!(job
            .error
            .as_deref()
            .is_some_and(|detail| detail.contains("未记录 worker pid")));
        assert_eq!(
            state
                .db
                .count_jobs_with_status(&JobStatusKind::Running)
                .expect("count running"),
            0
        );
    }

    #[cfg(unix)]
    #[test]
    fn build_state_reconciles_running_jobs_with_dead_pid() {
        let fs = TestStateFs::new("dead-pid");
        let db = fs.db();
        db.init().expect("init db");
        db.save_job(&sample_running_job("job-dead-pid", Some(999_999)))
            .expect("save job");

        let state = build_state(fs.config()).expect("build state");
        let job = state.db.get_job("job-dead-pid").expect("get job");

        assert_eq!(job.status, JobStatusKind::Failed);
        assert_eq!(job.pid, None);
        assert!(job
            .error
            .as_deref()
            .is_some_and(|detail| detail.contains("已不存在")));
        assert_eq!(
            state
                .db
                .count_jobs_with_status(&JobStatusKind::Running)
                .expect("count running"),
            0
        );
    }

    #[test]
    fn build_state_reconciles_malformed_running_rows_via_raw_db_fallback() {
        let fs = TestStateFs::new("malformed-running-row");
        let db = fs.db();
        db.init().expect("init db");

        let conn = Connection::open(&fs.jobs_db_path).expect("open sqlite");
        conn.execute(
            r#"
            INSERT INTO jobs (
                job_id, workflow, status_json, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                "job-malformed-running",
                serde_json::to_string(&crate::models::WorkflowKind::Book).expect("workflow json"),
                serde_json::to_string(&JobStatusKind::Running).expect("status json"),
                "2026-04-02T00:00:00Z",
                "2026-04-02T00:10:00Z",
                "2026-04-02T00:00:00Z",
                Option::<String>::None,
                Option::<String>::None,
                Option::<i64>::None,
                "[\"python\"]",
                "{\"invalid\":true}",
                Option::<String>::None,
                "mineru_upload",
                "正在运行",
                Option::<i64>::None,
                Option::<i64>::None,
                "[]",
                Option::<String>::None,
                Option::<String>::None,
                Option::<String>::None,
            ],
        )
        .expect("insert malformed row");

        let state = build_state(fs.config()).expect("build state");
        assert_eq!(
            state
                .db
                .count_jobs_with_status(&JobStatusKind::Running)
                .expect("count running"),
            0
        );

        let row = conn
            .query_row(
                "SELECT status_json, pid, stage, error, failure_json FROM jobs WHERE job_id = ?1",
                params!["job-malformed-running"],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                    ))
                },
            )
            .expect("query recovered row");
        assert_eq!(
            row.0,
            serde_json::to_string(&JobStatusKind::Failed).expect("failed status json")
        );
        assert_eq!(row.1, None);
        assert_eq!(row.2.as_deref(), Some("failed"));
        assert!(row
            .3
            .as_deref()
            .is_some_and(|detail| detail.contains("未记录 worker pid")));
        assert!(row
            .4
            .as_deref()
            .is_some_and(|failure| failure.contains("worker_process_missing")));
    }

    #[test]
    fn build_state_cleans_legacy_workflow_rows() {
        let fs = TestStateFs::new("cleanup-legacy-workflow");
        let db = fs.db();
        db.init().expect("init db");

        let conn = Connection::open(&fs.jobs_db_path).expect("open sqlite");
        conn.execute(
            r#"
            INSERT INTO jobs (
                job_id, workflow, status_json, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                "job-legacy-workflow",
                "\"mineru\"",
                serde_json::to_string(&JobStatusKind::Succeeded).expect("status json"),
                "2026-04-02T00:00:00Z",
                "2026-04-02T00:10:00Z",
                Option::<String>::None,
                Some("2026-04-02T00:10:00Z".to_string()),
                Option::<String>::None,
                Option::<i64>::None,
                "[\"python\",\"run_mineru_case.py\"]",
                "{\"workflow\":\"mineru\",\"ocr_provider\":\"mineru\"}",
                Option::<String>::None,
                "finished",
                "历史任务",
                Option::<i64>::None,
                Option::<i64>::None,
                "[]",
                Option::<String>::None,
                Option::<String>::None,
                Option::<String>::None,
            ],
        )
        .expect("insert legacy workflow row");
        conn.execute(
            r#"
            INSERT INTO events (
                job_id, seq, ts, level, stage, event, payload_json, message
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                "job-legacy-workflow",
                1,
                "2026-04-02T00:00:00Z",
                "info",
                "finished",
                "job_created",
                "{\"workflow\":\"mineru\"}",
                "created",
            ],
        )
        .expect("insert legacy event");

        let _state = build_state(fs.config()).expect("build state");

        let workflow: String = conn
            .query_row(
                "SELECT workflow FROM jobs WHERE job_id = ?1",
                params!["job-legacy-workflow"],
                |row| row.get(0),
            )
            .expect("workflow");
        assert_eq!(workflow, "\"book\"");

        let request_json: String = conn
            .query_row(
                "SELECT request_json FROM jobs WHERE job_id = ?1",
                params!["job-legacy-workflow"],
                |row| row.get(0),
            )
            .expect("request json");
        assert!(request_json.contains("\"workflow\":\"book\""));

        let payload_json: String = conn
            .query_row(
                "SELECT payload_json FROM events WHERE job_id = ?1 AND seq = 1",
                params!["job-legacy-workflow"],
                |row| row.get(0),
            )
            .expect("payload json");
        assert!(payload_json.contains("\"workflow\":\"book\""));
    }
}
