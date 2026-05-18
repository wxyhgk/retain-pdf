use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::ApiResponse;
use crate::routes::common::build_provider_route_deps;
use crate::services::provider_probe::{
    query_deepseek_balance_view, validate_deepseek_token_view, validate_mineru_token_view,
    validate_paddle_token_view, DeepSeekBalanceView, DeepSeekTokenValidationRequest,
    MineruTokenValidationRequest, MineruTokenValidationView, PaddleTokenValidationRequest,
};
use crate::AppState;

pub async fn validate_mineru_token(
    State(state): State<AppState>,
    Json(payload): Json<MineruTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = validate_mineru_token_view(payload, deps.mineru_runtime).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_paddle_token(
    State(state): State<AppState>,
    Json(payload): Json<PaddleTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = validate_paddle_token_view(payload, deps.paddle_runtime).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_deepseek_token(
    State(state): State<AppState>,
    Json(payload): Json<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = validate_deepseek_token_view(payload, deps.deepseek_runtime).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn query_deepseek_balance(
    State(state): State<AppState>,
    Json(payload): Json<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<DeepSeekBalanceView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = query_deepseek_balance_view(payload, deps.deepseek_runtime).await?;
    Ok(Json(ApiResponse::ok(view)))
}
