use std::time::Duration;

use super::env_vars::env_u64;

#[derive(Clone, Debug)]
pub struct AiProxyConfig {
    pub connect_timeout: Duration,
    pub header_timeout: Duration,
    pub idle_timeout: Duration,
    pub runtime_config_timeout: Duration,
    pub service_base: Option<String>,
}

impl AiProxyConfig {
    pub fn from_env() -> Self {
        Self {
            header_timeout: Duration::from_secs(
                env_u64("RUST_API_AI_PROXY_HEADER_TIMEOUT_SECS", 120).max(1),
            ),
            idle_timeout: Duration::from_secs(
                env_u64("RUST_API_AI_PROXY_IDLE_TIMEOUT_SECS", 30).max(1),
            ),
            runtime_config_timeout: Duration::from_secs(
                env_u64("RUST_API_AI_PROXY_CONFIG_TIMEOUT_SECS", 15).max(1),
            ),
            service_base: std::env::var("RUST_API_AI_SERVICE_BASE")
                .ok()
                .map(|value| value.trim().trim_end_matches('/').to_string())
                .filter(|value| !value.is_empty()),
            connect_timeout: Duration::from_secs(env_u64(
                "RUST_API_AI_PROXY_CONNECT_TIMEOUT_SECS",
                3,
            )),
        }
    }
}

impl Default for AiProxyConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
