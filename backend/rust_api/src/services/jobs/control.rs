use std::time::{Duration, Instant};

use crate::db::Db;
use crate::error::AppError;
use crate::job_events::persist_job;
use crate::job_runner::{request_cancel, terminate_job_process_tree};
use crate::models::{now_iso, JobSnapshot, JobStatusKind};
use crate::services::jobs::load_job_or_404;
use crate::AppState;

const SYNC_BUNDLE_WAIT_INTERVAL_MS: u64 = 1500;

pub async fn wait_for_terminal_job(
    db: &Db,
    job_id: &str,
    timeout_seconds: i64,
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
        tokio::time::sleep(Duration::from_millis(SYNC_BUNDLE_WAIT_INTERVAL_MS)).await;
    }
}

pub async fn cancel_job(
    state: &AppState,
    job_id: &str,
    ocr_only: bool,
) -> Result<JobSnapshot, AppError> {
    let mut job = load_job_or_404(state.db.as_ref(), job_id)?;
    if ocr_only && !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    request_cancel(state, job_id).await;
    if !ocr_only || !matches!(job.stage.as_deref(), Some("normalizing")) {
        if let Some(pid) = job.pid {
            terminate_job_process_tree(pid).await.map_err(|e| {
                AppError::internal(format!("failed to terminate job process tree: {e}"))
            })?;
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
            persist_job(state, &job)?;
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
    persist_job(state, &job)?;
    Ok(job)
}
