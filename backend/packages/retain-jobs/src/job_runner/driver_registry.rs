use std::collections::HashSet;
use std::sync::{Arc, Mutex};

/// Shared by every launcher in one owning runtime, including startup recovery.
#[derive(Default)]
pub struct JobDriverRegistry {
    jobs: Mutex<HashSet<String>>,
}

impl JobDriverRegistry {
    pub(super) fn claim(self: &Arc<Self>, job_id: &str) -> Option<JobDriverGuard> {
        let mut jobs = self.jobs.lock().unwrap_or_else(|error| error.into_inner());
        if !jobs.insert(job_id.to_owned()) {
            return None;
        }
        Some(JobDriverGuard {
            registry: self.clone(),
            job_id: job_id.to_owned(),
        })
    }
}

pub(super) struct JobDriverGuard {
    registry: Arc<JobDriverRegistry>,
    job_id: String,
}

impl Drop for JobDriverGuard {
    fn drop(&mut self) {
        self.registry
            .jobs
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&self.job_id);
    }
}
