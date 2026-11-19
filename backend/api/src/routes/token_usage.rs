//! 模型用量（token）：一本书、全部；查单价、估价（2026-11-19 起）。一个任务的用量在 jobs::reports。读的都是磁盘上的台账，放到阻塞线程里做。

use axum::extract::State;
use axum::Json;

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_usage_route_deps, ok_json, ApiJson, ApiPath, ApiQuery};
use crate::services::jobs::{
    all_usage_view, document_usage_estimate_view, document_usage_view, library_usage_estimate_view,
    price_lookup_view, DocumentUsageEstimateQuery, LibraryUsageEstimateQuery, PriceLookupInput, PriceLookupView,
    UsageEstimateView, UsageSummaryView,
};
use crate::AppState;

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("usage summary task failed"))?
}

/// GET /api/v1/documents/:document_id/usage —— 这本书的全部任务，加上问这本书时助手花的。
pub async fn document_usage_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    Ok(ok_json(blocking(move || document_usage_view(&deps, &document_id)).await?))
}

/// GET /api/v1/usage —— 现存的全部任务加上助手。删掉的书不再计入。
pub async fn all_usage_route(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(blocking(move || all_usage_view(&deps, owner.as_deref())).await?))
}

/// POST /api/v1/usage/prices —— 按（接口地址，模型）批量查每百万 token 的单价（2026-11-19 起）。
pub async fn price_lookup_route(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<PriceLookupInput>,
) -> Result<Json<ApiResponse<PriceLookupView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    Ok(ok_json(blocking(move || price_lookup_view(&deps, &input)).await?))
}

/// GET /api/v1/documents/:document_id/usage/estimate —— 这本书换个模型重新翻译大概多少钱。
pub async fn document_usage_estimate_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<DocumentUsageEstimateQuery>,
) -> Result<Json<ApiResponse<UsageEstimateView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    Ok(ok_json(blocking(move || document_usage_estimate_view(&deps, &document_id, &query)).await?))
}

/// GET /api/v1/usage/estimate —— 还没有的书：书库每页平均乘页数。
pub async fn library_usage_estimate_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiQuery(query): ApiQuery<LibraryUsageEstimateQuery>,
) -> Result<Json<ApiResponse<UsageEstimateView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(blocking(move || library_usage_estimate_view(&deps, owner.as_deref(), &query)).await?))
}
