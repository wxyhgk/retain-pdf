use crate::app::AppState;
use crate::services::provider_api::ProviderApiDeps;

pub fn build_provider_route_deps(state: &AppState) -> ProviderApiDeps {
    ProviderApiDeps::new(
        state.config.provider_runtime.mineru.clone(),
        state.config.provider_runtime.paddle.clone(),
        state.config.provider_runtime.deepseek.clone(),
    )
}
