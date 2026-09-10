use std::num::NonZeroU64;

use retain_core::config::effective_upload_max_bytes;

use crate::app::{build_jobs_facade_from_state, AppState};
use crate::services::jobs::JobsFacade;

pub struct JobsRouteDeps<'a> {
    pub jobs: JobsFacade<'a>,
    pub default_port: u16,
    pub bind_host: String,
    pub upload_max_bytes: NonZeroU64,
}

pub fn build_jobs_route_deps(state: &AppState) -> JobsRouteDeps<'_> {
    JobsRouteDeps {
        jobs: build_jobs_facade_from_state(state),
        default_port: state.config.port,
        bind_host: state.config.bind_host.clone(),
        upload_max_bytes: effective_upload_max_bytes(state.config.upload_max_bytes),
    }
}

pub fn jobs_facade(deps: JobsRouteDeps<'_>) -> JobsFacade<'_> {
    deps.jobs
}
