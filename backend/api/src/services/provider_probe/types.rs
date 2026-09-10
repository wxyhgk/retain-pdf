use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct MineruTokenValidationRequest {
    pub mineru_token: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model_version: String,
}

#[derive(Debug, Serialize)]
pub struct MineruTokenValidationView {
    pub ok: bool,
    pub status: &'static str,
    pub summary: String,
    pub retryable: bool,
    pub provider_code: Option<String>,
    pub provider_message: Option<String>,
    pub operator_hint: Option<String>,
    pub trace_id: Option<String>,
    pub base_url: String,
    pub checked_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PaddleTokenValidationRequest {
    pub paddle_token: String,
    #[serde(default)]
    pub base_url: String,
}

#[derive(Debug, Deserialize)]
pub struct DeepSeekTokenValidationRequest {
    pub api_key: String,
    #[serde(default)]
    pub base_url: String,
}

#[derive(Debug, Serialize)]
pub struct DeepSeekBalanceInfoView {
    pub currency: String,
    pub total_balance: String,
    pub granted_balance: String,
    pub topped_up_balance: String,
}

#[derive(Debug, Serialize)]
pub struct DeepSeekBalanceView {
    pub ok: bool,
    pub status: &'static str,
    pub summary: String,
    pub retryable: bool,
    pub is_available: bool,
    pub balance_infos: Vec<DeepSeekBalanceInfoView>,
    pub provider_code: Option<String>,
    pub provider_message: Option<String>,
    pub trace_id: Option<String>,
    pub base_url: String,
    pub checked_at: String,
}
