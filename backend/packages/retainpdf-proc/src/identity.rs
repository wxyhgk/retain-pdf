//! 进程身份：pid 会被复用，「pid + 进程启动时间」不会。
//!
//! 库里只记 pid 的话，`kill(pid, 0)` 只能证明「现在有个进程叫这个号」，证明不了它还是当初
//! spawn 的那个 worker——长时间宕机、重启机器之后，这个号可能早就归了别的程序。spawn 后立刻
//! 读一次启动时间存下来，杀之前再读一次核对，对不上就说明号被复用了。
//!
//! - Linux：`/proc/<pid>/stat` 第 22 个字段 starttime（开机以来的时钟滴答），再带上本次开机的
//!   `boot_id`，重启机器后同号同滴答也认不错。
//! - macOS：`proc_pidinfo(PROC_PIDTBSDINFO)` 的 `pbi_start_tvsec/usec`（墙上时间，微秒）。
//! - Windows：`GetProcessTimes` 的创建时刻（FILETIME，100 纳秒一格，墙上时间）。pid 在最后一个句柄关掉之前
//!   不会被复用，复用后创建时刻一定不同。
//! - 别的平台读不到，返回 None（调用方按「没有身份信息」处理）。

/// 一个进程的启动时刻。
#[derive(Debug, Clone, PartialEq)]
pub struct ProcessStart {
    /// 精确比较用的指纹：同一个进程每次读都一样，pid 被复用后一定不一样。
    pub token: String,
    /// 启动时刻（Unix 秒，墙上时间）。Linux 上是由开机时刻推算的近似值，只能粗比，不能拿来判等。
    pub started_unix_secs: f64,
}

/// 读 pid 的启动时刻；进程不存在、读不到（权限、平台不支持）时返回 None。
pub fn process_start(pid: u32) -> Option<ProcessStart> {
    if pid == 0 {
        return None;
    }
    platform::process_start(pid)
}

/// 存进库里的身份串：`<pid>@<token>`。带上 pid，串和 pid 对不上时一眼能认出是陈旧记录。
pub fn process_identity(pid: u32) -> Option<String> {
    process_start(pid).map(|start| format!("{pid}@{}", start.token))
}

/// 核对库里记的身份串：`Some(true)` 现在这个 pid 就是当初那个进程；`Some(false)` 不是
/// （进程没了、号被复用、或者读不到它的启动时间）；`None` 身份串不是这个 pid 的（陈旧或格式不对），
/// 等于没有身份信息，由调用方决定怎么办。
pub fn identity_matches(pid: u32, recorded: &str) -> Option<bool> {
    let (recorded_pid, token) = recorded.split_once('@')?;
    if recorded_pid.parse::<u32>().ok()? != pid || token.is_empty() {
        return None;
    }
    Some(process_start(pid).is_some_and(|start| start.token == token))
}

#[cfg(target_os = "linux")]
mod platform {
    use super::ProcessStart;

    pub(super) fn process_start(pid: u32) -> Option<ProcessStart> {
        let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
        let ticks = parse_start_ticks(&stat)?;
        let boot_id = std::fs::read_to_string("/proc/sys/kernel/random/boot_id")
            .map(|id| id.trim().to_string())
            .unwrap_or_default();
        let clock_ticks = unsafe { libc::sysconf(libc::_SC_CLK_TCK) };
        let clock_ticks = if clock_ticks > 0 {
            clock_ticks as f64
        } else {
            100.0
        };
        let boot_time = boot_time_secs().unwrap_or(0.0);
        Some(ProcessStart {
            token: format!("linux:{boot_id}:{ticks}"),
            started_unix_secs: boot_time + ticks as f64 / clock_ticks,
        })
    }

    /// `pid (comm) state ppid ...`：comm 里可能有空格和括号，从最后一个 `)` 之后数字段。
    /// `)` 之后第一个是第 3 个字段 state，starttime 是第 22 个。
    pub(super) fn parse_start_ticks(stat: &str) -> Option<u64> {
        let rest = &stat[stat.rfind(')')? + 1..];
        rest.split_whitespace().nth(22 - 3)?.parse().ok()
    }

    fn boot_time_secs() -> Option<f64> {
        let stat = std::fs::read_to_string("/proc/stat").ok()?;
        stat.lines()
            .find_map(|line| line.strip_prefix("btime "))
            .and_then(|value| value.trim().parse::<f64>().ok())
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::ProcessStart;

    pub(super) fn process_start(pid: u32) -> Option<ProcessStart> {
        let pid = libc::c_int::try_from(pid).ok()?;
        let mut info: libc::proc_bsdinfo = unsafe { std::mem::zeroed() };
        let size = std::mem::size_of::<libc::proc_bsdinfo>() as libc::c_int;
        let written = unsafe {
            libc::proc_pidinfo(
                pid,
                libc::PROC_PIDTBSDINFO,
                0,
                (&mut info as *mut libc::proc_bsdinfo).cast(),
                size,
            )
        };
        if written != size || info.pbi_pid as libc::c_int != pid {
            return None;
        }
        Some(ProcessStart {
            token: format!(
                "darwin:{}.{:06}",
                info.pbi_start_tvsec, info.pbi_start_tvusec
            ),
            started_unix_secs: info.pbi_start_tvsec as f64
                + info.pbi_start_tvusec as f64 / 1_000_000.0,
        })
    }
}

#[cfg(windows)]
mod platform {
    use super::ProcessStart;

    /// FILETIME 的起点 1601-01-01 到 Unix 纪元之间的 100 纳秒数。
    const FILETIME_UNIX_EPOCH: u64 = 116_444_736_000_000_000;

    pub(super) fn process_start(pid: u32) -> Option<ProcessStart> {
        let ticks = crate::windows_process::creation_time(pid)?;
        Some(ProcessStart {
            token: format!("windows:{ticks}"),
            started_unix_secs: ticks.saturating_sub(FILETIME_UNIX_EPOCH) as f64 / 10_000_000.0,
        })
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod platform {
    use super::ProcessStart;

    pub(super) fn process_start(_pid: u32) -> Option<ProcessStart> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_stat_parser_counts_fields_after_the_last_paren() {
        // comm 里带空格和右括号，也不能数错字段。
        let stat = "4242 (we ird) name) S 1 4242 4242 0 -1 4194560 100 0 0 0 1 2 0 0 20 0 1 0 987654 1000 10";
        assert_eq!(platform::parse_start_ticks(stat), Some(987654));
        assert_eq!(platform::parse_start_ticks("garbage"), None);
    }

    #[cfg(any(target_os = "linux", target_os = "macos", windows))]
    #[test]
    fn identity_is_stable_for_the_same_process_and_matches_itself() {
        let pid = std::process::id();
        let first = process_identity(pid).expect("current process identity");
        assert_eq!(process_identity(pid).as_deref(), Some(first.as_str()));
        assert_eq!(identity_matches(pid, &first), Some(true));
        let start = process_start(pid).expect("start");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        assert!(start.started_unix_secs <= now + 2.0, "{start:?}");
        assert!(start.started_unix_secs > now - 86_400.0 * 30.0, "{start:?}");
    }

    #[cfg(any(target_os = "linux", target_os = "macos", windows))]
    #[test]
    fn identity_of_a_different_process_does_not_match() {
        // 「号被复用」：同一个 pid 现在是另一个进程，启动时间不同。
        let pid = std::process::id();
        // Linux 的启动时间按时钟滴答记（通常 10ms 一格）。测试进程刚起来就派子进程，两个会落在同一格、
        // 分不出来（CI 上就这样红过），先等几格再派。
        std::thread::sleep(std::time::Duration::from_millis(50));
        #[cfg(not(windows))]
        let mut child = std::process::Command::new("sleep")
            .arg("5")
            .spawn()
            .unwrap();
        #[cfg(windows)]
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "ping -n 6 127.0.0.1 > NUL"])
            .spawn()
            .unwrap();
        let other = process_identity(child.id()).expect("child identity");
        let own = process_identity(pid).expect("current process identity");
        assert_ne!(own.split_once('@').unwrap().1, other.split_once('@').unwrap().1);
        let forged = format!("{pid}@{}", other.split_once('@').unwrap().1);
        assert_eq!(identity_matches(pid, &forged), Some(false));
        let _ = child.kill();
        let _ = child.wait();
    }

    #[test]
    fn identity_for_another_pid_counts_as_no_identity() {
        assert_eq!(identity_matches(42, "43@linux:x:1"), None);
        assert_eq!(identity_matches(42, "nonsense"), None);
        assert_eq!(identity_matches(42, "42@"), None);
    }

    #[test]
    fn dead_pid_has_no_identity() {
        assert_eq!(process_identity(999_999), None);
        assert_eq!(process_identity(0), None);
        assert_eq!(identity_matches(999_999, "999999@linux:x:1"), Some(false));
    }
}
