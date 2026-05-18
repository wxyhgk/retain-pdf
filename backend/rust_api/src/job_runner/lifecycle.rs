use anyhow::Result;
use tracing::error;

use crate::job_events::{persist_job_with_resources, persist_runtime_job_with_resources};
use crate::models::{now_iso, JobRuntimeState, JobSnapshot, JobStatusKind, WorkflowKind};

use super::{
    append_error_chain_log,
    cancel_registry::{clear_cancel_request_with_registry, is_cancel_requested_with_registry},
    execution_queue::wait_for_execution_slot,
    format_error_chain,
    ocr_flow::execute_ocr_job,
    render_flow::run_render_job_from_artifacts,
    translation_flow::run_translate_only_job_with_ocr,
    translation_flow::run_translation_job_with_ocr,
    ProcessRuntimeDeps,
};

pub(crate) fn spawn_job(deps: ProcessRuntimeDeps, job_id: String) {
    tokio::spawn(async move {
        if let Err(err) = run_job(deps.clone(), job_id.clone()).await {
            error!("job {} failed to run: {}", job_id, err);
            if let Ok(job) = deps.db.get_job(&job_id) {
                if !matches!(job.status, JobStatusKind::Canceled) {
                    let _ = persist_failed_job(&deps, job, &err);
                }
            }
            clear_job_cancel_request(&deps, &job_id).await;
        }
    });
}

async fn clear_job_cancel_request(deps: &ProcessRuntimeDeps, job_id: &str) {
    clear_cancel_request_with_registry(deps.canceled_jobs.as_ref(), job_id).await;
}

async fn should_skip_job_execution(deps: &ProcessRuntimeDeps, job_id: &str) -> Result<bool> {
    let job = deps.db.get_job(job_id)?;
    if is_cancel_requested_with_registry(deps.canceled_jobs.as_ref(), job_id).await
        || matches!(job.status, JobStatusKind::Canceled)
    {
        clear_job_cancel_request(deps, job_id).await;
        return Ok(true);
    }
    Ok(false)
}

fn persist_queued_job(deps: &ProcessRuntimeDeps, job: &mut JobSnapshot) -> Result<()> {
    job.status = JobStatusKind::Queued;
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("任务排队中，等待可用执行槽位".to_string());
    job.updated_at = now_iso();
    job.sync_runtime_state();
    job.replace_failure_info(None);
    persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        job,
    )?;
    Ok(())
}

async fn dispatch_workflow(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    match job.workflow {
        WorkflowKind::Ocr => execute_ocr_job(deps, job, None, None).await,
        WorkflowKind::Book => run_translation_job_with_ocr(deps, job).await,
        WorkflowKind::Translate => run_translate_only_job_with_ocr(deps, job).await,
        WorkflowKind::Render => run_render_job_from_artifacts(deps, job).await,
    }
}

fn persist_failed_job(
    deps: &ProcessRuntimeDeps,
    mut job: JobSnapshot,
    err: &anyhow::Error,
) -> Result<()> {
    let detail = format_error_chain(err);
    append_error_chain_log(&mut job, err);
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.stage_detail = Some(detail.clone());
    job.error = Some(detail);
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.sync_runtime_state();
    job.replace_failure_info(crate::job_failure::classify_job_failure(&job));
    persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job,
    )?;
    Ok(())
}

async fn run_job(deps: ProcessRuntimeDeps, job_id: String) -> Result<()> {
    if should_skip_job_execution(&deps, &job_id).await? {
        return Ok(());
    }
    let mut job = deps.db.get_job(&job_id)?;
    persist_queued_job(&deps, &mut job)?;

    let _permit = match wait_for_execution_slot(
        deps.db.as_ref(),
        deps.canceled_jobs.as_ref(),
        &deps.job_slots,
        &job_id,
        deps.job_runner_config().queue_poll_interval_ms,
    )
    .await?
    {
        Some(permit) => permit,
        None => return Ok(()),
    };

    if should_skip_job_execution(&deps, &job_id).await? {
        return Ok(());
    }
    let finished_job =
        dispatch_workflow(deps.clone(), deps.db.get_job(&job_id)?.into_runtime()).await?;
    persist_runtime_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &finished_job,
    )?;
    clear_job_cancel_request(&deps, &job_id).await;
    Ok(())
}
