use crate::app::AppState;
use crate::services::job_data::api::JobDataApiDeps;

pub fn build_job_data_route_deps(state: &AppState) -> JobDataApiDeps {
    JobDataApiDeps::new(state.db.clone(), state.config.data_root.clone())
}
