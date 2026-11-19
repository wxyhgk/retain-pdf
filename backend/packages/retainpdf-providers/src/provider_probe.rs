//! Provider probe implementation boundary.
//!
//! Public HTTP handlers use `provider_api`; this module organizes the internal
//! provider clients, URL safety policy, and response classification.

mod deepseek;
mod models;
mod ocr;
mod policy;
mod types;
mod url_policy;

pub(crate) use deepseek::query_deepseek_balance_view;
pub use deepseek::validate_deepseek_token_view;
pub use models::{list_translation_models_view, TranslationModelListView, TranslationModelView, TranslationModelsRequest};
pub use ocr::{validate_mineru_token_view, validate_paddle_token_view};
pub use policy::{PrivateTargets, ProbePolicy};
pub use url_policy::validate_provider_base_url;
pub use types::{
    DeepSeekBalanceView, DeepSeekTokenValidationRequest, MineruTokenValidationRequest,
    PaddleTokenValidationRequest, ProviderProbeView,
};

#[cfg(test)]
mod tests;
