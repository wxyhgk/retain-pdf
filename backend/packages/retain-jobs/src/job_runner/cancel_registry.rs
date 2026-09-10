use std::collections::HashSet;

use tokio::sync::RwLock;

pub async fn request_cancel_with_registry(canceled_jobs: &RwLock<HashSet<String>>, job_id: &str) {
    let mut canceled_jobs = canceled_jobs.write().await;
    canceled_jobs.insert(job_id.to_string());
}

pub async fn clear_cancel_request_with_registry(
    canceled_jobs: &RwLock<HashSet<String>>,
    job_id: &str,
) {
    let mut canceled_jobs = canceled_jobs.write().await;
    canceled_jobs.remove(job_id);
}

pub(super) async fn is_cancel_requested_with_registry(
    canceled_jobs: &RwLock<HashSet<String>>,
    job_id: &str,
) -> bool {
    let canceled_jobs = canceled_jobs.read().await;
    canceled_jobs.contains(job_id)
}

pub(super) async fn is_cancel_requested_any(
    canceled_jobs: &RwLock<HashSet<String>>,
    job_id: &str,
    extra_cancel_job_ids: &[String],
) -> bool {
    if is_cancel_requested_with_registry(canceled_jobs, job_id).await {
        return true;
    }
    let canceled_jobs = canceled_jobs.read().await;
    extra_cancel_job_ids
        .iter()
        .any(|value| canceled_jobs.contains(value))
}
