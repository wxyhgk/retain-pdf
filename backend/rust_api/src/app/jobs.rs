use std::sync::Arc;

use crate::job_runner::{spawn_job, ProcessRuntimeDeps};
use crate::services::job_launcher::JobLaunchDeps;
use crate::services::jobs::{
    build_jobs_facade, CommandJobsDeps, ControlDeps, JobSubmitDeps, JobsFacade, QueryJobsDeps,
    ReplayDeps, SnapshotBuildDeps, UploadStoreDeps,
};
use crate::services::runtime_gateway::JobRuntimeLauncher;

use super::state::AppState;

fn build_process_runtime_deps(state: &AppState) -> ProcessRuntimeDeps {
    ProcessRuntimeDeps::new(
        state.config.clone(),
        state.db.clone(),
        state.canceled_jobs.clone(),
        state.job_slots.clone(),
    )
}

pub fn build_jobs_facade_from_state(state: &AppState) -> JobsFacade<'_> {
    let runtime_state = state.clone();
    let launcher = JobLaunchDeps::new(
        state.db.as_ref(),
        &state.config.data_root,
        &state.config.output_root,
        JobRuntimeLauncher::new(Arc::new(move |job_id| {
            spawn_job(build_process_runtime_deps(&runtime_state), job_id)
        })),
    );
    let snapshot = SnapshotBuildDeps::new(state.db.as_ref(), state.config.as_ref());
    let uploads = UploadStoreDeps::new(
        state.db.as_ref(),
        &state.config.uploads_dir,
        state.config.upload_max_bytes,
        state.config.upload_max_pages,
        &state.config.python_bin,
    );
    let submit = JobSubmitDeps::new(snapshot, uploads, launcher);
    let control = ControlDeps::new(
        state.db.as_ref(),
        &state.config.data_root,
        &state.config.output_root,
        &state.canceled_jobs,
    );
    let replay = ReplayDeps::new(state.config.as_ref(), &state.config.data_root);
    build_jobs_facade(
        CommandJobsDeps::new(state.db.as_ref(), submit, &state.downloads_lock, control),
        QueryJobsDeps::new(
            state.db.as_ref(),
            state.config.as_ref(),
            &state.downloads_lock,
            replay,
        ),
    )
}
