use std::sync::Arc;

use anyhow::Result;

use crate::config::AppConfig;
use crate::db::Db;
use crate::job_runner::{
    reconcile_stale_running_jobs, requeue_stuck_queued_jobs, spawn_job, ProcessRuntimeDeps,
};
use crate::services::job_launcher::JobLaunchDeps;
use crate::services::jobs::{
    build_jobs_facade, CommandJobsDeps, ControlDeps, JobSubmitDeps, JobsFacade, QueryJobsDeps,
    ReplayDeps, SnapshotBuildDeps,
};
use crate::services::runtime_gateway::JobRuntimeLauncher;

use super::state::AppState;

pub(super) fn reconcile_owned_runtime(config: &AppConfig, db: &Db) -> Result<usize> {
    if config.jobs_service.is_remote() {
        // Remote jobs are owned by retain-jobsd. A shell restart must not
        // reinterpret jobsd-owned workers as orphaned processes.
        return Ok(0);
    }
    reconcile_stale_running_jobs(config, db)
}

pub(super) fn resume_requeued_pipeline_jobs(state: &AppState) -> Result<usize> {
    if state.config.jobs_service.is_remote() {
        return Ok(0);
    }
    let job_ids = state.db.list_resumable_pipeline_job_ids()?;
    for job_id in &job_ids {
        spawn_job(build_process_runtime_deps(state), job_id.clone());
    }
    let stuck = requeue_stuck_queued_jobs(&state.config, &state.db)?;
    for job_id in &stuck {
        spawn_job(build_process_runtime_deps(state), job_id.clone());
    }
    Ok(job_ids.len() + stuck.len())
}

fn build_process_runtime_deps(state: &AppState) -> ProcessRuntimeDeps {
    ProcessRuntimeDeps::new(
        state.config.clone(),
        state.db.clone(),
        state.canceled_jobs.clone(),
        state.job_slots.clone(),
        state.job_drivers.clone(),
    )
}

pub fn build_jobs_facade_from_state(state: &AppState) -> JobsFacade<'_> {
    // ADR-002：发射落点二选一。进程内是历史行为；远端把任务交给 jobsd，
    // 于是壳重启不再牵连正在跑的 worker。
    let runtime_launcher = if state.config.jobs_service.is_remote() {
        let job_runtime = state.job_runtime.clone();
        JobRuntimeLauncher::new(Arc::new(move |job_id| {
            let job_runtime = job_runtime.clone();
            tokio::spawn(async move { job_runtime.launch_remote(job_id).await });
        }))
    } else {
        let runtime_state = state.clone();
        JobRuntimeLauncher::new(Arc::new(move |job_id| {
            spawn_job(build_process_runtime_deps(&runtime_state), job_id)
        }))
    };
    let launcher = JobLaunchDeps::new(
        state.db.as_ref(),
        &state.config.data_root,
        &state.config.output_root,
        runtime_launcher,
    );
    let snapshot = SnapshotBuildDeps::new(state.db.as_ref(), state.config.job_snapshot_runtime());
    let submit = JobSubmitDeps::new(snapshot, state.uploads.as_ref(), launcher);
    let control = ControlDeps::new(
        state.db.as_ref(),
        &state.config.job_runner,
        &state.config.data_root,
        &state.config.output_root,
        state.job_runtime.as_ref(),
    );
    let replay = ReplayDeps::new(
        &state.config.project_root,
        &state.config.scripts_dir,
        &state.config.python_bin,
        &state.config.pipeline_command,
        &state.config.data_root,
    );
    build_jobs_facade(
        CommandJobsDeps::new(state.db.as_ref(), submit, control),
        QueryJobsDeps::new(
            state.db.as_ref(),
            &state.config.data_root,
            &state.config.downloads_dir,
            &state.download_generation,
            replay,
        ),
    )
}
