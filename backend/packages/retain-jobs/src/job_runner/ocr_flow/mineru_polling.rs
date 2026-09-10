use anyhow::Result;

use crate::job_runner::ProcessRuntimeDeps;
use crate::models::domain::JobRuntimeState;
use crate::ocr_provider::mineru::MineruClient;

use super::mineru_retry::query_with_retry;
use super::mineru_status_handlers::{process_batch_status, process_remote_task_status};
use super::polling::{should_stop_polling, wait_next_poll_or_timeout};

pub(super) async fn poll_uploaded_batch_until_ready(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    batch_id: &str,
    file_name: &str,
    provider_result_json_path: &std::path::Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let poll_interval = std::cmp::max(job.request_payload.ocr.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.ocr.poll_timeout, 1) as u64;
    let started = std::time::Instant::now();

    loop {
        if should_stop_polling(&deps.canceled_jobs, &job.job_id).await {
            return Ok(());
        }
        let Some(batch) = query_with_retry(
            deps,
            job,
            "batch",
            batch_id,
            timeout_secs,
            parent_job_id,
            || client.query_batch_status(batch_id),
        )
        .await?
        else {
            wait_next_poll_or_timeout(started, timeout_secs, poll_interval, || {
                format!("Timed out waiting for MinerU batch result: {batch_id}")
            })
            .await?;
            continue;
        };
        if process_batch_status(
            deps,
            job,
            client,
            batch_id,
            file_name,
            batch,
            provider_result_json_path,
            started.elapsed().as_secs(),
            parent_job_id,
        )
        .await?
        {
            return Ok(());
        }
        wait_next_poll_or_timeout(started, timeout_secs, poll_interval, || {
            format!("Timed out waiting for MinerU batch result: {batch_id}")
        })
        .await?;
    }
}

pub(super) async fn poll_remote_task_until_ready(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    task_id: &str,
    provider_result_json_path: &std::path::Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let poll_interval = std::cmp::max(job.request_payload.ocr.poll_interval, 1) as u64;
    let timeout_secs = std::cmp::max(job.request_payload.ocr.poll_timeout, 1) as u64;
    let started = std::time::Instant::now();

    loop {
        if should_stop_polling(&deps.canceled_jobs, &job.job_id).await {
            return Ok(());
        }
        let Some(task) = query_with_retry(
            deps,
            job,
            "task",
            task_id,
            timeout_secs,
            parent_job_id,
            || client.query_task(task_id),
        )
        .await?
        else {
            wait_next_poll_or_timeout(started, timeout_secs, poll_interval, || {
                format!("Timed out waiting for MinerU task {task_id}")
            })
            .await?;
            continue;
        };
        if process_remote_task_status(
            deps,
            job,
            client,
            task_id,
            task,
            provider_result_json_path,
            parent_job_id,
        )
        .await?
        {
            return Ok(());
        }
        wait_next_poll_or_timeout(started, timeout_secs, poll_interval, || {
            format!("Timed out waiting for MinerU task {task_id}")
        })
        .await?;
    }
}
