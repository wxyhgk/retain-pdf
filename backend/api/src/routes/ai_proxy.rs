//! HTTP adapters for the retainpdf-ai reverse proxy.

use crate::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;

use crate::error::AppError;
use crate::routes::common::ApiJson;
use crate::services::ai::api;

pub async fn ask_proxy(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiJson(payload): ApiJson<serde_json::Value>,
) -> Result<Response, AppError> {
    api::ask(&state.ai_gateway, &headers, payload).await
}

pub async fn get_runtime_config_proxy(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    api::get_runtime_config(&state.ai_gateway, &headers).await
}

pub async fn update_runtime_config_proxy(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiJson(payload): ApiJson<serde_json::Value>,
) -> Result<Response, AppError> {
    api::update_runtime_config(&state.ai_gateway, &headers, payload).await
}
