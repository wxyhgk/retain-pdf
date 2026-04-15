use crate::error::AppError;
use crate::models::{ApiResponse, JobStatusKind, JobSubmissionView};
use crate::routes::job_helpers::ensure_cancelable;
use crate::services::jobs::{
    cancel_job as cancel_job_service, load_job_or_404, load_ocr_job_or_404,
};
use crate::AppState;
use axum::extract::{Path as AxumPath, State};
use axum::http::HeaderMap;
use axum::Json;

use super::build_job_submission_response;

pub async fn cancel_ocr_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let job = load_ocr_job_or_404(state.db.as_ref(), &job_id)?;
    ensure_cancelable(&job)?;
    let job = cancel_job_service(&state, &job_id, true).await?;
    build_job_submission_response(&state, &headers, &job, job.status.clone())
}

pub async fn cancel_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let job = load_job_or_404(state.db.as_ref(), &job_id)?;
    ensure_cancelable(&job)?;
    let job = cancel_job_service(&state, &job_id, false).await?;
    build_job_submission_response(&state, &headers, &job, JobStatusKind::Canceled)
}
