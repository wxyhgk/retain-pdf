use crate::app::AppState;
use crate::services::usage::api::UsageApiDeps;

pub fn build_usage_route_deps(state: &AppState) -> UsageApiDeps {
    UsageApiDeps::new(
        state.db.clone(),
        state.config.output_root.clone(),
        state.config.data_root.clone(),
    )
}
