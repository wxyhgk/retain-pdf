//! retain-jobsd 退出时停掉自己的 worker（状态管理设计 S04、路线图第 0 步 Z1）。
//!
//! 打包桌面版（mac、Linux）走 jobsd：退出 app 时 rust_api 给 jobsd 发 SIGTERM；rust_api 被强杀时 jobsd 自己发现
//! 监督者没了。以前这两条路 jobsd 都是直接死（SIGTERM 默认动作 / `exit(0)`），worker 成了孤儿接着花模型的钱。
//! 现在两条路都先停运行时、再停 worker，任务行不改，留给下次启动的对账。
#![cfg(unix)]

use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind};
use retainpdf_core::models::request::CreateJobInput;
use retainpdf_data::db::Db;

const API_KEY: &str = "jobsd-shutdown-test-key";

struct KillOnDrop(Child);

impl KillOnDrop {
    fn child_mut(&mut self) -> &mut Child {
        &mut self.0
    }
}

impl Drop for KillOnDrop {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn fixture_root(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "retain-jobsd-shutdown-{name}-{}-{}",
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

fn spawn_group_leader_sleep() -> KillOnDrop {
    let mut command = Command::new("sleep");
    command
        .arg("60")
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    KillOnDrop(command.spawn().expect("spawn sleep"))
}

fn spawn_jobsd(root: &Path, port: u16, supervisor_pid: Option<u32>) -> KillOnDrop {
    let rust_api_root = root.join("rust_api");
    let scripts_dir = root.join("scripts");
    fs::create_dir_all(&rust_api_root).expect("create rust api root");
    fs::create_dir_all(&scripts_dir).expect("create scripts root");
    let mut command = Command::new(env!("CARGO_BIN_EXE_retain-jobsd"));
    command
        .env("RUST_API_ROOT", &rust_api_root)
        .env("RUST_API_PROJECT_ROOT", root)
        .env("RUST_API_DATA_ROOT", root.join("data"))
        .env("RUST_API_SCRIPTS_DIR", &scripts_dir)
        .env("RUST_API_KEYS", API_KEY)
        .env("RUST_API_JOBS_HOST", "127.0.0.1")
        .env("RUST_API_JOBS_PORT", port.to_string())
        .env("RUST_API_WORKER_TERMINATE_GRACE_SECS", "1")
        .env("RUST_API_WORKER_TERMINATE_POLL_MS", "10")
        .env("RUST_LOG", "warn")
        .env_remove(retainpdf_proc::SUPERVISOR_PID_ENV)
        .process_group(0)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(pid) = supervisor_pid {
        command.env(retainpdf_proc::SUPERVISOR_PID_ENV, pid.to_string());
    }
    KillOnDrop(command.spawn().expect("spawn retain-jobsd"))
}

/// 等 jobsd 真正开始服务：`/healthz` 回 200。只连上端口不够——jobsd 先占端口、再做启动对账、最后才开始服务，
/// 对账之前插进去的 running 行会被当成上次遗留的任务落成 failed（2026-11-27 本地全套检查里两个用例轮流偶发红）。
fn wait_for_jobsd(jobsd: &mut KillOnDrop, port: u16) {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if healthz_ok(port) {
            return;
        }
        if let Some(status) = jobsd.child_mut().try_wait().expect("poll retain-jobsd") {
            panic!("retain-jobsd exited before listening: {status}");
        }
        assert!(Instant::now() < deadline, "retain-jobsd startup timed out");
        thread::sleep(Duration::from_millis(20));
    }
}

fn healthz_ok(port: u16) -> bool {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else { return false };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    if stream.write_all(b"GET /healthz HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n").is_err() {
        return false;
    }
    let mut head = [0u8; 12];
    stream.read_exact(&mut head).is_ok() && head.starts_with(b"HTTP/1.") && &head[9..12] == b"200"
}

fn wait_for_exit(process: &mut KillOnDrop, what: &str) -> ExitStatus {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(status) = process.child_mut().try_wait().expect("poll process") {
            return status;
        }
        assert!(Instant::now() < deadline, "{what} 没有在期限内退出");
        thread::sleep(Duration::from_millis(20));
    }
}

/// jobsd 起来以后才出现的 running 任务：算 jobsd 的 worker（启动对账不会再碰它）。
fn seed_running_worker(db: &Db, job_id: &str, worker: &KillOnDrop) {
    let pid = worker.0.id();
    let mut job = JobSnapshot::new(job_id.to_string(), CreateJobInput::default(), vec![]);
    job.status = JobStatusKind::Running;
    job.stage = Some("translating".to_string());
    job.pid = Some(pid);
    db.save_job(&job).expect("save running job");
    db.record_worker_identity(job_id, retainpdf_proc::process_identity(pid).as_deref())
        .expect("record identity");
}

fn assert_row_left_for_next_start(db: &Db, job_id: &str, worker_pid: u32) {
    let job = db.get_job(job_id).expect("load job");
    assert_eq!(
        job.status,
        JobStatusKind::Running,
        "退出时不改任务行，留给下次启动的对账"
    );
    assert_eq!(job.pid, Some(worker_pid));
}

/// 桌面壳退出：rust_api 给 jobsd 发 SIGTERM。jobsd 要停掉 worker 再正常退出。
///
/// 反证方式：把 `main.rs` 里的 `stop_owned_workers_after_runtime_shutdown` 去掉（或删掉 SIGTERM 处理），这个测试必须变红。
#[test]
fn sigterm_stops_jobsd_workers_and_leaves_their_rows_for_the_next_start() {
    let root = fixture_root("sigterm");
    fs::create_dir_all(root.join("data/db")).expect("create data root");
    let db = jobs_db(&root);
    db.init().expect("init db");
    let port = available_port();
    let mut jobsd = spawn_jobsd(&root, port, None);
    wait_for_jobsd(&mut jobsd, port);

    let mut worker = spawn_group_leader_sleep();
    let worker_pid = worker.0.id();
    seed_running_worker(&db, "job-sigterm", &worker);

    let sent = Command::new("kill")
        .args(["-TERM", &jobsd.0.id().to_string()])
        .status()
        .expect("send SIGTERM");
    assert!(sent.success());
    let status = wait_for_exit(&mut jobsd, "retain-jobsd 收到 SIGTERM 以后");
    assert!(status.success(), "retain-jobsd 应当正常退出：{status}");
    let worker_status = wait_for_exit(&mut worker, "jobsd 的 worker");
    assert!(
        !worker_status.success(),
        "worker 应当是被信号停掉的：{worker_status}"
    );
    assert_row_left_for_next_start(&db, "job-sigterm", worker_pid);

    let _ = fs::remove_dir_all(root);
}

/// rust_api 被强杀（SIGKILL、崩溃）：没人发 SIGTERM，jobsd 靠看着监督者发现它没了。以前这里直接 `exit(0)`。
#[test]
fn supervisor_exit_stops_jobsd_workers_before_jobsd_exits() {
    let root = fixture_root("supervisor");
    fs::create_dir_all(root.join("data/db")).expect("create data root");
    let db = jobs_db(&root);
    db.init().expect("init db");
    let mut supervisor = spawn_group_leader_sleep();
    let port = available_port();
    let mut jobsd = spawn_jobsd(&root, port, Some(supervisor.0.id()));
    wait_for_jobsd(&mut jobsd, port);

    let mut worker = spawn_group_leader_sleep();
    let worker_pid = worker.0.id();
    seed_running_worker(&db, "job-supervisor-gone", &worker);

    // 杀掉并回收「监督者」：没回收的僵尸对 kill(pid, 0) 还算活着。
    let _ = supervisor.0.kill();
    let _ = supervisor.0.wait();
    let status = wait_for_exit(&mut jobsd, "监督者没了以后 retain-jobsd");
    assert!(status.success(), "retain-jobsd 应当正常退出：{status}");
    let worker_status = wait_for_exit(&mut worker, "jobsd 的 worker");
    assert!(
        !worker_status.success(),
        "worker 应当是被信号停掉的：{worker_status}"
    );
    assert_row_left_for_next_start(&db, "job-supervisor-gone", worker_pid);

    let _ = fs::remove_dir_all(root);
}
