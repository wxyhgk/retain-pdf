use std::time::Duration;

use super::env_vars::env_u64;

#[derive(Clone, Debug)]
pub struct ReaderLlmConfig {
    pub connect_timeout: Duration,
    pub timeout: Duration,
}

impl ReaderLlmConfig {
    pub fn from_env() -> Self {
        Self {
            connect_timeout: Duration::from_secs(env_u64(
                "RUST_API_READER_LLM_CONNECT_TIMEOUT_SECS",
                10,
            )),
            timeout: Duration::from_secs(env_u64("RUST_API_READER_LLM_TIMEOUT_SECS", 60)),
        }
    }
}

impl Default for ReaderLlmConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
