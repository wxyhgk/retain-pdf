use anyhow::Result;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{
    job_stage_detail, job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind,
};

use super::super::cancel_registry::is_cancel_requested_any;
use super::super::{
    sync_runtime_state, terminate_child_process_tree,
    worker_process::{prepare_model_worker_binding, spawn_worker_process},
    JobPersistDeps,
};
use crate::config::WorkerProcessRuntimeConfig;

fn prepare_job_for_spawn(job: &mut JobRuntimeState) {
    job.status = JobStatusKind::Running;
    if job.started_at.is_none() {
        job.started_at = Some(now_iso());
    }
    if job.stage.is_none() || matches!(job.stage.as_deref(), Some("queued")) {
        job.stage = Some(job_stage_str(JobStage::Running).to_string());
        job.stage_detail = Some(job_stage_detail(JobStage::Running).to_string());
    }
    job.updated_at = now_iso();
    sync_runtime_state(job);
}

pub(super) async fn spawn_started_process(
    persist: &JobPersistDeps,
    canceled_jobs: &Arc<RwLock<HashSet<String>>>,
    worker_runtime: &WorkerProcessRuntimeConfig<'_>,
    mut job: JobRuntimeState,
    extra_cancel_job_ids: &[String],
) -> Result<(JobRuntimeState, tokio::process::Child, Vec<String>)> {
    prepare_job_for_spawn(&mut job);

    // Do not let a stale driver revive a terminal task before spawning.
    if is_cancel_requested_any(canceled_jobs, &job.job_id, extra_cancel_job_ids).await
        || !cas_persist_job_with_resources(
            persist.db.as_ref(),
            &persist.data_root,
            &persist.output_root,
            &job.snapshot(),
            &["queued", "running"],
        )?
    {
        anyhow::bail!("job is no longer eligible for worker startup");
    }

    let executor_url = std::env::var("RETAIN_MODEL_EXECUTOR_URL").ok();
    let model_binding = prepare_model_worker_binding(
        persist.db.as_ref(),
        &job,
        executor_url.as_deref(),
        worker_runtime.worker_max_runtime_secs,
    )?;
    let (mut child, runtime_secrets) =
        spawn_worker_process(worker_runtime, &job, model_binding.as_ref())?;
    job.pid = child.id();
    // 先记进程身份、再写 pid（顺序见 `Db::record_worker_identity`）：之后启动对账、取消、jobsd
    // 杀进程前都靠它核对「这个 pid 还是不是这个 worker」。读不到身份时记 None，按老行处理。
    let identity = job.pid.and_then(retainpdf_proc::process_identity);
    let persisted = persist
        .db
        .record_worker_identity(&job.job_id, identity.as_deref())
        .and_then(|()| {
            cas_persist_job_with_resources(
                persist.db.as_ref(),
                &persist.data_root,
                &persist.output_root,
                &job.snapshot(),
                &["queued", "running"],
            )
        });
    if !matches!(persisted, Ok(true)) {
        // Cancellation can win while spawn is in progress. Never overwrite
        // its terminal state, and do not abandon the newly created worker.
        terminate_child_process_tree(&mut child, worker_runtime.worker_terminate_grace_secs).await;
        persisted?;
        anyhow::bail!("job became terminal during worker startup");
    }
    info!("started job {} pid={:?}", job.job_id, job.pid);

    if is_cancel_requested_any(canceled_jobs, &job.job_id, extra_cancel_job_ids).await {
        terminate_child_process_tree(&mut child, worker_runtime.worker_terminate_grace_secs).await;
    }

    Ok((job, child, runtime_secrets))
}
