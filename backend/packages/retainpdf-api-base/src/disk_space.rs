//! 数据目录所在磁盘还剩多少空间。
//!
//! 磁盘写满以后 SQLite 提交失败、worker 写不出产物，任务成批失败，事先没有任何预警（服务端工程审查 M4）。
//! 上传、建任务、原地重跑之前查一下，剩余空间低于下限就直接拒绝（503，`reason` 是
//! [`INSUFFICIENT_STORAGE`]，同时记一条警告日志），已经在跑的任务不管；`/health` 的 `disk` 也报出来。

use std::path::Path;

use crate::error::AppError;

/// 剩余空间不够时 `error.details.reason` 的值。
pub const INSUFFICIENT_STORAGE: &str = "insufficient_storage";

/// `path` 所在磁盘上普通用户还能用的空间（字节）。`path` 还不存在就看它最近的已存在的上级目录。
/// 拿不到（Windows、`statvfs` 失败）返回 `None`。
pub fn free_space_bytes(path: &Path) -> Option<u64> {
    let existing = path.ancestors().find(|candidate| candidate.exists())?;
    free_space_of_existing(existing)
}

#[cfg(unix)]
fn free_space_of_existing(path: &Path) -> Option<u64> {
    use std::os::unix::ffi::OsStrExt;

    let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    // SAFETY: c_path 是以 NUL 结尾的路径，stat 是可写的 statvfs。
    if unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) } != 0 {
        return None;
    }
    #[allow(clippy::unnecessary_cast)]
    Some((stat.f_bavail as u64).saturating_mul(stat.f_frsize as u64))
}

#[cfg(not(unix))]
fn free_space_of_existing(_path: &Path) -> Option<u64> {
    None
}

/// 剩余空间低于 `min_free_bytes` 就拒绝，`what` 写在报错里（例如 `create a job`）。
/// `min_free_bytes` 是 0（关掉检查）或者拿不到剩余空间时一律放行：查不出来不该挡住正常使用。
pub fn ensure_free_space(path: &Path, min_free_bytes: u64, what: &str) -> Result<(), AppError> {
    if min_free_bytes == 0 {
        return Ok(());
    }
    match free_space_bytes(path) {
        Some(free) if free < min_free_bytes => {
            let message = format!(
                "not enough free disk space to {what}: {} MiB left under the data directory, need at least {} MiB",
                free / (1024 * 1024),
                min_free_bytes / (1024 * 1024),
            );
            // 运维看日志才知道磁盘快满了：每拒绝一次记一条。
            tracing::warn!("{message} ({})", path.display());
            Err(AppError::service_unavailable_because(INSUFFICIENT_STORAGE, message))
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_space_of_a_missing_path_is_read_from_its_nearest_existing_parent() {
        let dir = std::env::temp_dir();
        let free = free_space_bytes(&dir.join("does-not-exist-yet/nested")).expect("free space");
        assert_eq!(Some(free / (1024 * 1024)), free_space_bytes(&dir).map(|bytes| bytes / (1024 * 1024)));
    }

    #[test]
    fn below_the_floor_is_a_503_with_a_stable_reason() {
        let dir = std::env::temp_dir();
        ensure_free_space(&dir, 0, "upload a file").expect("0 turns the check off");
        ensure_free_space(&dir, 1, "upload a file").expect("one byte is always there");
        let error = ensure_free_space(&dir, u64::MAX, "create a job").unwrap_err();
        match &error {
            AppError::Reasoned { status, reason, message, .. } => {
                assert_eq!(*status, axum::http::StatusCode::SERVICE_UNAVAILABLE);
                assert_eq!(*reason, INSUFFICIENT_STORAGE);
                assert!(message.starts_with("not enough free disk space to create a job"), "{message}");
            }
            other => panic!("unexpected error: {other:?}"),
        }
    }
}
