use std::time::{Duration, Instant};

use crate::db::Db;
use crate::error::AppError;
use crate::job_events::persist_job_with_resources;
use crate::models::{now_iso, JobSnapshot, JobStatusKind};
use crate::services::runtime_gateway::terminate_runtime_process;

use super::creation::context::ControlDeps;
use super::query::load_job_or_404;

pub async fn wait_for_terminal_job(
    db: &Db,
    job_id: &str,
    timeout_seconds: i64,
    wait_interval_ms: u64,
) -> Result<JobSnapshot, AppError> {
    let timeout_seconds = if timeout_seconds > 0 {
        timeout_seconds as u64
    } else {
        1800
    };
    let started = Instant::now();
    loop {
        let job = load_job_or_404(db, job_id)?;
        match job.status {
            JobStatusKind::Succeeded => return Ok(job),
            JobStatusKind::Failed => {
                let detail = job
                    .error
                    .clone()
                    .or(job.stage_detail.clone())
                    .unwrap_or_else(|| "job failed".to_string());
                return Err(AppError::internal(format!("job failed: {detail}")));
            }
            JobStatusKind::Canceled => {
                let detail = job
                    .stage_detail
                    .clone()
                    .unwrap_or_else(|| "job was canceled".to_string());
                return Err(AppError::conflict(detail));
            }
            JobStatusKind::Queued | JobStatusKind::Running => {}
        }
        if started.elapsed() >= Duration::from_secs(timeout_seconds) {
            return Err(AppError::conflict(format!(
                "job did not finish within timeout: {}s (job_id={job_id})",
                timeout_seconds
            )));
        }
        tokio::time::sleep(Duration::from_millis(wait_interval_ms)).await;
    }
}

pub(crate) async fn cancel_job(
    deps: &ControlDeps<'_>,
    job_id: &str,
    ocr_only: bool,
) -> Result<JobSnapshot, AppError> {
    let mut job = load_job_or_404(deps.db, job_id)?;
    if ocr_only && !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    deps.runtime.request_cancel(job_id).await;
    if !ocr_only || !matches!(job.stage.as_deref(), Some("normalizing")) {
        if let Some(pid) = job.pid {
            terminate_runtime_process(pid, deps.job_runner).await?;
        }
    }
    if ocr_only {
        if matches!(job.stage.as_deref(), Some("queued")) {
            job.status = JobStatusKind::Canceled;
            job.stage = Some("canceled".to_string());
            job.stage_detail = Some("OCR 任务已取消".to_string());
            job.updated_at = now_iso();
            job.finished_at = Some(now_iso());
            job.pid = None;
            job.sync_runtime_state();
            job.replace_failure_info(None);
            persist_job_with_resources(deps.db, deps.data_root, deps.output_root, &job)?;
        }
        return Ok(job);
    }
    job.status = JobStatusKind::Canceled;
    job.stage = Some("canceled".to_string());
    job.stage_detail = Some("任务已取消".to_string());
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.pid = None;
    job.sync_runtime_state();
    job.replace_failure_info(None);
    persist_job_with_resources(deps.db, deps.data_root, deps.output_root, &job)?;
    Ok(job)
}
