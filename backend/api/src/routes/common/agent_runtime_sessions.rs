use crate::app::AppState;
use crate::services::agent_runtime_session_api::AgentRuntimeSessionApiDeps;

pub fn build_agent_runtime_session_route_deps(state: &AppState) -> AgentRuntimeSessionApiDeps<'_> {
    AgentRuntimeSessionApiDeps::new(state.db.as_ref())
}
