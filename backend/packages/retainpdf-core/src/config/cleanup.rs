use std::time::Duration;

use super::env_vars::{env_u64, env_u64_allow_zero};

/// 派生缓存默认保留天数。2026-10-24 定的默认关（只删能重建的、要清就自己设），2026-11-02 用户改成默认 14 天：
/// 50 个任务的 data/jobs 里渲染准备、预热、线性化 PDF 就有约 270MB，全都能重建（docs/ops/planning/backend-review/）。
pub const DEFAULT_DERIVED_CACHE_RETENTION_DAYS: u64 = 14;

#[derive(Clone, Debug)]
pub struct CleanupConfig {
    pub interval: Duration,
    /// 终态任务的事件保留几天（`RUST_API_EVENTS_RETENTION_DAYS`，默认 30，`0` 不清）。
    pub events_retention_days: u64,
    /// 没被任务引用的上传保留几小时（`RUST_API_ORPHAN_UPLOAD_RETENTION_HOURS`，默认 48，`0` 不清）。
    pub orphan_upload_retention_hours: u64,
    /// 终态任务、书的派生缓存（Word、对照 PDF、线性化 PDF、页预览、渲染准备和预热缓存）生成后保留几天
    /// （`RUST_API_DERIVED_CACHE_RETENTION_DAYS`，默认 14，`0` 不清；2026-11-02 以前默认 `0`）。删了下次请求会重新生成。
    pub derived_cache_retention_days: u64,
}

impl CleanupConfig {
    pub fn from_env() -> Self {
        Self {
            interval: Duration::from_secs(env_u64("RUST_API_CLEANUP_INTERVAL_SECS", 21600)),
            events_retention_days: env_u64_allow_zero("RUST_API_EVENTS_RETENTION_DAYS", 30),
            orphan_upload_retention_hours: env_u64_allow_zero(
                "RUST_API_ORPHAN_UPLOAD_RETENTION_HOURS",
                48,
            ),
            derived_cache_retention_days: env_u64_allow_zero(
                "RUST_API_DERIVED_CACHE_RETENTION_DAYS",
                DEFAULT_DERIVED_CACHE_RETENTION_DAYS,
            ),
        }
    }
}

impl Default for CleanupConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
