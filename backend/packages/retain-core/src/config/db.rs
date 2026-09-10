use std::time::Duration;

use super::env_vars::env_u64;

#[derive(Clone, Debug)]
pub struct DbConfig {
    pub busy_timeout: Duration,
}

impl DbConfig {
    pub fn from_env() -> Self {
        Self {
            busy_timeout: Duration::from_millis(env_u64("RUST_API_DB_BUSY_TIMEOUT_MS", 5000)),
        }
    }
}

impl Default for DbConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
