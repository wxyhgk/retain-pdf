#![cfg(unix)]

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use rust_api::db::{Db, PipelineUnitCommit};
use rust_api::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use rust_api::models::request::CreateJobInput;

const JOB_ID: &str = "job-api-process-recovery";

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
        "retain-api-process-recovery-{}-{}",
        std::process::id(),
        fastrand::u64(..)
    ))
}

fn available_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .expect("bind ephemeral port")
        .local_addr()
        .expect("ephemeral address")
        .port()
}

fn distinct_ports() -> (u16, u16) {
    let full = available_port();
    loop {
        let simple = available_port();
        if simple != full {
            return (full, simple);
        }
    }
}

fn jobs_db(root: &Path) -> Db {
    Db::new(root.join("data/db/jobs.db"), root.join("data"))
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
    input.workflow = WorkflowKind::Translate;
    input.runtime.job_id = JOB_ID.to_string();
    let mut job = JobSnapshot::new(
        JOB_ID.to_string(),
        input,
        vec!["worker-owned-by-crashed-api".to_string()],
    );
    job.status = JobStatusKind::Running;
    job.stage = Some("translating".to_string());
    job.pid = Some(worker_pid);
    db.save_job(&job).expect("save crashed runtime job");

    let cursor = db
        .acquire_pipeline_attempt(JOB_ID, "api-before-crash", "translate", 1)
        .expect("seed translation attempt");
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
    .expect("seed committed checkpoint");
}

fn spawn_api(root: &Path, port: u16, simple_port: u16) -> KillOnDrop {
    let rust_api_root = root.join("rust_api");
    let scripts_dir = root.join("scripts");
    fs::create_dir_all(&rust_api_root).expect("create rust api root");
    fs::create_dir_all(&scripts_dir).expect("create scripts root");
    let child = Command::new(env!("CARGO_BIN_EXE_rust_api"))
        .env("RUST_API_ROOT", &rust_api_root)
        .env("RUST_API_PROJECT_ROOT", root)
        .env("RUST_API_DATA_ROOT", root.join("data"))
        .env("RUST_API_SCRIPTS_DIR", &scripts_dir)
        .env("RUST_API_KEYS", "process-test-key")
        .env("RUST_API_BIND_HOST", "127.0.0.1")
        .env("RUST_API_PORT", port.to_string())
        .env("RUST_API_SIMPLE_PORT", simple_port.to_string())
        .env("RUST_API_JOBS_MODE", "in_process")
        .env("RUST_API_AI_SUPERVISE", "0")
        .env("RUST_API_JOBS_SUPERVISE", "0")
        .env("RUST_API_WORKER_TERMINATE_GRACE_SECS", "1")
        .env("RUST_API_WORKER_TERMINATE_POLL_MS", "10")
        .env("RUST_API_QUEUE_POLL_INTERVAL_MS", "10")
        .env("RUST_API_CLEANUP_INTERVAL_SECS", "3600")
        .env("RUST_LOG", "warn")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn rust_api");
    KillOnDrop(child)
}

fn health_is_ready(port: u16) -> bool {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else {
        return false;
    };
    stream
        .set_read_timeout(Some(Duration::from_millis(500)))
        .expect("set health read timeout");
    stream
        .write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .expect("write health request");
    let mut response = String::new();
    stream.read_to_string(&mut response).is_ok() && response.starts_with("HTTP/1.1 200")
}

fn wait_for_api(api: &mut KillOnDrop, port: u16) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if health_is_ready(port) {
            return;
        }
        if let Some(status) = api.child_mut().try_wait().expect("poll rust_api") {
            panic!("rust_api exited before health was ready: {status}");
        }
        assert!(Instant::now() < deadline, "rust_api startup timed out");
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
            "API did not terminate orphan worker"
        );
        thread::sleep(Duration::from_millis(20));
    }
}

#[test]
fn api_process_restart_kills_orphan_worker_and_preserves_committed_checkpoint() {
    let root = fixture_root();
    fs::create_dir_all(root.join("data/db")).expect("create data root");
    let db = jobs_db(&root);
    let mut worker = spawn_orphan_worker();
    let worker_pid = worker.child_mut().id();
    seed_crashed_runtime(&db, worker_pid);

    let (port, simple_port) = distinct_ports();
    let mut api = spawn_api(&root, port, simple_port);
    wait_for_api(&mut api, port);
    wait_for_worker_exit(&mut worker);

    let checkpoint = db
        .pipeline_checkpoint(JOB_ID, 1, "translate")
        .expect("load checkpoint after API restart")
        .expect("checkpoint after API restart");
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
        db.list_pipeline_units(JOB_ID, 1, "translate")
            .expect("list committed units")
            .len(),
        1,
        "startup recovery must not invent or replay an uncommitted unit"
    );

    api.terminate();
    worker.terminate();
    fs::remove_dir_all(root).expect("remove API fixture");
}
