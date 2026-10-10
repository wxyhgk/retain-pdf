//! 被监督的子进程随监督者一起退出。
//!
//! rust_api 把 jobsd / AI 服务各自放进独立进程组（见 `configure_child_process`），
//! 好让组杀能收走整棵树；代价是 rust_api 自己被 SIGKILL（桌面端退出、OOM、
//! `kill -9`）时，信号到不了这些进程组，它们成了孤儿，继续占着端口——下次
//! 启动就是端口冲突。Linux 有 `PR_SET_PDEATHSIG`，macOS 没有，所以统一用轮询：
//! 监督者在环境变量里写下自己的 pid，子进程定期确认它还在，不在就退出。
//!
//! Python 侧（`retainpdf_ai/supervisor_watch.py`）实现同一约定，两边改动需同步。

use tokio::process::Command;
use tokio::time::{sleep, Duration};

/// 监督者写入的环境变量：值为监督者自己的 pid。
pub const SUPERVISOR_PID_ENV: &str = "RETAIN_SUPERVISOR_PID";

/// 默认探测间隔：一次 `getppid` + 一次 `kill(pid, 0)`，开销可以忽略。
pub const SUPERVISOR_WATCH_INTERVAL: Duration = Duration::from_secs(1);

/// 监督者在 spawn 前调用：让子进程知道该跟着谁退出。
pub fn mark_supervised_child(command: &mut Command) {
    command.env(SUPERVISOR_PID_ENV, std::process::id().to_string());
}

/// 读取监督者 pid；未设置或不合法时返回 None（即未被监督，独立运行）。
pub fn supervisor_pid_from_env() -> Option<u32> {
    parse_supervisor_pid(std::env::var(SUPERVISOR_PID_ENV).ok().as_deref())
}

fn parse_supervisor_pid(raw: Option<&str>) -> Option<u32> {
    raw?.trim().parse::<u32>().ok().filter(|pid| *pid > 1)
}

/// 两个信号任一成立即认为监督者已不在：
/// - 监督者 pid 已不存在（也覆盖了"刚 spawn 完监督者就死了"的竞态，以及
///   中间隔着一层包装进程、父进程本身仍活着的情况）；
/// - 父进程变了（被 init / subreaper 收养）——防 pid 被复用后误判为存活。
fn supervisor_gone(initial_ppid: u32, current_ppid: u32, supervisor_alive: bool) -> bool {
    !supervisor_alive || current_ppid != initial_ppid
}

/// 等到监督者退出才返回。未被监督（环境变量未设置）或非 unix 平台上永不返回，
/// 调用方可以无条件地把它放进 `select!`。
pub async fn wait_for_supervisor_exit() {
    match supervisor_pid_from_env() {
        Some(pid) => wait_for_process_exit(pid, SUPERVISOR_WATCH_INTERVAL).await,
        None => std::future::pending().await,
    }
}

#[cfg(unix)]
async fn wait_for_process_exit(supervisor_pid: u32, interval: Duration) {
    let initial_ppid = unsafe { libc::getppid() } as u32;
    loop {
        let current_ppid = unsafe { libc::getppid() } as u32;
        let alive = crate::worker_process_exists(supervisor_pid);
        if supervisor_gone(initial_ppid, current_ppid, alive) {
            return;
        }
        sleep(interval).await;
    }
}

// Windows 上桌面端用 `taskkill /T /F` 收整棵树，不依赖这里。
#[cfg(not(unix))]
async fn wait_for_process_exit(_supervisor_pid: u32, _interval: Duration) {
    std::future::pending().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_supervisor_pid_rejects_missing_and_invalid_values() {
        assert_eq!(parse_supervisor_pid(None), None);
        assert_eq!(parse_supervisor_pid(Some("")), None);
        assert_eq!(parse_supervisor_pid(Some("abc")), None);
        assert_eq!(parse_supervisor_pid(Some("-5")), None);
        // 0 / 1 不可能是真正的监督者（0 是"整个进程组"，1 是 init/launchd）。
        assert_eq!(parse_supervisor_pid(Some("0")), None);
        assert_eq!(parse_supervisor_pid(Some("1")), None);
        assert_eq!(parse_supervisor_pid(Some(" 4242 ")), Some(4242));
    }

    #[test]
    fn supervisor_gone_when_dead_or_reparented() {
        assert!(!supervisor_gone(100, 100, true));
        assert!(supervisor_gone(100, 100, false));
        // pid 被复用、看起来"还活着"，但父进程已经换成 init。
        assert!(supervisor_gone(100, 1, true));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn returns_promptly_when_supervisor_pid_is_dead() {
        tokio::time::timeout(
            Duration::from_secs(2),
            wait_for_process_exit(999_999, Duration::from_millis(10)),
        )
        .await
        .expect("watch should notice the dead supervisor");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn keeps_waiting_while_supervisor_is_alive() {
        // 测试进程的父进程（cargo / 测试驱动）在测试期间一直活着。
        let parent = unsafe { libc::getppid() } as u32;
        let outcome = tokio::time::timeout(
            Duration::from_millis(300),
            wait_for_process_exit(parent, Duration::from_millis(10)),
        )
        .await;
        assert!(
            outcome.is_err(),
            "watch must not fire while supervisor lives"
        );
    }
}
