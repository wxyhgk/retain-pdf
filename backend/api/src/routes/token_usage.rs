//! 模型用量（token）：一个任务、一本书、全部。读的都是磁盘上的台账，放到阻塞线程里做。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_usage_route_deps, ok_json, ApiPath};
use crate::services::usage::api::{all_usage_view, document_usage_view, job_usage_view, UsageSummaryView};
use crate::AppState;

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("usage summary task failed"))?
}

/// GET /api/v1/jobs/:job_id/usage
pub async fn job_usage_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    Ok(ok_json(blocking(move || job_usage_view(&deps, &job_id)).await?))
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
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    Ok(ok_json(blocking(move || Ok(all_usage_view(&deps))).await?))
}
