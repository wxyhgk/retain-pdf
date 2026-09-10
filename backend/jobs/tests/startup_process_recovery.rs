#![cfg(unix)]

use std::fs;
use std::net::{TcpListener, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use retain_core::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use retain_core::models::request::CreateJobInput;
use retain_data::db::{Db, PipelineDispatchBegin, PipelineDispatchIntent};
use serde_json::json;
use sha2::{Digest, Sha256};

const JOB_ID: &str = "job-jobsd-process-recovery";

struct KillOnDrop(Child);

impl KillOnDrop {
    fn child_mut(&mut self) -> &mut Child {
        &mut self.0
    }

    fn terminate(mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

impl Drop for KillOnDrop {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn fixture_root() -> PathBuf {
    std::env::temp_dir().join(format!(
        "retain-jobsd-process-recovery-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time")
            .as_nanos()
    ))
}

fn available_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .expect("bind ephemeral port")
        .local_addr()
        .expect("ephemeral address")
        .port()
}

fn jobs_db(root: &Path) -> Db {
    Db::new(root.join("data/db/jobs.db"), root.join("data"))
}

fn remote_mineru_intent(job: &JobSnapshot) -> PipelineDispatchIntent {
    let request = &job.request_payload;
    let identity = json!({
        "source_kind": "remote_url",
        "source_url": request.source.source_url,
        "model_version": request.ocr.model_version,
        "is_ocr": request.ocr.is_ocr,
        "enable_formula": !request.ocr.disable_formula,
        "enable_table": !request.ocr.disable_table,
        "language": request.ocr.language,
        "page_ranges": request.ocr.page_ranges,
        "data_id": request.ocr.data_id,
        "no_cache": request.ocr.no_cache,
        "cache_tolerance": request.ocr.cache_tolerance,
        "extra_formats": Vec::<String>::new(),
    });
    let request_hash = Sha256::digest(serde_json::to_vec(&identity).expect("serialize identity"))
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    PipelineDispatchIntent {
        dispatch_key: "ocr-submit".to_string(),
        provider: "mineru".to_string(),
        operation: "create_extract_task".to_string(),
        request_hash,
    }
}

fn spawn_orphan_worker() -> KillOnDrop {
    let mut command = Command::new("sleep");
    command
        .arg("60")
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    KillOnDrop(command.spawn().expect("spawn orphan worker"))
}

fn seed_crashed_runtime(db: &Db, worker_pid: u32) {
    db.init().expect("init db");
    let mut input = CreateJobInput::default();
    input.workflow = WorkflowKind::Ocr;
    input.runtime.job_id = JOB_ID.to_string();
    input.source.source_url = "https://example.invalid/source.pdf".to_string();
    input.ocr.provider = "mineru".to_string();
    input.ocr.mineru_token = "process-test-token".to_string();
    let mut job = JobSnapshot::new(
        JOB_ID.to_string(),
        input,
        vec!["worker-owned-by-crashed-jobsd".to_string()],
    );
    job.status = JobStatusKind::Running;
    job.stage = Some("ocr_upload".to_string());
    job.pid = Some(worker_pid);
    db.save_job(&job).expect("save crashed runtime job");

    let cursor = db
        .acquire_pipeline_attempt(JOB_ID, "jobsd-before-crash", "ocr", 0)
        .expect("seed OCR attempt");
    assert!(matches!(
        db.begin_pipeline_dispatch(&cursor, &remote_mineru_intent(&job))
            .expect("seed request intent"),
        PipelineDispatchBegin::Send { .. }
    ));
}

fn spawn_jobsd(root: &Path, port: u16) -> KillOnDrop {
    let rust_api_root = root.join("rust_api");
    let scripts_dir = root.join("scripts");
    fs::create_dir_all(&rust_api_root).expect("create rust api root");
    fs::create_dir_all(&scripts_dir).expect("create scripts root");
    let binary = env!("CARGO_BIN_EXE_retain-jobsd");
    let child = Command::new(binary)
        .env("RUST_API_ROOT", &rust_api_root)
        .env("RUST_API_PROJECT_ROOT", root)
        .env("RUST_API_DATA_ROOT", root.join("data"))
        .env("RUST_API_SCRIPTS_DIR", &scripts_dir)
        .env("RUST_API_KEYS", "process-test-key")
        .env("RUST_API_JOBS_HOST", "127.0.0.1")
        .env("RUST_API_JOBS_PORT", port.to_string())
        .env("RUST_API_WORKER_TERMINATE_GRACE_SECS", "1")
        .env("RUST_API_WORKER_TERMINATE_POLL_MS", "10")
        .env("RUST_API_QUEUE_POLL_INTERVAL_MS", "10")
        .env("RUST_LOG", "warn")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn retain-jobsd");
    KillOnDrop(child)
}

fn wait_for_jobsd(jobsd: &mut KillOnDrop, port: u16) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return;
        }
        if let Some(status) = jobsd.child_mut().try_wait().expect("poll retain-jobsd") {
            panic!("retain-jobsd exited before listening: {status}");
        }
        assert!(Instant::now() < deadline, "retain-jobsd startup timed out");
        thread::sleep(Duration::from_millis(20));
    }
}

fn wait_for_worker_exit(worker: &mut KillOnDrop) {
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if worker
            .child_mut()
            .try_wait()
            .expect("poll orphan worker")
            .is_some()
        {
            return;
        }
        assert!(
            Instant::now() < deadline,
            "jobsd did not terminate orphan worker"
        );
        thread::sleep(Duration::from_millis(20));
    }
}

fn wait_for_ambiguous_failure(db: &Db) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let dispatch = db
            .latest_pipeline_dispatch(JOB_ID, "ocr-submit")
            .expect("load dispatch")
            .expect("dispatch");
        let job = db.get_job(JOB_ID).expect("load recovered job");
        if dispatch.status == "ambiguous" && job.status == JobStatusKind::Failed {
            assert!(dispatch.receipt.is_none());
            assert!(job
                .failure
                .as_ref()
                .is_some_and(|failure| !failure.retryable));
            return;
        }
        assert!(
            Instant::now() < deadline,
            "jobsd did not converge to ambiguous failure: dispatch={} job={:?}",
            dispatch.status,
            job.status
        );
        thread::sleep(Duration::from_millis(20));
    }
}

#[test]
fn jobsd_restart_kills_orphan_worker_and_never_resubmits_bare_ocr_intent() {
    let root = fixture_root();
    fs::create_dir_all(root.join("data/db")).expect("create data root");
    let db = jobs_db(&root);
    let mut worker = spawn_orphan_worker();
    let worker_pid = worker.child_mut().id();
    seed_crashed_runtime(&db, worker_pid);

    let port = available_port();
    let mut jobsd = spawn_jobsd(&root, port);
    wait_for_jobsd(&mut jobsd, port);
    wait_for_worker_exit(&mut worker);
    wait_for_ambiguous_failure(&db);

    let events = db
        .list_job_events(JOB_ID, 100, 0)
        .expect("list recovery events");
    assert!(events
        .iter()
        .any(|event| event.event == "pipeline_dispatch_ambiguous"));
    assert_eq!(
        events
            .iter()
            .filter(|event| event.event == "pipeline_dispatch_intent")
            .count(),
        1,
        "restart must not create a second provider request intent"
    );

    jobsd.terminate();
    worker.terminate();
    fs::remove_dir_all(root).expect("remove jobsd fixture");
}
