use super::env_vars::env_u64;

#[derive(Clone, Debug)]
pub struct JobRunnerConfig {
    pub queue_poll_interval_ms: u64,
    pub worker_terminate_grace_secs: u64,
    pub worker_terminate_poll_ms: u64,
    pub failure_ai_diagnosis_timeout_secs: u64,
    pub sync_bundle_wait_interval_ms: u64,
}

impl JobRunnerConfig {
    pub fn from_env() -> Self {
        Self {
            queue_poll_interval_ms: env_u64("RUST_API_QUEUE_POLL_INTERVAL_MS", 250),
            worker_terminate_grace_secs: env_u64("RUST_API_WORKER_TERMINATE_GRACE_SECS", 3),
            worker_terminate_poll_ms: env_u64("RUST_API_WORKER_TERMINATE_POLL_MS", 100),
            failure_ai_diagnosis_timeout_secs: env_u64(
                "RUST_API_FAILURE_AI_DIAGNOSIS_TIMEOUT_SECS",
                60,
            ),
            sync_bundle_wait_interval_ms: env_u64("RUST_API_SYNC_BUNDLE_WAIT_INTERVAL_MS", 1500),
        }
    }
}

impl Default for JobRunnerConfig {
    fn default() -> Self {
        Self::from_env()
    }
}
