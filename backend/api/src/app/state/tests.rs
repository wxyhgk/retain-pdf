use std::fs;
use std::sync::Arc;

use rusqlite::{params, Connection};

use super::*;
use crate::models::domain::{now_iso, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::models::request::CreateJobInput;
use crate::test_support::config::TestDirs;

/// 共享目录树外再包一层：build_state 的测试要在结束时清掉临时目录。
struct TestStateFs(TestDirs);

impl TestStateFs {
    fn new(test_name: &str) -> Self {
        Self(TestDirs::create(&format!(
            "rust-api-build-state-{test_name}-{}-{}",
            std::process::id(),
            now_iso().replace([':', '.'], "-")
        )))
    }

    fn config(&self) -> Arc<AppConfig> {
        // 这组用例一直按 4 个并发槽写，和共享默认（1）不同，显式保留
        Arc::new(AppConfig {
            max_running_jobs: 4,
            ..self.0.config()
        })
    }

    fn db(&self) -> Db {
        Db::new(self.0.jobs_db_path.clone(), self.0.data_root.clone())
    }
}

impl std::ops::Deref for TestStateFs {
    type Target = TestDirs;

    fn deref(&self) -> &TestDirs {
        &self.0
    }
}

impl Drop for TestStateFs {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0.root);
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
    use crate::services::ingest::{UploadedPdfInput, UploadError};

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
    // 单独的 OCR 任务自己调服务商，种子在它自己名下（book 的恢复任务见 retainpdf-db 的
    // book_ocr_recovery_seeds_the_receipt_under_the_ocr_child）。
    let recovery = JobSnapshot::new(
        "job-ocr-recovery".to_string(),
        CreateJobInput {
            workflow: crate::models::domain::WorkflowKind::Ocr,
            ..CreateJobInput::default()
        },
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
    // 和真实 spawn 一样记下进程身份：任务行的 updated_at 是写死的过去时刻，没有身份信息的话
    // 会按「进程比任务行最后一次写入晚得多」判成 pid 被复用、不杀（retainpdf-runner 的 worker_identity）。
    db.record_worker_identity("job-live-pid", crate::process::process_identity(pid).as_deref())
        .expect("record worker identity");

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
                job_id, workflow, status, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
        params![
            "job-malformed-running",
            WorkflowKind::Book.as_str(),
            JobStatusKind::Running.as_str(),
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
            "SELECT status, pid, stage, error, failure_json FROM jobs WHERE job_id = ?1",
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
        JobStatusKind::Failed.as_str()
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

/// 旧的 workflow 名 "mineru" 改成 "book"：v29 迁移里升级时跑一次（以前是每次启动都对事件表 LIKE 全表扫描）。
#[test]
fn upgrading_to_v29_rewrites_legacy_workflow_rows_once() {
    let fs = TestStateFs::new("cleanup-legacy-workflow");
    let db = fs.db();
    db.init().expect("init db");

    let conn = Connection::open(&fs.jobs_db_path).expect("open sqlite");
    conn.execute(
        r#"
            INSERT INTO jobs (
                job_id, workflow, status, created_at, updated_at, started_at, finished_at,
                upload_id, pid, command_json, request_json, error, stage, stage_detail,
                progress_current, progress_total, log_tail_json, result_json, runtime_json, failure_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
        params![
            "job-legacy-workflow",
            "\"mineru\"",
            JobStatusKind::Succeeded.as_str(),
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
    // 装成 v28 的库：升级到 v29 时跑那段修正。
    conn.execute_batch("PRAGMA user_version = 28;")
        .expect("pretend the database is at v28");

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

    // 已经是 v29 的库，再启动不再扫：之后写进来的旧名原样留着。
    conn.execute(
        "UPDATE events SET payload_json = ?1 WHERE job_id = ?2 AND seq = 1",
        params!["{\"workflow\":\"mineru\"}", "job-legacy-workflow"],
    )
    .expect("write a legacy payload after the upgrade");
    drop(_state);
    let _again = build_state(fs.config()).expect("build state again");
    let payload_json: String = conn
        .query_row(
            "SELECT payload_json FROM events WHERE job_id = ?1 AND seq = 1",
            params!["job-legacy-workflow"],
            |row| row.get(0),
        )
        .expect("payload json");
    assert!(payload_json.contains("\"workflow\":\"mineru\""), "startup must not rescan events: {payload_json}");
}
