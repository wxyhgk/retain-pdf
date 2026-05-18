use std::collections::HashSet;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use tokio::sync::{OwnedSemaphorePermit, RwLock, Semaphore, TryAcquireError};
use tokio::time::{sleep, Duration};

use crate::db::Db;
use crate::models::JobStatusKind;

use super::cancel_registry::{
    clear_cancel_request_with_registry, is_cancel_requested_with_registry,
};
pub(super) async fn wait_for_execution_slot(
    db: &Db,
    canceled_jobs: &RwLock<HashSet<String>>,
    job_slots: &Arc<Semaphore>,
    job_id: &str,
    queue_poll_interval_ms: u64,
) -> Result<Option<OwnedSemaphorePermit>> {
    loop {
        if is_cancel_requested_with_registry(canceled_jobs, job_id).await {
            clear_cancel_request_with_registry(canceled_jobs, job_id).await;
            return Ok(None);
        }
        let current_job = db.get_job(job_id)?;
        if matches!(current_job.status, JobStatusKind::Canceled) {
            clear_cancel_request_with_registry(canceled_jobs, job_id).await;
            return Ok(None);
        }
        match job_slots.clone().try_acquire_owned() {
            Ok(permit) => return Ok(Some(permit)),
            Err(TryAcquireError::NoPermits) => {
                sleep(Duration::from_millis(queue_poll_interval_ms)).await
            }
            Err(TryAcquireError::Closed) => return Err(anyhow!("job execution slots are closed")),
        }
    }
}
