//! Application facade for provider credential probes.
//!
//! HTTP routes depend on this module instead of the provider-specific probe
//! implementation. This keeps transport handlers independent from provider
//! clients, URL policy, and runtime configuration details.

use crate::config::{DeepSeekRuntimeConfig, MineruRuntimeConfig, PaddleRuntimeConfig};
use crate::error::AppError;

pub use super::provider_probe::{
    DeepSeekBalanceInfoView, DeepSeekBalanceView, DeepSeekTokenValidationRequest,
    MineruTokenValidationRequest, MineruTokenValidationView, PaddleTokenValidationRequest,
};

/// Narrow application dependency bundle assembled at the HTTP boundary.
pub struct ProviderApiDeps {
    mineru_runtime: MineruRuntimeConfig,
    paddle_runtime: PaddleRuntimeConfig,
    deepseek_runtime: DeepSeekRuntimeConfig,
}

impl ProviderApiDeps {
    pub fn new(
        mineru_runtime: MineruRuntimeConfig,
        paddle_runtime: PaddleRuntimeConfig,
        deepseek_runtime: DeepSeekRuntimeConfig,
    ) -> Self {
        Self {
            mineru_runtime,
            paddle_runtime,
            deepseek_runtime,
        }
    }
}

pub async fn validate_mineru_token(
    deps: &ProviderApiDeps,
    payload: MineruTokenValidationRequest,
) -> Result<MineruTokenValidationView, AppError> {
    super::provider_probe::validate_mineru_token_view(payload, deps.mineru_runtime.clone()).await
}

pub async fn validate_paddle_token(
    deps: &ProviderApiDeps,
    payload: PaddleTokenValidationRequest,
) -> Result<MineruTokenValidationView, AppError> {
    super::provider_probe::validate_paddle_token_view(payload, deps.paddle_runtime.clone()).await
}

pub async fn validate_deepseek_token(
    deps: &ProviderApiDeps,
    payload: DeepSeekTokenValidationRequest,
) -> Result<MineruTokenValidationView, AppError> {
    super::provider_probe::validate_deepseek_token_view(payload, deps.deepseek_runtime.clone())
        .await
}

pub async fn query_deepseek_balance(
    deps: &ProviderApiDeps,
    payload: DeepSeekTokenValidationRequest,
) -> Result<DeepSeekBalanceView, AppError> {
    super::provider_probe::query_deepseek_balance_view(payload, deps.deepseek_runtime.clone()).await
}
