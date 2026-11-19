use crate::app::AppState;
use crate::services::providers::ProviderApiDeps;

pub fn build_provider_route_deps(state: &AppState) -> ProviderApiDeps {
    ProviderApiDeps::from_runtime(&state.config.provider_runtime, state.config.accounts.mode)
        .with_data_root(state.config.data_root.clone())
}
