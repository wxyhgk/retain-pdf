use anyhow::Result;
use tracing::error;

#[cfg(test)]
#[path = "lifecycle_tests.rs"]
mod tests;

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{now_iso, JobRuntimeState, JobSnapshot, JobStatusKind, WorkflowKind};

use super::{
    append_error_chain_log,
    cancel_registry::{clear_cancel_request_with_registry, is_cancel_requested_with_registry},
    execution_queue::wait_for_execution_slot,
    format_error_chain,
    ocr_flow::execute_ocr_job,
    render_flow::run_render_job_from_artifacts,
    translation_flow::resume_render_stage_from_durable_state,
    translation_flow::resume_translation_stage_from_durable_state,
    translation_flow::run_translate_only_job_with_ocr,
    translation_flow::run_translation_job_with_ocr,
    ProcessRuntimeDeps,
};

pub fn spawn_job(deps: ProcessRuntimeDeps, job_id: String) {
    spawn_job_with_workflow(deps, job_id, dispatch_workflow);
}

fn spawn_job_with_workflow<F, Fut>(
    deps: ProcessRuntimeDeps,
    job_id: String,
    workflow: F,
) -> Option<tokio::task::JoinHandle<()>>
where
    F: FnOnce(ProcessRuntimeDeps, JobRuntimeState) -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<JobRuntimeState>> + Send,
{
    let Some(guard) = deps.job_drivers.claim(&job_id) else {
        return None;
    };
    Some(tokio::spawn(async move {
        let _guard = guard;
        if let Err(err) = run_job(deps.clone(), job_id.clone(), workflow).await {
            error!("job {} failed to run: {}", job_id, err);
            if let Ok(job) = deps.db.get_job(&job_id) {
                if !matches!(job.status, JobStatusKind::Canceled) {
                    let _ = persist_failed_job(&deps, job, &err);
                }
            }
            clear_job_cancel_request(&deps, &job_id).await;
        }
    }))
}

async fn clear_job_cancel_request(deps: &ProcessRuntimeDeps, job_id: &str) {
    clear_cancel_request_with_registry(deps.canceled_jobs.as_ref(), job_id).await;
}

async fn should_skip_job_execution(deps: &ProcessRuntimeDeps, job_id: &str) -> Result<bool> {
    let job = deps.db.get_job(job_id)?;
    if is_cancel_requested_with_registry(deps.canceled_jobs.as_ref(), job_id).await
        || !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running)
    {
        clear_job_cancel_request(deps, job_id).await;
        return Ok(true);
    }
    Ok(false)
}

fn persist_queued_job(deps: &ProcessRuntimeDeps, job: &mut JobSnapshot) -> Result<bool> {
    job.status = JobStatusKind::Queued;
    job.stage = Some("queued".to_string());
    job.stage_detail = Some("任务排队中，等待可用执行槽位".to_string());
    job.updated_at = now_iso();
    job.sync_runtime_state();
    job.replace_failure_info(None);
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        job,
        &["queued", "running"],
    )?;
    Ok(updated)
}

async fn dispatch_workflow(
    deps: ProcessRuntimeDeps,
    job: JobRuntimeState,
) -> Result<JobRuntimeState> {
    // Keep pipeline state machines out of the driver future. In debug builds,
    // nested inline workflow polling can exhaust the default runtime thread
    // stack as soon as another request yields to this background task.
    let durable_stage = deps.db.running_pipeline_stage_key(&job.job_id)?;
    match (&job.workflow, durable_stage.as_deref()) {
        (WorkflowKind::Book, Some("render")) => {
            return Box::pin(resume_render_stage_from_durable_state(deps, job)).await;
        }
        (WorkflowKind::Book, Some("translate")) => {
            return Box::pin(resume_translation_stage_from_durable_state(deps, job, true)).await;
        }
        (WorkflowKind::Translate, Some("translate")) => {
            let render_after_translation = job.request_payload.runtime.render_after_translation;
            return Box::pin(resume_translation_stage_from_durable_state(
                deps,
                job,
                render_after_translation,
            ))
            .await;
        }
        (WorkflowKind::Translate, Some("render"))
            if job.request_payload.runtime.render_after_translation =>
        {
            return Box::pin(resume_render_stage_from_durable_state(deps, job)).await;
        }
        _ => {}
    }
    match job.workflow {
        WorkflowKind::Ocr => Box::pin(execute_ocr_job(deps, job, None, None)).await,
        WorkflowKind::Book => Box::pin(run_translation_job_with_ocr(deps, job)).await,
        WorkflowKind::Translate => Box::pin(run_translate_only_job_with_ocr(deps, job)).await,
        WorkflowKind::Render => Box::pin(run_render_job_from_artifacts(deps, job)).await,
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
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job,
        &["queued", "running"],
    )?;
    if updated {
        let _ = deps
            .db
            .finish_latest_pipeline_attempt(&job.job_id, "failed")?;
    }
    Ok(())
}

/// 取消标记在队列门被消费掉之后,由谁来落终态。
///
/// `wait_for_execution_slot` 命中取消标记时会**清掉标记并返回 None**,driver 随即
/// 退出——它不写任何状态。正常取消路径没事:`cancel_job` 紧接着就会 CAS 写
/// Canceled。但 `cancel_job(ocr_only = true)` 在 `stage != "queued"` 时**完全不写
/// DB**(它把落终态的责任交给 runner 的取消检查点,好让 runner 先做 provider 清理),
/// 于是出现一个没人收尾的空洞:标记没了、driver 走了、DB 行还停在 queued/running,
/// 而且再没有 driver 会来驱动它。用户看到的是永久转圈,连重跑都点不了——
/// `rerun` 对 queued/running 直接 conflict。
///
/// 这里补上收尾。用 CAS 是因为 runner 的检查点或 `cancel_job` 可能已经抢先写过了,
/// 那种情况下应当尊重它们写的结果,而不是覆盖。
fn persist_canceled_job(deps: &ProcessRuntimeDeps, job_id: &str) -> Result<()> {
    let mut job = deps.db.get_job(job_id)?;
    if !matches!(
        job.status,
        JobStatusKind::Queued | JobStatusKind::Running
    ) {
        return Ok(());
    }
    job.status = JobStatusKind::Canceled;
    job.stage = Some("canceled".to_string());
    job.stage_detail = Some("任务已取消".to_string());
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.pid = None;
    job.sync_runtime_state();
    job.replace_failure_info(None);
    let updated = cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &job,
        &["queued", "running"],
    )?;
    if updated {
        let _ = deps
            .db
            .finish_latest_pipeline_attempt(&job.job_id, "canceled")?;
    }
    Ok(())
}

async fn run_job<F, Fut>(deps: ProcessRuntimeDeps, job_id: String, workflow: F) -> Result<()>
where
    F: FnOnce(ProcessRuntimeDeps, JobRuntimeState) -> Fut,
    Fut: std::future::Future<Output = Result<JobRuntimeState>>,
{
    // 这里也会消费掉取消标记然后早退,和队列门是同一个洞,只是更早。
    // `persist_canceled_job` 自带「只在 queued/running 时写」的守卫,所以
    // 「行已终态」那个分支调用它是安全的空操作。
    if should_skip_job_execution(&deps, &job_id).await? {
        persist_canceled_job(&deps, &job_id)?;
        return Ok(());
    }
    let mut job = deps.db.get_job(&job_id)?;
    if !persist_queued_job(&deps, &mut job)? {
        clear_job_cancel_request(&deps, &job_id).await;
        return Ok(());
    }

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
        // 队列门已经把取消标记清掉了,这里必须补一次终态,否则任务会挂着没人管。
        None => {
            persist_canceled_job(&deps, &job_id)?;
            return Ok(());
        }
    };

    if should_skip_job_execution(&deps, &job_id).await? {
        return Ok(());
    }
    let finished_job = workflow(deps.clone(), deps.db.get_job(&job_id)?.into_runtime()).await?;
    let updated = crate::job_events::cas_persist_job_with_resources(
        deps.db.as_ref(),
        &deps.persist.data_root,
        &deps.persist.output_root,
        &finished_job.snapshot(),
        &["queued", "running"],
    )?;
    if !updated {
        // Already terminal (e.g., canceled), do not overwrite with Succeeded/Failed
        clear_job_cancel_request(&deps, &job_id).await;
        return Ok(());
    }
    let terminal_status = match finished_job.status {
        JobStatusKind::Succeeded => "succeeded",
        JobStatusKind::Failed => "failed",
        JobStatusKind::Canceled => "canceled",
        JobStatusKind::Queued | JobStatusKind::Running => "failed",
    };
    let _ = deps
        .db
        .finish_latest_pipeline_attempt(&job_id, terminal_status)?;
    update_document_after_job(&deps, &finished_job);
    clear_job_cancel_request(&deps, &job_id).await;
    Ok(())
}

/// 任务终态后的图书馆维护:job 归属 document、置 active_job_id、重建
/// 该文档的 FTS 全文索引。全部尽力而为——FTS 是可重建的派生索引,
/// 这里失败只记日志,绝不影响任务状态。
fn update_document_after_job(deps: &ProcessRuntimeDeps, job: &JobRuntimeState) {
    let Some(upload_id) = job.upload_id.as_deref().filter(|id| !id.is_empty()) else {
        return;
    };
    let document_id = match deps.db.link_job_to_document(&job.job_id, upload_id) {
        Ok(Some(document_id)) => document_id,
        Ok(None) => return,
        Err(error) => {
            error!(
                "library: link job {} to document failed: {error}",
                job.job_id
            );
            return;
        }
    };
    if job.status != JobStatusKind::Succeeded {
        return;
    }
    // OCR-only 吸怪：允许 OCR 任务在无其他成功任务时成为 active_job，避免“OCR 后刷新消失”
    // 非 OCR 仍优先，但 OCR 也不再直接 return
    if let Err(error) = deps
        .db
        .set_document_active_job(&document_id, &job.job_id, None)
    {
        error!("library: set active job for {document_id} failed: {error}");
    }
    let job_root = deps.persist.output_root.join(&job.job_id);
    match crate::db::documents::build_fts_rows_from_job_dir(&job_root) {
        Ok(rows) => {
            if let Err(error) = deps
                .db
                .replace_document_fts(&document_id, &job.job_id, &rows)
            {
                error!("library: fts rebuild for {document_id} failed: {error}");
            }
        }
        Err(error) => {
            error!(
                "library: fts rows from {} failed: {error}",
                job_root.display()
            );
        }
    }
}
