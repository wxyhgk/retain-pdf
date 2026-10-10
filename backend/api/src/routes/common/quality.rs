use crate::app::AppState;
use crate::services::quality::api::QualityApiDeps;

pub fn build_quality_route_deps(state: &AppState) -> QualityApiDeps {
    QualityApiDeps::new(state.db.clone(), state.config.data_root.clone())
}
