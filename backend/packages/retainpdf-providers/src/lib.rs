//! 服务商：凭据库（`credentials`）、模型调用（`model_executor`、`model_requests_api`）、
//! 服务商连通性和额度探测（`provider_probe`、`provider_api`）、模型价格（`pricing`，用量汇总估算花费）。

mod credentials;
mod model_executor;
mod model_provider_headers;
mod model_requests_api;
mod pricing;
mod provider_api;
mod provider_probe;

// 门面：领域外只能用这里导出的东西，子模块都是私有的（见 BOUNDARIES.md「Domain Facades」）。
pub use credentials::{
    acquire_credential_usage_lock, delete_unreferenced_managed_credential,
    get_or_create_managed_credential, CredentialUsageLock,
};
pub use credentials::api::{
    create_credential, delete_credential, get_credential_metadata, list_credentials,
    update_credential, CreateCredentialInput, CredentialDeleteView, CredentialListView,
    CredentialMutationView, DeleteCredentialQuery, ListCredentialQuery, UpdateCredentialInput,
};
pub use model_executor::{ModelConnectionPolicy, ModelExecutor};
pub use model_requests_api::{ModelConnection, ModelRequest, ModelRequestsApi};
pub use pricing::{
    peak_multiplier, price_sync_url, spawn_daily_price_sync, sync_price_book, CostEstimate, CNY_PER_USD, Price, PriceTierView, PriceView, PriceBasis, PriceBook, PriceSyncOutcome, TokenCounts,
};
pub use provider_api::{
    list_translation_models, query_deepseek_balance, validate_deepseek_token, validate_mineru_token, validate_paddle_token,
    DeepSeekBalanceView, DeepSeekTokenValidationRequest, MineruTokenValidationRequest,
    ProviderProbeView, TranslationModelListView, TranslationModelView, TranslationModelsRequest, PaddleTokenValidationRequest, ProviderApiDeps,
};
pub use provider_probe::{
    validate_deepseek_token_view, validate_mineru_token_view, validate_paddle_token_view,
    validate_provider_base_url, PrivateTargets, ProbePolicy,
};
