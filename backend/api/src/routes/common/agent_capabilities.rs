use crate::app::AppState;
use crate::db::Db;
use crate::services::agent_capabilities::AgentCapabilityAuthority;

pub struct AgentCapabilityRouteDeps<'a> {
    pub db: &'a Db,
    pub authority: &'a AgentCapabilityAuthority,
}

pub fn build_agent_capability_route_deps(state: &AppState) -> AgentCapabilityRouteDeps<'_> {
    AgentCapabilityRouteDeps {
        db: state.db.as_ref(),
        authority: state.agent_capabilities.as_ref(),
    }
}
