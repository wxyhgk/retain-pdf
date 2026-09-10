use std::time::Duration;

use super::env_vars::env_u64;

#[derive(Clone, Debug)]
pub struct CleanupConfig {
    pub interval: Duration,
}

impl CleanupConfig {
    pub fn from_env() -> Self {
        Self {
            interval: Duration::from_secs(env_u64("RUST_API_CLEANUP_INTERVAL_SECS", 21600)),
        }
    }
}

impl Default for CleanupConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
