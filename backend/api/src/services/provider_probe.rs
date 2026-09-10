//! Provider probe implementation boundary.
//!
//! Public HTTP handlers use `provider_api`; this module organizes the internal
//! provider clients, URL safety policy, and response classification.

mod deepseek;
mod ocr;
mod types;
mod url_policy;

pub(crate) use deepseek::{query_deepseek_balance_view, validate_deepseek_token_view};
pub(crate) use ocr::{validate_mineru_token_view, validate_paddle_token_view};
pub use types::{
    DeepSeekBalanceInfoView, DeepSeekBalanceView, DeepSeekTokenValidationRequest,
    MineruTokenValidationRequest, MineruTokenValidationView, PaddleTokenValidationRequest,
};

#[cfg(test)]
mod tests;
