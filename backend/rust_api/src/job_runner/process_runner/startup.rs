use anyhow::Result;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::job_events::persist_runtime_job_with_resources;
use crate::models::{
    job_stage_detail, job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind,
};

use super::super::cancel_registry::is_cancel_requested_any;
use super::super::{
    sync_runtime_state, terminate_job_process_tree, worker_process::spawn_worker_process,
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
) -> Result<(JobRuntimeState, tokio::process::Child)> {
    prepare_job_for_spawn(&mut job);

    let child = spawn_worker_process(worker_runtime, &job)?;
    job.pid = child.id();
    persist_runtime_job_with_resources(
        persist.db.as_ref(),
        &persist.data_root,
        &persist.output_root,
        &job,
    )?;
    info!("started job {} pid={:?}", job.job_id, job.pid);

    if is_cancel_requested_any(canceled_jobs, &job.job_id, extra_cancel_job_ids).await {
        if let Some(pid) = job.pid {
            terminate_job_process_tree(
                pid,
                worker_runtime.worker_terminate_grace_secs,
                worker_runtime.worker_terminate_poll_ms,
            )
            .await?;
        }
    }

    Ok((job, child))
}
