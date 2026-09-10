use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use retain_data::db::{Db, PipelineDispatchBegin, PipelineDispatchIntent, PipelineUnitCommit};
use retain_data::models::domain::{JobSnapshot, JobStatusKind};
use retain_data::models::request::CreateJobInput;

const CRASH_MODE_ENV: &str = "RETAIN_TEST_PIPELINE_CRASH_MODE";
const CRASH_ROOT_ENV: &str = "RETAIN_TEST_PIPELINE_CRASH_ROOT";
const READY_FILE: &str = "child-ready";
const JOB_ID: &str = "job-process-crash";

#[derive(Clone, Copy)]
enum CrashMode {
    DispatchBeforeReceipt,
    PageBeforeCheckpoint,
}

impl CrashMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::DispatchBeforeReceipt => "dispatch-before-receipt",
            Self::PageBeforeCheckpoint => "page-before-checkpoint",
        }
    }
}

fn fixture_root(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "retain-pipeline-process-crash-{label}-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ))
}

fn db(root: &Path) -> Db {
    Db::new(root.join("jobs.db"), root.to_path_buf())
}

fn seed_running_job(db: &Db) {
    let mut job = JobSnapshot::new(
        JOB_ID.to_string(),
        CreateJobInput::default(),
        vec!["process-crash-fixture".to_string()],
    );
    job.status = JobStatusKind::Running;
    db.save_job(&job).expect("seed running job");
}

fn dispatch_intent() -> PipelineDispatchIntent {
    PipelineDispatchIntent {
        dispatch_key: "ocr-submit".to_string(),
        provider: "mineru".to_string(),
        operation: "create_extract_task".to_string(),
        request_hash: "a".repeat(64),
    }
}

fn wait_for_child_ready(root: &Path, child: &mut Child) {
    let marker = root.join(READY_FILE);
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if marker.is_file() {
            return;
        }
        if let Some(status) = child.try_wait().expect("poll crash fixture child") {
            panic!("crash fixture child exited before ready marker: {status}");
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for crash fixture child"
        );
        thread::sleep(Duration::from_millis(20));
    }
}

fn spawn_crash_fixture(root: &Path, mode: CrashMode) -> Child {
    fs::create_dir_all(root).expect("create crash fixture root");
    let mut child = Command::new(std::env::current_exe().expect("current test executable"))
        .args([
            "--exact",
            "crash_writer_process_helper",
            "--ignored",
            "--nocapture",
        ])
        .env(CRASH_MODE_ENV, mode.as_str())
        .env(CRASH_ROOT_ENV, root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn crash fixture child");
    wait_for_child_ready(root, &mut child);
    child.kill().expect("kill crash fixture child");
    let status = child.wait().expect("reap crash fixture child");
    assert!(!status.success(), "killed child unexpectedly succeeded");
    child
}

#[test]
#[ignore = "test-only subprocess entrypoint; parent tests terminate it"]
fn crash_writer_process_helper() {
    let mode = std::env::var(CRASH_MODE_ENV).expect("crash mode");
    let root = PathBuf::from(std::env::var_os(CRASH_ROOT_ENV).expect("crash root"));
    let db = db(&root);
    db.init().expect("init child db");
    seed_running_job(&db);

    match mode.as_str() {
        "dispatch-before-receipt" => {
            let cursor = db
                .acquire_pipeline_attempt(JOB_ID, "worker-killed-after-send", "ocr", 0)
                .expect("acquire OCR attempt");
            assert!(matches!(
                db.begin_pipeline_dispatch(&cursor, &dispatch_intent())
                    .expect("persist dispatch intent"),
                PipelineDispatchBegin::Send { .. }
            ));
        }
        "page-before-checkpoint" => {
            let cursor = db
                .acquire_pipeline_attempt(JOB_ID, "worker-killed-before-checkpoint", "translate", 1)
                .expect("acquire translation attempt");
            db.commit_pipeline_unit(
                &cursor,
                &PipelineUnitCommit {
                    unit_key: "page-0001".to_string(),
                    unit_order: 1,
                    page_index: Some(0),
                    page_hash: "1".repeat(64),
                    producer_generation: Some(cursor.generation),
                    payload: serde_json::json!({"path": "pages/page-0001.json"}),
                },
            )
            .expect("commit first page");
            let pages = root.join("pages");
            fs::create_dir_all(&pages).expect("create pages directory");
            fs::write(pages.join("page-0002.json"), br#"{"page":2}"#)
                .expect("save second page before checkpoint");
        }
        other => panic!("unknown crash fixture mode: {other}"),
    }

    fs::write(root.join(READY_FILE), mode).expect("publish ready marker");
    loop {
        thread::sleep(Duration::from_secs(60));
    }
}

#[test]
fn killed_process_after_dispatch_intent_recovers_as_ambiguous_without_resubmit() {
    let root = fixture_root("dispatch");
    let _child = spawn_crash_fixture(&root, CrashMode::DispatchBeforeReceipt);

    let restarted = db(&root);
    restarted.init().expect("restart db");
    let cursor = restarted
        .acquire_pipeline_attempt(JOB_ID, "worker-after-process-restart", "ocr", 0)
        .expect("reacquire OCR attempt");
    let decision = restarted
        .begin_pipeline_dispatch(&cursor, &dispatch_intent())
        .expect("recover dispatch decision");
    assert!(matches!(decision, PipelineDispatchBegin::Ambiguous { .. }));
    let dispatch = restarted
        .latest_pipeline_dispatch(JOB_ID, "ocr-submit")
        .expect("load dispatch")
        .expect("dispatch record");
    assert_eq!(dispatch.status, "ambiguous");
    assert!(dispatch.receipt.is_none());

    fs::remove_dir_all(root).expect("remove dispatch fixture");
}

#[test]
fn killed_process_after_page_save_resumes_from_last_committed_checkpoint() {
    let root = fixture_root("checkpoint");
    let _child = spawn_crash_fixture(&root, CrashMode::PageBeforeCheckpoint);
    assert!(root.join("pages/page-0002.json").is_file());

    let restarted = db(&root);
    restarted.init().expect("restart db");
    let cursor = restarted
        .acquire_pipeline_attempt(JOB_ID, "worker-after-process-restart", "translate", 1)
        .expect("reacquire translation attempt");
    let checkpoint = restarted
        .pipeline_checkpoint(JOB_ID, cursor.attempt, "translate")
        .expect("load checkpoint")
        .expect("checkpoint");
    assert_eq!(
        checkpoint.last_committed_unit_key.as_deref(),
        Some("page-0001")
    );
    assert_eq!(checkpoint.last_committed_unit_order, Some(1));
    assert_eq!(
        checkpoint.last_page_hash.as_deref(),
        Some("1".repeat(64).as_str())
    );
    assert_eq!(
        restarted
            .list_pipeline_units(JOB_ID, cursor.attempt, "translate")
            .expect("list committed units")
            .len(),
        1
    );

    restarted
        .commit_pipeline_unit(
            &cursor,
            &PipelineUnitCommit {
                unit_key: "page-0002".to_string(),
                unit_order: 2,
                page_index: Some(1),
                page_hash: "2".repeat(64),
                producer_generation: Some(cursor.generation),
                payload: serde_json::json!({"path": "pages/page-0002.json"}),
            },
        )
        .expect("commit saved page after restart");
    let units = restarted
        .list_pipeline_units(JOB_ID, cursor.attempt, "translate")
        .expect("list resumed units");
    assert_eq!(units.len(), 2);
    assert_eq!(units[1].unit_key, "page-0002");

    fs::remove_dir_all(root).expect("remove checkpoint fixture");
}
