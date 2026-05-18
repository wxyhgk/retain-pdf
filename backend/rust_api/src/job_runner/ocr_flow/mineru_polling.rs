use anyhow::{anyhow, Result};

use crate::job_runner::ProcessRuntimeDeps;
use crate::models::{now_iso, JobRuntimeState};
use crate::ocr_provider::mineru::{
    client::MineruTrace, find_extract_result_in_batch, map_task_status, MineruClient,
};
use crate::ocr_provider::OcrTaskHandle;

use super::artifacts::{download_and_unpack_after_success, persist_provider_result};
use super::mineru_retry::query_with_retry;
use super::polling::{should_stop_polling, wait_next_poll_or_timeout};
use super::save_ocr_job;
use super::status::{record_provider_trace, update_ocr_job_from_status};

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

async fn process_batch_status(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    batch_id: &str,
    file_name: &str,
    batch: MineruTrace<crate::ocr_provider::mineru::models::MineruBatchStatusData>,
    provider_result_json_path: &std::path::Path,
    elapsed_secs: u64,
    parent_job_id: Option<&str>,
) -> Result<bool> {
    record_provider_trace(job, batch.trace_id.clone());
    let item: crate::ocr_provider::mineru::models::MineruBatchResultItem =
        match find_extract_result_in_batch(&batch.data, file_name) {
            Some(item) => item.clone(),
            None => {
                job.append_log(&format!("batch {batch_id}: waiting for extract_result"));
                job.updated_at = now_iso();
                save_ocr_job(deps, job, parent_job_id).await?;
                return Ok(false);
            }
        };

    job.append_log(&format!("batch {batch_id}: state={}", item.state));
    update_ocr_job_from_status(
        deps,
        job,
        map_task_status(
            &item.state,
            OcrTaskHandle {
                batch_id: Some(batch_id.to_string()),
                task_id: None,
                file_name: Some(file_name.to_string()),
            },
            Some(item.err_msg.clone()),
            batch.trace_id.clone(),
        ),
        item.extract_progress
            .as_ref()
            .and_then(|progress| progress.extracted_pages),
        item.extract_progress
            .as_ref()
            .and_then(|progress| progress.total_pages),
        parent_job_id,
    )
    .await?;

    if item.state == "waiting-file" && elapsed_secs >= deps.mineru_runtime().waiting_file_grace_secs
    {
        return Err(anyhow!(
            "MinerU uploaded file was not acknowledged after {}s: batch={} file_name={}",
            elapsed_secs,
            batch_id,
            file_name
        ));
    }
    if item.state == "done" {
        let result = serde_json::json!({
            "code": 0,
            "data": item,
            "msg": "ok",
            "trace_id": batch.trace_id.clone().unwrap_or_default(),
        });
        persist_provider_result(job, provider_result_json_path, &result).await?;
        download_and_unpack_after_success(
            deps,
            job,
            client,
            result["data"]["full_zip_url"].as_str().unwrap_or_default(),
            parent_job_id,
        )
        .await?;
        return Ok(true);
    }
    if item.state == "failed" {
        return Err(anyhow!(
            "MinerU batch task failed: {}",
            item.err_msg.trim().to_string()
        ));
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use crate::config::MineruRuntimeConfig;

    #[test]
    fn waiting_file_grace_window_is_bounded() {
        assert_eq!(MineruRuntimeConfig::from_env().waiting_file_grace_secs, 90);
    }
}

async fn process_remote_task_status(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &MineruClient,
    task_id: &str,
    task: MineruTrace<crate::ocr_provider::mineru::models::MineruTaskData>,
    provider_result_json_path: &std::path::Path,
    parent_job_id: Option<&str>,
) -> Result<bool> {
    record_provider_trace(job, task.trace_id.clone());
    let item = task.data;
    job.append_log(&format!("task {task_id}: state={}", item.state));
    update_ocr_job_from_status(
        deps,
        job,
        map_task_status(
            &item.state,
            OcrTaskHandle {
                batch_id: None,
                task_id: Some(task_id.to_string()),
                file_name: None,
            },
            Some(item.err_msg.clone()),
            task.trace_id.clone(),
        ),
        item.extract_progress
            .as_ref()
            .and_then(|progress| progress.extracted_pages),
        item.extract_progress
            .as_ref()
            .and_then(|progress| progress.total_pages),
        parent_job_id,
    )
    .await?;

    if item.state == "done" {
        let result = serde_json::json!({
            "code": 0,
            "data": item,
            "msg": "ok",
            "trace_id": task.trace_id.clone().unwrap_or_default(),
        });
        persist_provider_result(job, provider_result_json_path, &result).await?;
        download_and_unpack_after_success(
            deps,
            job,
            client,
            result["data"]["full_zip_url"].as_str().unwrap_or_default(),
            parent_job_id,
        )
        .await?;
        return Ok(true);
    }
    if item.state == "failed" {
        return Err(anyhow!(
            "MinerU task failed: {}",
            item.err_msg.trim().to_string()
        ));
    }
    Ok(false)
}
