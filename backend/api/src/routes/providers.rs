use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::ocr_provider::{provider_public_definitions, OcrProviderPublicDefinition};
use crate::routes::common::{build_provider_route_deps, ApiJson};
use crate::services::provider_api::{
    self, DeepSeekBalanceView, DeepSeekTokenValidationRequest, MineruTokenValidationRequest,
    MineruTokenValidationView, PaddleTokenValidationRequest,
};
use crate::AppState;

pub async fn list_ocr_providers(
) -> Result<Json<ApiResponse<Vec<OcrProviderPublicDefinition>>>, AppError> {
    Ok(Json(ApiResponse::ok(provider_public_definitions())))
}

pub async fn validate_mineru_token(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<MineruTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = provider_api::validate_mineru_token(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_paddle_token(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<PaddleTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = provider_api::validate_paddle_token(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_deepseek_token(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = provider_api::validate_deepseek_token(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn query_deepseek_balance(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<DeepSeekBalanceView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = provider_api::query_deepseek_balance(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}
