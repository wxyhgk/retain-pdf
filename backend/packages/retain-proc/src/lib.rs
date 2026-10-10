//! 通用 OS 进程工具（ADR-002 Phase 2）。
//!
//! 这些函数零任务语义——建进程组、探活、组杀进程树——却曾住在
//! `job_runner` 里，于是 `ai_supervisor`（监督的是 Python AI 服务，与任务
//! 毫无关系）为了杀一棵进程树不得不依赖整个任务执行栈。归属错位在此纠正：
//! 谁需要管子进程谁就依赖本 crate，不必牵扯 job_runner。
//!
//! 函数名保留 `worker_*` 前缀：调用方清一色是"监督某个 worker 子进程"的
//! 场景，改名只会制造无谓 churn。

use std::io;
#[cfg(windows)]
use std::process::Command as StdCommand;
use std::process::ExitStatus;
#[cfg(windows)]
use std::process::Stdio;
use std::time::Instant;

#[cfg(windows)]
use anyhow::anyhow;
#[cfg(windows)]
use anyhow::Context;
use anyhow::Result;
use tokio::process::{Child, Command};
use tokio::time::{sleep, timeout, Duration};

mod supervisor_watch;
pub use supervisor_watch::{
    mark_supervised_child, supervisor_pid_from_env, wait_for_supervisor_exit, SUPERVISOR_PID_ENV,
    SUPERVISOR_WATCH_INTERVAL,
};

#[cfg(unix)]
pub fn configure_child_process(command: &mut Command) {
    unsafe {
        command.pre_exec(|| {
            if libc::setpgid(0, 0) != 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        });
    }
}

#[cfg(windows)]
pub fn configure_child_process(_command: &mut Command) {}

/// Checks whether a process with the given pid is still alive.
///
/// Uses `kill(pid, 0)` (POSIX signal 0), which sends no signal but still
/// performs existence/permission checks: it returns success (or `EPERM`,
/// meaning the process exists but is owned by someone else) when the pid is
/// alive, and `ESRCH` when it is not. This works identically on Linux and
/// macOS, unlike checking for a `/proc/{pid}` entry (macOS has no `/proc`,
/// so that check always reported processes as dead).
#[cfg(unix)]
pub fn worker_process_exists(pid: u32) -> bool {
    let pid = pid as libc::pid_t;
    if unsafe { libc::kill(pid, 0) } == 0 {
        return true;
    }
    // EPERM means the process exists (owned by someone else); ESRCH means
    // no such process. Any other errno is treated conservatively as "does
    // not exist" so we don't get stuck if something else goes wrong.
    io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
}

#[cfg(not(unix))]
pub fn worker_process_exists(_pid: u32) -> bool {
    false
}

pub async fn terminate_job_process_tree(
    pid: u32,
    grace_secs: u64,
    poll_interval_ms: u64,
) -> Result<()> {
    #[cfg(windows)]
    {
        terminate_job_process_tree_windows(pid)
    }

    #[cfg(unix)]
    {
        let group_pid = -(pid as i32);
        let deadline = Instant::now() + Duration::from_secs(grace_secs);
        let poll_interval = Duration::from_millis(poll_interval_ms);
        let _ = unsafe { libc::kill(group_pid, libc::SIGTERM) };
        while Instant::now() < deadline {
            if !worker_process_exists(pid) {
                return Ok(());
            }
            sleep(poll_interval).await;
        }
        let _ = unsafe { libc::kill(group_pid, libc::SIGKILL) };
        Ok(())
    }
}

/// SIGKILL 之后最多再等这么久回收；内核态卡住（D 状态）的进程连 SIGKILL 都
/// 不会立刻生效，不能让调用方无限挂住。
const REAP_AFTER_KILL: Duration = Duration::from_secs(5);

/// 结束一个自己 spawn、手里握着 `Child` 的进程组：先 SIGTERM，宽限期内一退出
/// 就返回，否则 SIGKILL。返回回收到的退出状态；未能回收时为 None。
///
/// 握着 `Child` 时别用 [`terminate_job_process_tree`]：没人在 `wait()`，子进程
/// 退出后成了僵尸，而 `kill(pid, 0)` 对僵尸照样成功，于是它总要等满宽限期——
/// 监督器关停时 jobsd 明明立刻退出了，却每次都要白等 3 秒。这里改为等
/// `child.wait()`，顺带回收僵尸。要求子进程用 [`configure_child_process`] 自成
/// 进程组。
pub async fn terminate_child_process_tree(
    child: &mut Child,
    grace_secs: u64,
) -> Option<ExitStatus> {
    // 已经被回收过：wait() 直接返回缓存的状态。
    let Some(pid) = child.id() else {
        return child.wait().await.ok();
    };

    #[cfg(unix)]
    {
        let group_pid = -(pid as i32);
        let _ = unsafe { libc::kill(group_pid, libc::SIGTERM) };
        if let Ok(status) = timeout(Duration::from_secs(grace_secs), child.wait()).await {
            return status.ok();
        }
        let _ = unsafe { libc::kill(group_pid, libc::SIGKILL) };
    }

    #[cfg(windows)]
    {
        let _ = grace_secs;
        if terminate_job_process_tree_windows(pid).is_err() {
            let _ = child.start_kill();
        }
    }

    timeout(REAP_AFTER_KILL, child.wait())
        .await
        .ok()
        .and_then(|status| status.ok())
}

/// Synchronous counterpart to [`terminate_job_process_tree`] for callers
/// that run before/outside the async runtime (e.g. startup state
/// reconciliation). Sends SIGTERM to the process group, polls for exit with
/// a blocking sleep, and escalates to SIGKILL once the grace period elapses.
pub fn terminate_job_process_tree_blocking(
    pid: u32,
    grace_secs: u64,
    poll_interval_ms: u64,
) -> Result<()> {
    #[cfg(windows)]
    {
        terminate_job_process_tree_windows(pid)
    }

    #[cfg(unix)]
    {
        let group_pid = -(pid as i32);
        let deadline = Instant::now() + Duration::from_secs(grace_secs);
        let poll_interval = Duration::from_millis(poll_interval_ms);
        let _ = unsafe { libc::kill(group_pid, libc::SIGTERM) };
        while Instant::now() < deadline {
            if !worker_process_exists(pid) {
                return Ok(());
            }
            std::thread::sleep(poll_interval);
        }
        let _ = unsafe { libc::kill(group_pid, libc::SIGKILL) };
        Ok(())
    }
}

#[cfg(windows)]
fn terminate_job_process_tree_windows(pid: u32) -> Result<()> {
    let status = StdCommand::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .context("failed to invoke taskkill")?;
    if status.success() {
        return Ok(());
    }
    Err(anyhow!("taskkill failed for pid={pid}"))
}

#[cfg(all(test, unix))]
mod tests {
    use super::{configure_child_process, terminate_child_process_tree, worker_process_exists};
    use std::time::Instant;
    use tokio::process::{Child, Command};

    fn spawn_group_leader(program: &str, args: &[&str]) -> Child {
        let mut command = Command::new(program);
        command.args(args);
        configure_child_process(&mut command);
        command.spawn().expect("spawn test child")
    }

    #[tokio::test]
    async fn terminate_child_returns_as_soon_as_child_exits() {
        // 回归：按 pid 探活的版本把未回收的僵尸当成活着，总要等满宽限期。
        let mut child = spawn_group_leader("sleep", &["30"]);
        let pid = child.id().unwrap();
        let started = Instant::now();
        let status = terminate_child_process_tree(&mut child, 3).await;
        assert!(
            started.elapsed().as_secs_f64() < 1.0,
            "{:?}",
            started.elapsed()
        );
        assert!(status.is_some(), "child should be reaped");
        assert!(!worker_process_exists(pid), "no zombie left behind");
    }

    #[tokio::test]
    async fn terminate_child_escalates_to_sigkill_after_grace() {
        // SIG_IGN 会被 exec 继承，所以 sleep 也忽略 SIGTERM。
        let mut child = spawn_group_leader("sh", &["-c", "trap '' TERM; exec sleep 30"]);
        // 给 sh 一点时间装好 trap，否则 SIGTERM 可能在 trap 之前送达。
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let started = Instant::now();
        let status = terminate_child_process_tree(&mut child, 1).await;
        let elapsed = started.elapsed().as_secs_f64();
        assert!((1.0..3.0).contains(&elapsed), "{elapsed}");
        assert!(status.is_some(), "child should be reaped after SIGKILL");
    }

    #[tokio::test]
    async fn terminate_child_is_a_no_op_for_already_reaped_child() {
        let mut child = spawn_group_leader("true", &[]);
        child.wait().await.unwrap();
        let started = Instant::now();
        let status = terminate_child_process_tree(&mut child, 3).await;
        assert!(started.elapsed().as_secs_f64() < 0.5);
        assert!(status.is_some_and(|status| status.success()));
    }

    #[test]
    fn worker_process_exists_true_for_current_process() {
        // The current process is always alive, and this must work without
        // /proc (e.g. on macOS), so it's a direct regression test for the
        // `kill(pid, 0)`-based existence check.
        assert!(worker_process_exists(std::process::id()));
    }

    #[test]
    fn worker_process_exists_false_for_absurd_pid() {
        // 999_999 is well above the default max pid on both Linux and
        // macOS and matches the value used by the state_recovery
        // "dead pid" tests, so it's exceedingly unlikely to collide with a
        // real running process in CI.
        assert!(!worker_process_exists(999_999));
    }
}
