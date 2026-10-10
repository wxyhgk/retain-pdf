//! 通用取数：GET /jobs/:id/data（有哪些数据集）、GET /jobs/:id/data/:dataset（按名字取）。
//! 登记表在契约 job-data.v1 里；这里不为单个需求写代码。

use std::collections::HashMap;

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_job_data_route_deps, ok_json, ApiPath, ApiQuery};
use crate::services::job_data::api::{job_data_catalog_view, job_data_view, JobDataCatalogView, JobDataView};
use crate::AppState;

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("job data task failed"))?
}

/// GET /api/v1/jobs/:job_id/data
pub async fn job_data_catalog_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobDataCatalogView>>, AppError> {
    let deps = build_job_data_route_deps(&state);
    Ok(ok_json(blocking(move || job_data_catalog_view(&deps, &job_id)).await?))
}

/// GET /api/v1/jobs/:job_id/data/:dataset?fields=&<字段>=&group_by=&sort=&offset=&limit=
pub async fn job_data_route(
    State(state): State<AppState>,
    ApiPath((job_id, dataset)): ApiPath<(String, String)>,
    ApiQuery(params): ApiQuery<HashMap<String, String>>,
) -> Result<Json<ApiResponse<JobDataView>>, AppError> {
    let deps = build_job_data_route_deps(&state);
    Ok(ok_json(blocking(move || job_data_view(&deps, &job_id, &dataset, &params)).await?))
}
