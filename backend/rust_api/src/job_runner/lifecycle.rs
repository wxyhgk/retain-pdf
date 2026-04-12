use anyhow::{anyhow, Result};
use tokio::sync::{OwnedSemaphorePermit, TryAcquireError};
use tokio::time::{sleep, Duration};
use tracing::error;

use crate::job_events::{persist_job, persist_runtime_job};
use crate::models::{now_iso, JobStatusKind};
use crate::AppState;

use super::{
    append_error_chain_log, format_error_chain, ocr_flow::execute_ocr_job,
    render_flow::run_render_job_from_artifacts, translation_flow::run_translate_only_job_with_ocr,
    translation_flow::run_translation_job_with_ocr, QUEUE_POLL_INTERVAL_MS,
};

pub fn spawn_job(state: AppState, job_id: String) {
    tokio::spawn(async move {
        if let Err(err) = run_job(state.clone(), job_id.clone()).await {
            error!("job {} failed to run: {}", job_id, err);
            if let Ok(mut job) = state.db.get_job(&job_id) {
                if matches!(job.status, JobStatusKind::Canceled) {
                    clear_cancel_request(&state, &job_id).await;
                    return;
                }
                let detail = format_error_chain(&err);
                append_error_chain_log(&mut job, &err);
                job.status = JobStatusKind::Failed;
                job.stage = Some("failed".to_string());
                job.stage_detail = Some(detail.clone());
                job.error = Some(detail);
                job.updated_at = now_iso();
                job.finished_at = Some(now_iso());
                job.sync_runtime_state();
                job.replace_failure_info(crate::job_failure::classify_job_failure(&job));
                let _ = persist_job(&state, &job);
            }
            clear_cancel_request(&state, &job_id).await;
        }
    });
}

async fn run_job(state: AppState, job_id: String) -> Result<()> {
    let mut job = state.db.get_job(&job_id)?;
    if is_cancel_requested(&state, &job_id).await || matches!(job.status, JobStatusKind::Canceled) {
        clear_cancel_request(&state, &job_id).await;
        return Ok(());
    }
    job.status = JobStatusKind::Queued;
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("任务排队中，等待可用执行槽位".to_string());
    job.updated_at = now_iso();
    job.sync_runtime_state();
    job.replace_failure_info(None);
    persist_job(&state, &job)?;

    let _permit = match wait_for_execution_slot(&state, &job_id).await? {
        Some(permit) => permit,
        None => return Ok(()),
    };

    let job = state.db.get_job(&job_id)?;
    if is_cancel_requested(&state, &job_id).await || matches!(job.status, JobStatusKind::Canceled) {
        clear_cancel_request(&state, &job_id).await;
        return Ok(());
    }
    let finished_job = match job.workflow {
        crate::models::WorkflowKind::Ocr => {
            execute_ocr_job(state.clone(), job.into_runtime(), None, None).await?
        }
        crate::models::WorkflowKind::Mineru => {
            run_translation_job_with_ocr(state.clone(), job.into_runtime()).await?
        }
        crate::models::WorkflowKind::Translate => {
            run_translate_only_job_with_ocr(state.clone(), job.into_runtime()).await?
        }
        crate::models::WorkflowKind::Render => {
            run_render_job_from_artifacts(state.clone(), job.into_runtime()).await?
        }
    };
    persist_runtime_job(&state, &finished_job)?;
    clear_cancel_request(&state, &job_id).await;
    Ok(())
}

pub async fn request_cancel(state: &AppState, job_id: &str) {
    let mut canceled_jobs = state.canceled_jobs.write().await;
    canceled_jobs.insert(job_id.to_string());
}

pub async fn clear_cancel_request(state: &AppState, job_id: &str) {
    let mut canceled_jobs = state.canceled_jobs.write().await;
    canceled_jobs.remove(job_id);
}

pub async fn is_cancel_requested(state: &AppState, job_id: &str) -> bool {
    let canceled_jobs = state.canceled_jobs.read().await;
    canceled_jobs.contains(job_id)
}

pub(super) async fn is_cancel_requested_any(
    state: &AppState,
    job_id: &str,
    extra_cancel_job_ids: &[String],
) -> bool {
    if is_cancel_requested(state, job_id).await {
        return true;
    }
    let canceled_jobs = state.canceled_jobs.read().await;
    extra_cancel_job_ids
        .iter()
        .any(|value| canceled_jobs.contains(value))
}

pub(super) async fn wait_for_execution_slot(
    state: &AppState,
    job_id: &str,
) -> Result<Option<OwnedSemaphorePermit>> {
    loop {
        if is_cancel_requested(state, job_id).await {
            clear_cancel_request(state, job_id).await;
            return Ok(None);
        }
        let current_job = state.db.get_job(job_id)?;
        if matches!(current_job.status, JobStatusKind::Canceled) {
            clear_cancel_request(state, job_id).await;
            return Ok(None);
        }
        match state.job_slots.clone().try_acquire_owned() {
            Ok(permit) => return Ok(Some(permit)),
            Err(TryAcquireError::NoPermits) => {
                sleep(Duration::from_millis(QUEUE_POLL_INTERVAL_MS)).await
            }
            Err(TryAcquireError::Closed) => return Err(anyhow!("job execution slots are closed")),
        }
    }
}
