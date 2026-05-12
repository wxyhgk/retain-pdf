use anyhow::Result;
use tracing::info;

use crate::job_events::persist_runtime_job_with_resources;
use crate::models::{job_stage_detail, job_stage_str, now_iso, JobRuntimeState, JobStage, JobStatusKind};

use super::super::cancel_registry::is_cancel_requested_any;
use super::super::{
    sync_runtime_state, terminate_job_process_tree, worker_process::spawn_worker_process,
    ProcessRuntimeDeps,
};

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
    deps: &ProcessRuntimeDeps,
    mut job: JobRuntimeState,
    extra_cancel_job_ids: &[String],
) -> Result<(JobRuntimeState, tokio::process::Child)> {
    prepare_job_for_spawn(&mut job);

    let child = spawn_worker_process(deps.config.as_ref(), &job)?;
    job.pid = child.id();
    persist_runtime_job_with_resources(
        deps.db.as_ref(),
        &deps.config.data_root,
        &deps.config.output_root,
        &job,
    )?;
    info!("started job {} pid={:?}", job.job_id, job.pid);

    if is_cancel_requested_any(&deps.canceled_jobs, &job.job_id, extra_cancel_job_ids).await {
        if let Some(pid) = job.pid {
            terminate_job_process_tree(pid).await?;
        }
    }

    Ok((job, child))
}
