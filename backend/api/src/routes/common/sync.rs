use crate::app::AppState;
use crate::services::sync::api::SyncApiDeps;

pub fn build_sync_route_deps(state: &AppState) -> SyncApiDeps {
    SyncApiDeps::new(state.sync.clone())
}
