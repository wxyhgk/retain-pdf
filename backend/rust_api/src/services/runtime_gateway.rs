use std::collections::HashSet;
use std::sync::Arc;

use tokio::sync::RwLock;

use crate::config::JobRunnerConfig;
use crate::error::AppError;
use crate::job_runner::{request_cancel_with_registry, terminate_job_process_tree};

#[derive(Clone)]
pub struct JobRuntimeLauncher {
    launch_job: Arc<dyn Fn(String) + Send + Sync + 'static>,
}

impl JobRuntimeLauncher {
    pub fn new(launch_job: Arc<dyn Fn(String) + Send + Sync + 'static>) -> Self {
        Self { launch_job }
    }

    pub fn launch(&self, job_id: String) {
        (self.launch_job)(job_id);
    }
}

#[derive(Clone, Copy)]
pub struct RuntimeControl<'a> {
    canceled_jobs: &'a RwLock<HashSet<String>>,
}

impl<'a> RuntimeControl<'a> {
    pub fn new(canceled_jobs: &'a RwLock<HashSet<String>>) -> Self {
        Self { canceled_jobs }
    }

    pub async fn request_cancel(&self, job_id: &str) {
        request_cancel_with_registry(self.canceled_jobs, job_id).await;
    }
}

pub async fn terminate_runtime_process(pid: u32, config: &JobRunnerConfig) -> Result<(), AppError> {
    terminate_job_process_tree(
        pid,
        config.worker_terminate_grace_secs,
        config.worker_terminate_poll_ms,
    )
    .await
    .map_err(|e| AppError::internal(format!("failed to terminate job process tree: {e}")))
}
