use crate::app::AppState;
use crate::services::agent_calculations::api::AgentCalculationApiDeps;

pub fn build_agent_calculation_route_deps(state: &AppState) -> AgentCalculationApiDeps<'_> {
    AgentCalculationApiDeps::new(state.db.as_ref(), &state.config.data_root)
}
