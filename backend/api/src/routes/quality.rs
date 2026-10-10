//! 质量摘要与按块清单（质量体检卡、阅读页标注）。读的是任务目录里的报告，放到阻塞线程里做。

use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_quality_route_deps, ok_json, ApiPath, ApiQuery};
use crate::services::quality::api::{
    quality_items_view, quality_summary_view, QualityItemsParams as ItemsParams, QualityItemsView,
    QualitySummaryView,
};
use crate::AppState;

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("quality summary task failed"))?
}

/// GET /api/v1/jobs/:job_id/quality-summary
pub async fn quality_summary_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<QualitySummaryView>>, AppError> {
    let deps = build_quality_route_deps(&state);
    Ok(ok_json(blocking(move || quality_summary_view(&deps, &job_id)).await?))
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QualityItemsParams {
    pub kind: String,
    #[serde(default)]
    pub page: Option<u64>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub offset: Option<usize>,
    #[serde(default)]
    pub limit: Option<usize>,
}

/// GET /api/v1/jobs/:job_id/quality-items?kind=layout|untranslated|qa|escalated[&page][&severity][&offset][&limit]
pub async fn quality_items_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(params): ApiQuery<QualityItemsParams>,
) -> Result<Json<ApiResponse<QualityItemsView>>, AppError> {
    let deps = build_quality_route_deps(&state);
    let params = ItemsParams {
        kind: params.kind,
        page: params.page,
        severity: params.severity,
        offset: params.offset,
        limit: params.limit,
    };
    Ok(ok_json(blocking(move || quality_items_view(&deps, &job_id, params)).await?))
}
