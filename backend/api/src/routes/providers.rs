use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, ProviderErrorCatalogueView, ProviderErrorCodesQuery};
use crate::ocr_provider::{provider_client_definitions, OcrProviderPublicDefinition};
use crate::routes::common::{build_provider_route_deps, ApiJson, ApiQuery};
use crate::services::providers::{
    self, DeepSeekBalanceView, DeepSeekTokenValidationRequest, MineruTokenValidationRequest,
    ProviderProbeView, PaddleTokenValidationRequest, TranslationModelAskRequest, TranslationModelAskView,
    TranslationModelListView, TranslationModelsRequest,
};
use crate::AppState;

/// 只能服务器定的选项（`client_settable: false`）不给默认值，见 `provider_client_definitions`。
pub async fn list_ocr_providers(
) -> Result<Json<ApiResponse<Vec<OcrProviderPublicDefinition>>>, AppError> {
    Ok(Json(ApiResponse::ok(provider_client_definitions())))
}

/// GET /api/v1/providers/error-codes —— 各家服务商的错误码目录（2026-11-23）。静态数据，不碰数据库。
pub async fn list_provider_error_codes(
    ApiQuery(query): ApiQuery<ProviderErrorCodesQuery>,
) -> Result<Json<ApiResponse<ProviderErrorCatalogueView>>, AppError> {
    Ok(Json(ApiResponse::ok(providers::provider_error_catalogue(&query)?)))
}

pub async fn validate_mineru_token(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<MineruTokenValidationRequest>,
) -> Result<Json<ApiResponse<ProviderProbeView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = providers::validate_mineru_token(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_paddle_token(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<PaddleTokenValidationRequest>,
) -> Result<Json<ApiResponse<ProviderProbeView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = providers::validate_paddle_token(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn validate_deepseek_token(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<ProviderProbeView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = providers::validate_deepseek_token(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn query_deepseek_balance(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<DeepSeekTokenValidationRequest>,
) -> Result<Json<ApiResponse<DeepSeekBalanceView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = providers::query_deepseek_balance(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

/// POST /api/v1/providers/translation/models —— 从翻译接口拉取模型列表（2026-11-19）。
pub async fn list_translation_models(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<TranslationModelsRequest>,
) -> Result<Json<ApiResponse<TranslationModelListView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = providers::list_translation_models(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}

/// POST /api/v1/providers/translation/ask —— 用翻译接口的配置问一次模型，可以带图片（2026-11-22）。
pub async fn ask_translation_model(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<TranslationModelAskRequest>,
) -> Result<Json<ApiResponse<TranslationModelAskView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    let view = providers::ask_translation_model(&deps, payload).await?;
    Ok(Json(ApiResponse::ok(view)))
}
