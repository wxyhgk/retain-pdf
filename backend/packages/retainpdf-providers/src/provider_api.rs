//! Application facade for provider credential probes.
//!
//! HTTP routes depend on this module instead of the provider-specific probe
//! implementation. This keeps transport handlers independent from provider
//! clients, URL policy, and runtime configuration details.

use retainpdf_core::config::{
    DeepSeekRuntimeConfig, DeploymentMode, MineruRuntimeConfig, PaddleRuntimeConfig,
    ProviderRuntimeConfig,
};
use retainpdf_api_base::error::AppError;

pub use super::provider_probe::{
    AskImage, AskUsageView, TranslationModelAskRequest, TranslationModelAskView, DeepSeekBalanceView, DeepSeekTokenValidationRequest, MineruTokenValidationRequest,
    PaddleTokenValidationRequest, ProviderProbeView, TranslationModelListView, TranslationModelView,
    TranslationModelsRequest,
};
use super::provider_probe::{PrivateTargets, ProbePolicy};

/// Narrow application dependency bundle assembled at the HTTP boundary.
pub struct ProviderApiDeps {
    mineru_runtime: MineruRuntimeConfig,
    paddle_runtime: PaddleRuntimeConfig,
    deepseek_runtime: DeepSeekRuntimeConfig,
    probe: ProbePolicy,
    /// 读价格表用（拉取模型时顺带给单价）；没给就不带价。
    data_root: Option<std::path::PathBuf>,
}

impl ProviderApiDeps {
    /// 单机放开回环和私网（用户自己的机器），多用户照旧拦；`RUST_API_ALLOW_PRIVATE_PROVIDER_URLS=1` 全放开。
    pub fn from_runtime(runtime: &ProviderRuntimeConfig, mode: DeploymentMode) -> Self {
        let allow_private_env = runtime.mineru.allow_private_urls
            || runtime.paddle.allow_private_urls
            || runtime.deepseek.allow_private_urls;
        Self {
            mineru_runtime: runtime.mineru.clone(),
            paddle_runtime: runtime.paddle.clone(),
            deepseek_runtime: runtime.deepseek.clone(),
            probe: ProbePolicy::new(
                runtime.probe_timeout_secs,
                PrivateTargets::for_deployment(mode, allow_private_env),
            ),
            data_root: None,
        }
    }

    pub fn with_data_root(mut self, data_root: std::path::PathBuf) -> Self {
        self.data_root = Some(data_root);
        self
    }
}

/// 翻译接口的「从服务商拉取模型」（2026-11-19）：代一次 `GET {base_url}/models`，Key 用完不存。
pub async fn list_translation_models(
    deps: &ProviderApiDeps,
    payload: TranslationModelsRequest,
) -> Result<TranslationModelListView, AppError> {
    super::provider_probe::list_translation_models_view(
        payload,
        deps.deepseek_runtime.clone(),
        deps.probe,
        deps.data_root.as_deref(),
    )
    .await
}

/// 用翻译接口的配置问一次模型，可以带图片（2026-11-22）：代发一次对话请求，Key 用完不存。
pub async fn ask_translation_model(
    deps: &ProviderApiDeps,
    payload: TranslationModelAskRequest,
) -> Result<TranslationModelAskView, AppError> {
    super::provider_probe::ask_translation_model_view(payload, deps.deepseek_runtime.clone(), deps.probe).await
}

pub async fn validate_mineru_token(
    deps: &ProviderApiDeps,
    payload: MineruTokenValidationRequest,
) -> Result<ProviderProbeView, AppError> {
    super::provider_probe::validate_mineru_token_view(payload, deps.mineru_runtime.clone(), deps.probe)
        .await
}

pub async fn validate_paddle_token(
    deps: &ProviderApiDeps,
    payload: PaddleTokenValidationRequest,
) -> Result<ProviderProbeView, AppError> {
    super::provider_probe::validate_paddle_token_view(payload, deps.paddle_runtime.clone(), deps.probe)
        .await
}

pub async fn validate_deepseek_token(
    deps: &ProviderApiDeps,
    payload: DeepSeekTokenValidationRequest,
) -> Result<ProviderProbeView, AppError> {
    super::provider_probe::validate_deepseek_token_view(
        payload,
        deps.deepseek_runtime.clone(),
        deps.probe,
    )
    .await
}

pub async fn query_deepseek_balance(
    deps: &ProviderApiDeps,
    payload: DeepSeekTokenValidationRequest,
) -> Result<DeepSeekBalanceView, AppError> {
    super::provider_probe::query_deepseek_balance_view(
        payload,
        deps.deepseek_runtime.clone(),
        deps.probe,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime(allow_private: bool) -> ProviderRuntimeConfig {
        let mut runtime = ProviderRuntimeConfig::from_env();
        runtime.mineru.allow_private_urls = allow_private;
        runtime.paddle.allow_private_urls = allow_private;
        runtime.deepseek.allow_private_urls = allow_private;
        runtime.probe_timeout_secs = 7;
        runtime
    }

    /// 单机放开本机和内网，多用户照旧拦；运维设了环境变量就全放开。超时用共用的那个。
    #[test]
    fn deps_pick_private_targets_by_deployment_mode() {
        let single = ProviderApiDeps::from_runtime(&runtime(false), DeploymentMode::Single);
        assert_eq!(single.probe.private_targets, PrivateTargets::AllowLocal);
        assert_eq!(single.probe.timeout, std::time::Duration::from_secs(7));
        let multi = ProviderApiDeps::from_runtime(&runtime(false), DeploymentMode::Multi);
        assert_eq!(multi.probe.private_targets, PrivateTargets::Block);
        let escape = ProviderApiDeps::from_runtime(&runtime(true), DeploymentMode::Multi);
        assert_eq!(escape.probe.private_targets, PrivateTargets::AllowAll);
    }
}
