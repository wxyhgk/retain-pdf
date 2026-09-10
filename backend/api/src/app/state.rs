use std::collections::HashSet;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{RwLock, Semaphore};
use tracing::warn;

use super::jobs::reconcile_owned_runtime;
use crate::config::AppConfig;
use crate::db::Db;
use crate::services::agent_capabilities::AgentCapabilityAuthority;
use crate::services::runtime_gateway::{JobDriverRegistry, JobRuntime};
use crate::services::uploads::{UploadService, UploadServiceConfig};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<AppConfig>,
    pub db: Arc<Db>,
    pub(crate) ai_gateway: Arc<crate::services::ai::AiGateway>,
    pub(crate) uploads: Arc<UploadService>,
    pub download_generation: Arc<crate::services::download_generation::DownloadGeneration>,
    pub canceled_jobs: Arc<RwLock<HashSet<String>>>,
    pub job_slots: Arc<Semaphore>,
    pub job_drivers: Arc<JobDriverRegistry>,
    /// 任务运行时落点（ADR-002）：进程内或远端 jobsd，装配一次此后只读。
    pub job_runtime: Arc<JobRuntime>,
    /// Per-process signing authority for short-lived, least-privilege agent capabilities.
    pub agent_capabilities: Arc<AgentCapabilityAuthority>,
    /// Staged rollout: disabled until worker pause/resume integration is enabled.
    pub model_executor: Option<Arc<crate::services::model_executor::ModelExecutor>>,
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
    reconcile_owned_runtime(config.as_ref(), db.as_ref())?;

    let canceled_jobs = Arc::new(RwLock::new(HashSet::new()));
    let job_runtime = Arc::new(if config.jobs_service.is_remote() {
        // 钥匙单源：下发壳自己的 key 集合首项，与 ai_supervisor 同规则
        let api_key = {
            let mut sorted: Vec<_> = config.api_keys.iter().cloned().collect();
            sorted.sort();
            sorted.first().cloned().unwrap_or_default()
        };
        JobRuntime::remote(&config.jobs_service, api_key)
    } else {
        JobRuntime::in_process(canceled_jobs.clone())
    });

    let model_executor = if std::env::var("RETAIN_MODEL_EXECUTOR_ENABLED").as_deref() == Ok("1") {
        Some(Arc::new(
            crate::services::model_executor::ModelExecutor::new(
                db.clone(),
                config.data_root.clone(),
            )?,
        ))
    } else {
        None
    };
    Ok(AppState {
        ai_gateway: Arc::new(crate::services::ai::AiGateway::new(
            &config.ai_proxy,
            config.ai_service.base_url(),
            crate::runtime::ai_supervisor::ai_service_status,
        )?),
        uploads: Arc::new(UploadService::new(
            db.clone(),
            UploadServiceConfig {
                uploads_dir: config.uploads_dir.clone(),
                python_bin: config.python_bin.clone(),
                upload_max_bytes: config.upload_max_bytes,
                upload_max_pages: config.upload_max_pages,
                processing: config.upload_processing.clone(),
            },
        )),
        model_executor,
        config: config.clone(),
        db,
        download_generation: Arc::default(),
        canceled_jobs,
        job_slots: Arc::new(Semaphore::new(config.max_running_jobs)),
        job_drivers: Arc::default(),
        job_runtime,
        agent_capabilities: Arc::new(AgentCapabilityAuthority::new_random()?),
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
    use crate::models::domain::{now_iso, JobSnapshot, JobStatusKind, WorkflowKind};
    use crate::models::request::CreateJobInput;

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
                uploads_dir: self.uploads_dir.clone(),
                downloads_dir: self.downloads_dir.clone(),
                jobs_db_path: self.jobs_db_path.clone(),
                output_root: self.output_root.clone(),
                python_bin: "python3".to_string(),
                pipeline_command: "retainpdf-pipeline".to_string(),
                bind_host: "127.0.0.1".to_string(),
                port: 41000,
                simple_port: 42000,
                upload_max_bytes: 0,
                upload_max_pages: 0,
                upload_processing: Default::default(),
                api_keys: HashSet::from(["test-key".to_string()]),
                max_running_jobs: 4,
                provider_limits: crate::config::ProviderLimitsConfig::default(),
                provider_runtime: crate::config::ProviderRuntimeConfig::default(),
                job_runner: crate::config::JobRunnerConfig::default(),
                ai_service: crate::config::AiServiceConfig::default(),
                jobs_service: crate::config::JobsServiceConfig::default(),
                asset: crate::config::AssetConfig::default(),
                cleanup: crate::config::CleanupConfig::default(),
                db: crate::config::DbConfig::default(),
                ai_proxy: crate::config::AiProxyConfig::default(),
                reader_llm: crate::config::ReaderLlmConfig::default(),
                rag: crate::config::RagConfig::default(),
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

    fn sample_running_job(job_id: &str, pid: Option<u32>) -> JobSnapshot {
        let mut job = JobSnapshot::new(
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

    #[tokio::test]
    async fn upload_processing_snapshot_changes_only_for_new_state() {
        use crate::services::uploads::{UploadError, UploadedPdfInput};

        let fs = TestStateFs::new("upload-config-snapshot");
        let mut config = (*fs.config()).clone();
        config.upload_processing.buffer_mib = 1;
        let original = build_state(Arc::new(config.clone())).unwrap();
        let cloned = original.clone();
        assert!(Arc::ptr_eq(&original.uploads, &cloned.uploads));

        config.upload_processing.buffer_mib = 2;
        let rebuilt = build_state(Arc::new(config)).unwrap();
        assert!(!Arc::ptr_eq(&original.uploads, &rebuilt.uploads));
        let mut bytes = crate::test_support::pdf::build_test_pdf_bytes();
        bytes.resize(1024 * 1024 + 1, b' ');
        for state in [&original, &cloned] {
            let result = state
                .uploads
                .store(UploadedPdfInput {
                    filename: "snapshot.pdf".into(),
                    bytes: bytes.clone(),
                    developer_mode: false,
                })
                .await;
            assert!(matches!(result, Err(UploadError::PayloadTooLarge(_))));
        }
        assert_eq!(fs::read_dir(&fs.uploads_dir).unwrap().count(), 0);
        let record = rebuilt
            .uploads
            .store(UploadedPdfInput {
                filename: "snapshot.pdf".into(),
                bytes,
                developer_mode: false,
            })
            .await
            .unwrap();
        assert_eq!(record.page_count, 1);
        assert!(std::path::Path::new(&record.stored_path).is_file());
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

    #[test]
    fn build_state_requeues_running_job_with_durable_pipeline_attempt() {
        let fs = TestStateFs::new("durable-restart");
        let db = fs.db();
        db.init().expect("init db");
        db.save_job(&sample_running_job("job-durable", None))
            .expect("save job");
        let cursor = db
            .acquire_pipeline_attempt("job-durable", "worker-before-restart", "translate", 1)
            .expect("seed durable attempt");
        db.commit_pipeline_unit(
            &cursor,
            &crate::db::PipelineUnitCommit {
                unit_key: "p1-u1".to_string(),
                unit_order: 1,
                page_index: Some(0),
                page_hash: "a".repeat(64),
                producer_generation: Some(1),
                payload: serde_json::json!({"phase":"translating"}),
            },
        )
        .expect("seed committed unit");

        let state = build_state(fs.config()).expect("build state");
        let job = state.db.get_job("job-durable").expect("get job");
        assert_eq!(job.status, JobStatusKind::Queued);
        assert_eq!(job.pid, None);
        assert!(job.error.is_none());
        assert!(job.failure.is_none());
        assert_eq!(
            state
                .db
                .list_resumable_pipeline_job_ids()
                .expect("resumable jobs"),
            vec!["job-durable".to_string()]
        );
    }

    #[test]
    fn service_restart_preserves_bound_ocr_receipt_recovery() {
        let fs = TestStateFs::new("bound-ocr-receipt-restart");
        let db = fs.db();
        db.init().expect("init db");
        let mut source = JobSnapshot::new(
            "job-ocr-source".to_string(),
            CreateJobInput::default(),
            vec!["native-ocr".to_string()],
        );
        source.status = JobStatusKind::Failed;
        db.save_job(&source).expect("source job");
        let intent = crate::db::PipelineDispatchIntent {
            dispatch_key: "ocr-submit".to_string(),
            provider: "mineru".to_string(),
            operation: "create_extract_task".to_string(),
            request_hash: "a".repeat(64),
        };
        let cursor = db
            .acquire_pipeline_attempt("job-ocr-source", "worker-before-crash", "ocr", 0)
            .expect("source attempt");
        db.begin_pipeline_dispatch(&cursor, &intent)
            .expect("source dispatch intent");
        let restarted = db
            .acquire_pipeline_attempt("job-ocr-source", "worker-after-crash", "ocr", 0)
            .expect("restart claim");
        assert!(matches!(
            db.begin_pipeline_dispatch(&restarted, &intent)
                .expect("ambiguous source"),
            crate::db::PipelineDispatchBegin::Ambiguous { .. }
        ));
        db.finish_latest_pipeline_attempt("job-ocr-source", "failed")
            .expect("close source attempt");
        let source_dispatch = db
            .latest_pipeline_dispatch("job-ocr-source", "ocr-submit")
            .expect("source dispatch")
            .expect("source record");
        let recovery = JobSnapshot::new(
            "job-ocr-recovery".to_string(),
            CreateJobInput::default(),
            vec!["native-ocr".to_string()],
        );
        db.create_ocr_recovery_job_state(
            &source_dispatch,
            &recovery,
            "bind_existing_receipt",
            Some(&serde_json::json!({
                "kind": "mineru_task",
                "task_id": "provider-task-existing"
            })),
        )
        .expect("atomic recovery state");
        drop(db);

        let state = build_state(fs.config()).expect("restart state");
        assert_eq!(
            state
                .db
                .list_resumable_pipeline_job_ids()
                .expect("restart candidates"),
            vec!["job-ocr-recovery".to_string()]
        );
        let claimed = state
            .db
            .acquire_pipeline_attempt("job-ocr-recovery", "worker-after-service-restart", "ocr", 0)
            .expect("claim recovery");
        assert!(matches!(
            state
                .db
                .begin_pipeline_dispatch(&claimed, &intent)
                .expect("resume existing task"),
            crate::db::PipelineDispatchBegin::Resume { receipt, .. }
                if receipt["task_id"] == "provider-task-existing"
        ));
    }

    #[test]
    fn build_state_remote_mode_leaves_running_jobs_to_jobsd() {
        let fs = TestStateFs::new("remote-runtime-owner");
        let db = fs.db();
        db.init().expect("init db");
        db.save_job(&sample_running_job("job-owned-by-jobsd", None))
            .expect("save job");

        let mut config = fs.config().as_ref().clone();
        config.jobs_service.mode = crate::config::JobsRuntimeMode::Remote;
        let state = build_state(Arc::new(config)).expect("build remote shell state");
        let job = state.db.get_job("job-owned-by-jobsd").expect("get job");

        assert_eq!(job.status, JobStatusKind::Running);
        assert_eq!(job.stage.as_deref(), Some("translation_prepare"));
        assert!(job.failure.is_none());
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

    #[cfg(unix)]
    #[test]
    fn build_state_terminates_and_fails_running_jobs_with_live_pid() {
        use std::os::unix::process::CommandExt;
        use std::process::Command;

        let fs = TestStateFs::new("live-pid");
        let db = fs.db();
        db.init().expect("init db");

        // Spawn a real, detached process in its own process group (mirrors
        // `configure_child_process` for real worker processes) so that
        // reconciliation's group-kill can only ever reach this child, never
        // the test harness's own process group.
        let mut command = Command::new("sleep");
        command.arg("30");
        unsafe {
            command.pre_exec(|| {
                if libc::setpgid(0, 0) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
        let mut child = command.spawn().expect("spawn detached sleep process");
        let pid = child.id();

        db.save_job(&sample_running_job("job-live-pid", Some(pid)))
            .expect("save job");

        let state = build_state(fs.config()).expect("build state");
        let job = state.db.get_job("job-live-pid").expect("get job");

        assert_eq!(job.status, JobStatusKind::Failed);
        assert_eq!(job.pid, None);
        assert_eq!(
            job.failure
                .as_ref()
                .map(|failure| failure.category.as_str()),
            Some("worker_orphaned_after_restart")
        );
        assert!(job
            .error
            .as_deref()
            .is_some_and(|detail| detail.contains("仍在运行")));
        assert_eq!(
            state
                .db
                .count_jobs_with_status(&JobStatusKind::Running)
                .expect("count running"),
            0
        );

        // The orphaned process must actually have been terminated (not just
        // marked failed in the DB), and reaped so it doesn't linger.
        let exit_status = child.wait().expect("reap terminated child");
        assert!(!exit_status.success());
        assert!(!crate::process::worker_process_exists(pid));
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
                serde_json::to_string(&WorkflowKind::Book).expect("workflow json"),
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
