use crate::error::AppError;
use crate::models::api::{ApiResponse, JobSubmissionView};
use crate::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use super::json_response::cancel_job_response;
use crate::routes::common::{build_jobs_route_deps, ApiPath};

pub async fn cancel_ocr_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    cancel_job_response(build_jobs_route_deps(&state), &headers, &job_id, true).await
}

pub async fn cancel_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    cancel_job_response(build_jobs_route_deps(&state), &headers, &job_id, false).await
}
