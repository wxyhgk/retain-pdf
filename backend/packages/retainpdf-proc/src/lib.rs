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

mod identity;
mod supervisor_watch;
pub use identity::{identity_matches, process_identity, process_start, ProcessStart};
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

/// Windows 没有进程组：子进程跟着本进程走靠 [`kill_descendants_on_exit`]（启动时调一次），杀进程树靠 `taskkill /T`。
#[cfg(windows)]
pub fn configure_child_process(_command: &mut Command) {}

/// 本进程退出（正常退出、崩溃、被强杀都算）时，系统把它起的所有子进程、孙进程一起杀掉。进程启动时调一次。
///
/// Windows：建一个设了 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 的 Job Object，把本进程放进去。之后起的进程默认都在里面
/// （不带 `CREATE_BREAKAWAY_FROM_JOB` 的话），孙进程也是；句柄故意不关，进程没了系统替它关，job 里剩下的进程随之被杀。
/// 以前 Windows 上只有 `taskkill /T`：API 被强杀时没人去调它，管线、渲染这些孙进程会留下来。本进程已经在别的 job 里
/// （比如桌面壳把它放进了自己的 job）也行：Windows 8 起 job 可以嵌套。
///
/// Unix 上什么都不做：子进程自成进程组，由 [`terminate_child_process_tree`] 组杀，被监督的子进程自己看着监督者
/// （[`wait_for_supervisor_exit`]），监督者没了就退出。
///
/// 后端起的都是自己的 worker（管线、渲染、AI 服务、jobsd、命令行小工具），没有替用户打开的应用，所以全部跟着走是对的。
pub fn kill_descendants_on_exit() -> io::Result<()> {
    #[cfg(windows)]
    {
        windows_job::kill_descendants_on_exit()
    }
    #[cfg(not(windows))]
    {
        Ok(())
    }
}

#[cfg(windows)]
mod windows_job {
    use std::io;
    use std::sync::OnceLock;

    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows_sys::Win32::System::Threading::GetCurrentProcess;

    /// 只建一次：再调返回第一次的结果，不会套出第二层 job。
    static RESULT: OnceLock<Result<(), (io::ErrorKind, String)>> = OnceLock::new();

    pub(super) fn kill_descendants_on_exit() -> io::Result<()> {
        RESULT
            .get_or_init(|| create_and_join().map_err(|error| (error.kind(), error.to_string())))
            .clone()
            .map_err(|(kind, message)| io::Error::new(kind, message))
    }

    fn create_and_join() -> io::Result<()> {
        // SAFETY：都是按文档传参的 Win32 调用；`info` 是零初始化的普通结构体，长度如实传；
        // 失败时关掉刚建的句柄，成功时故意留着（见上层说明）。
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err(io::Error::last_os_error());
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let set = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION as *const core::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if set == 0 {
                let error = io::Error::last_os_error();
                CloseHandle(job);
                return Err(error);
            }
            if AssignProcessToJobObject(job, GetCurrentProcess()) == 0 {
                let error = io::Error::last_os_error();
                CloseHandle(job);
                return Err(error);
            }
        }
        Ok(())
    }
}

#[cfg(all(test, windows))]
mod windows_job_tests {
    use std::os::windows::io::AsRawHandle;

    use windows_sys::Win32::System::JobObjects::IsProcessInJob;

    #[test]
    fn children_started_afterwards_are_in_the_job_and_calling_twice_is_fine() {
        super::kill_descendants_on_exit().unwrap();
        super::kill_descendants_on_exit().unwrap();
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "ping -n 3 127.0.0.1 > NUL"])
            .spawn()
            .unwrap();
        let mut in_job = 0;
        // SAFETY：句柄来自还没回收的 `Child`；第二个参数为空表示"任何 job"。
        let ok = unsafe { IsProcessInJob(child.as_raw_handle(), std::ptr::null_mut(), &mut in_job) };
        let _ = child.kill();
        let _ = child.wait();
        assert_ne!(ok, 0);
        assert_ne!(in_job, 0, "a child started after the call belongs to the job");
    }
}

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

/// Windows：`OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION)` 打开，`GetExitCodeProcess` 还是 `STILL_ACTIVE` 就算活着。
///
/// 以前这里恒为 false（S03）：取消时认不出自己的 worker、jobsd 的 terminate 接口回 404、启动对账和退出清理
/// 把在跑的任务都当成已死，库里写成 Canceled 了 worker 还在调模型花钱。
///
/// - 打不开且是 `ERROR_ACCESS_DENIED`：进程在，只是不让查（和 unix 的 `EPERM` 一样算活着）；别的错误
///   （没有这个 pid 是 `ERROR_INVALID_PARAMETER`）算不在。
/// - 进程退出后只要还有人握着句柄（比如还没 `wait()` 的 `Child`），pid 仍然能打开，但退出码已经不是
///   `STILL_ACTIVE`，照样判不在；也就没有 unix 那种「僵尸当活着」的问题。
/// - 进程恰好以退出码 259（`STILL_ACTIVE`）退出会被误判成活着，Windows 上这是公认的边角，我们的 worker 不这么退出。
#[cfg(windows)]
pub fn worker_process_exists(pid: u32) -> bool {
    windows_process::exists(pid)
}

#[cfg(not(any(unix, windows)))]
pub fn worker_process_exists(_pid: u32) -> bool {
    false
}

/// Windows 上按 pid 打开进程查状态、读启动时间（[`worker_process_exists`]、[`identity::process_start`]）。
#[cfg(windows)]
pub(crate) mod windows_process {
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, ERROR_ACCESS_DENIED, FILETIME, HANDLE, STILL_ACTIVE,
    };
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    /// 打开的进程句柄，离开作用域就关。
    struct ProcessHandle(HANDLE);

    impl Drop for ProcessHandle {
        fn drop(&mut self) {
            // SAFETY：句柄由 `OpenProcess` 成功返回，只在这里关一次。
            unsafe {
                CloseHandle(self.0);
            }
        }
    }

    /// 打开失败时带上 `GetLastError`，调用方据此区分「不在」和「不让查」。
    fn open(pid: u32) -> Result<ProcessHandle, u32> {
        // SAFETY：按文档传参；返回空句柄表示失败，紧接着读 GetLastError。
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
        if handle.is_null() {
            return Err(unsafe { GetLastError() });
        }
        Ok(ProcessHandle(handle))
    }

    pub(crate) fn exists(pid: u32) -> bool {
        if pid == 0 {
            // pid 0 是系统空闲进程，不会是我们的 worker。
            return false;
        }
        let handle = match open(pid) {
            Ok(handle) => handle,
            Err(error) => return error == ERROR_ACCESS_DENIED,
        };
        let mut code = 0u32;
        // SAFETY：句柄有效，`code` 是可写的 u32。
        if unsafe { GetExitCodeProcess(handle.0, &mut code) } == 0 {
            // 打开了却读不到退出码：保守当活着，别把在跑的 worker 当成已死。
            return true;
        }
        code == STILL_ACTIVE as u32
    }

    /// 进程创建时刻，FILETIME（1601-01-01 起的 100 纳秒数）。进程不在、不让查时 None。
    pub(crate) fn creation_time(pid: u32) -> Option<u64> {
        if pid == 0 {
            return None;
        }
        let handle = open(pid).ok()?;
        let mut creation = FILETIME::default();
        let mut exit = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        // SAFETY：句柄有效，四个出参都是可写的 FILETIME。
        let ok =
            unsafe { GetProcessTimes(handle.0, &mut creation, &mut exit, &mut kernel, &mut user) };
        if ok == 0 {
            return None;
        }
        let ticks = (u64::from(creation.dwHighDateTime) << 32) | u64::from(creation.dwLowDateTime);
        (ticks != 0).then_some(ticks)
    }
}

pub async fn terminate_job_process_tree(
    pid: u32,
    grace_secs: u64,
    poll_interval_ms: u64,
) -> Result<()> {
    refuse_non_worker_pid(pid)?;
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

/// 组杀的 pid 必须是一个真进程组组长：`kill(-0)` 是调用者自己的进程组，`kill(-1)` 是当前用户能发
/// 信号的所有进程；超出 `i32` 的值取负数会溢出成别的号。这些一律拒绝，不发任何信号。
fn refuse_non_worker_pid(pid: u32) -> Result<()> {
    if pid <= 1 || i32::try_from(pid).is_err() {
        anyhow::bail!("refusing to signal process group of pid={pid}");
    }
    Ok(())
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

/// 马上杀掉一个自己 spawn、手里握着同步 `std::process::Child` 的进程树，不给宽限（超时了的生成进程用）。
/// unix 上按进程组发 SIGKILL，要求 spawn 时自成一组（`process_group(0)` 或 [`configure_child_process`]）；
/// Windows 上 `taskkill /T /F` 连孙进程一起杀。都不成再退回只杀直接子进程。返回杀没杀成，
/// 杀成了调用方才能放心 `wait()`。
pub fn kill_std_child_process_tree(child: &mut std::process::Child) -> bool {
    #[cfg(unix)]
    {
        if let Ok(pid) = i32::try_from(child.id()) {
            if pid > 1 && unsafe { libc::kill(-pid, libc::SIGKILL) } == 0 {
                return true;
            }
        }
    }
    #[cfg(windows)]
    {
        if terminate_job_process_tree_windows(child.id()).is_ok() {
            return true;
        }
    }
    child.kill().is_ok()
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
    refuse_non_worker_pid(pid)?;
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

#[cfg(all(test, windows))]
mod windows_process_tests {
    use super::worker_process_exists;

    #[test]
    fn current_process_exists() {
        assert!(worker_process_exists(std::process::id()));
    }

    #[test]
    fn absurd_pid_does_not_exist() {
        // Windows 的 pid 是 4 的倍数，奇数号不会有进程。
        assert!(!worker_process_exists(999_999));
        assert!(!worker_process_exists(0));
    }

    #[test]
    fn exited_child_does_not_exist_even_while_its_handle_is_held() {
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "exit 0"])
            .spawn()
            .unwrap();
        let pid = child.id();
        child.wait().unwrap();
        // `child` 还握着句柄，pid 没被回收，但进程已经退出。
        assert!(!worker_process_exists(pid));
        drop(child);
    }

    #[test]
    fn running_child_exists_until_killed() {
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "ping -n 30 127.0.0.1 > NUL"])
            .spawn()
            .unwrap();
        let pid = child.id();
        assert!(worker_process_exists(pid));
        assert!(super::kill_std_child_process_tree(&mut child));
        child.wait().unwrap();
        assert!(!worker_process_exists(pid));
    }
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
    fn group_kill_guard_refuses_pid_zero_one_and_overflow() {
        // 只测守卫本身，不经过真的组杀：守卫一旦被改坏，经过组杀的用例会 kill(0)/kill(-1)，
        // 杀掉跑测试的进程组乃至当前用户的所有进程。
        for pid in [0, 1, u32::MAX, i32::MAX as u32 + 1] {
            assert!(super::refuse_non_worker_pid(pid).is_err(), "{pid}");
        }
        assert!(super::refuse_non_worker_pid(2).is_ok());
        assert!(super::refuse_non_worker_pid(i32::MAX as u32).is_ok());
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
