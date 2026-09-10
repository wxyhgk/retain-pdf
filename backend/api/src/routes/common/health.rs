use crate::app::AppState;
use crate::services::health_api::HealthApiDeps;

pub fn build_health_route_deps(state: &AppState) -> HealthApiDeps<'_> {
    HealthApiDeps::new(
        state.db.as_ref(),
        state.config.ai_service.supervise,
        state.config.jobs_service.is_remote() && state.config.jobs_service.supervise,
    )
}
