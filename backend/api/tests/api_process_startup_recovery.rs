#![cfg(unix)]

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use retainpdf_api::db::{Db, PipelineUnitCommit};
use retainpdf_api::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use retainpdf_api::models::request::CreateJobInput;

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

/// 回归（状态审计 1-#6）：实例 A（进程内模式）正在管一个 running 任务；同一个 `data/` 上再起一个
/// 实例 B（换了端口，比如另一个 worktree 起的开发后端）。B 必须在启动对账之前就因为拿不到运行时锁
/// 退出——以前它先对账，把 A 的 worker 判成孤儿杀掉、任务改成 queued/failed，然后才在 bind 上失败
/// （换了端口的话连 bind 都不会失败）。
#[test]
fn second_in_process_api_on_the_same_data_exits_without_touching_live_workers() {
    let root = fixture_root();
    fs::create_dir_all(root.join("data/db")).expect("create data root");
    let db = jobs_db(&root);
    db.init().expect("init db");

    let (port_a, simple_a) = distinct_ports();
    let mut api_a = spawn_api(&root, port_a, simple_a);
    wait_for_api(&mut api_a, port_a);

    // A 已经起来之后才出现的 running 任务：它是 A 的（A 不会再对账它）。
    let mut worker = spawn_orphan_worker();
    let worker_pid = worker.child_mut().id();
    seed_crashed_runtime(&db, worker_pid);
    db.record_worker_identity(JOB_ID, retainpdf_proc::process_identity(worker_pid).as_deref())
        .expect("record worker identity");

    let (port_b, simple_b) = loop {
        let ports = distinct_ports();
        if ![port_a, simple_a].contains(&ports.0) && ![port_a, simple_a].contains(&ports.1) {
            break ports;
        }
    };
    let mut api_b = spawn_api(&root, port_b, simple_b);
    let deadline = Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = api_b.child_mut().try_wait().expect("poll second rust_api") {
            break status;
        }
        assert!(
            Instant::now() < deadline,
            "第二个实例拿不到运行时锁时应当直接退出"
        );
        thread::sleep(Duration::from_millis(20));
    };
    assert!(!status.success(), "第二个实例应当报错退出：{status}");

    thread::sleep(Duration::from_millis(300));
    assert!(
        worker
            .child_mut()
            .try_wait()
            .expect("poll worker")
            .is_none(),
        "第二个实例把第一个实例的 worker 杀掉了"
    );
    let job = db.get_job(JOB_ID).expect("load job");
    assert_eq!(job.status, JobStatusKind::Running, "第二个实例改了第一个实例的任务状态");
    assert_eq!(job.pid, Some(worker_pid));
    assert!(health_is_ready(port_a), "第一个实例应当不受影响");

    api_a.terminate();
    worker.terminate();
    fs::remove_dir_all(root).expect("remove API fixture");
}

/// 进程内模式的后端收到 SIGTERM（桌面版退出、`docker stop`、开发栈停掉）：退出时把还在跑的 worker 停掉，
/// 任务行留在 running，下次启动由启动对账续跑。以前 worker 在后台接着跑、接着花钱，直到下次启动才被杀。
///
/// 反证方式：把 `main.rs` 里的 `stop_owned_workers_after_shutdown(&config)` 去掉，这个测试必须变红。
#[test]
fn sigterm_stops_the_running_workers_and_leaves_their_rows_for_the_next_start() {
    let root = fixture_root();
    fs::create_dir_all(root.join("data/db")).expect("create data root");
    let db = jobs_db(&root);
    db.init().expect("init db");

    let (port, simple_port) = distinct_ports();
    let mut api = spawn_api(&root, port, simple_port);
    wait_for_api(&mut api, port);

    // API 起来以后才出现的 running 任务：算它的 worker（它不会再对账它）。
    let mut worker = spawn_orphan_worker();
    let worker_pid = worker.child_mut().id();
    seed_crashed_runtime(&db, worker_pid);
    db.record_worker_identity(JOB_ID, retainpdf_proc::process_identity(worker_pid).as_deref())
        .expect("record worker identity");

    let api_pid = api.child_mut().id();
    let sent = Command::new("kill")
        .args(["-TERM", &api_pid.to_string()])
        .status()
        .expect("send SIGTERM");
    assert!(sent.success());
    let deadline = Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = api.child_mut().try_wait().expect("poll rust_api") {
            break status;
        }
        assert!(Instant::now() < deadline, "rust_api 收到 SIGTERM 以后没有退出");
        thread::sleep(Duration::from_millis(20));
    };
    assert!(status.success(), "rust_api 应当正常退出：{status}");
    wait_for_worker_exit(&mut worker);

    let job = db.get_job(JOB_ID).expect("load job");
    assert_eq!(job.status, JobStatusKind::Running, "退出时不改任务行，留给下次启动");
    assert_eq!(job.pid, Some(worker_pid));

    worker.terminate();
    fs::remove_dir_all(root).expect("remove API fixture");
}
