use crate::app::AppState;
use crate::services::platform::HealthApiDeps;

pub fn build_health_route_deps(state: &AppState) -> HealthApiDeps<'_> {
    HealthApiDeps::new(
        state.db.as_ref(),
        state.config.jobs_service.is_remote() && state.config.jobs_service.supervise,
        crate::runtime::jobsd_supervisor::jobsd_status(),
    )
    .with_disk(&state.config.data_root, state.config.min_free_disk_bytes)
}
