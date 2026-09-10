mod cleanup;
mod jobs;
mod router;
mod server;
mod state;

pub use cleanup::{
    log_startup_settings, log_startup_settings_with_interval, run_cleanup_once,
    spawn_periodic_cleanup, spawn_periodic_cleanup_with_interval, RetentionSettings,
};
pub use jobs::build_jobs_facade_from_state;
pub use router::{build_app, build_simple_app};
pub use server::{run_servers, run_servers_with_shutdown, spawn_servers, RunningServers};
pub use state::{build_state, AppState};

pub fn build_model_requests_api_from_state(
    state: &AppState,
) -> crate::services::model_requests_api::ModelRequestsApi {
    crate::services::model_requests_api::ModelRequestsApi::new(
        state.db.clone(),
        state.model_executor.clone(),
    )
}
