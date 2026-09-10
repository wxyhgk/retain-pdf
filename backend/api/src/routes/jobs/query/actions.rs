use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, JobSubmissionView, OcrAmbiguityResolutionRequest, OcrAmbiguityResolutionView,
    RetryStageRequest, RetryStageSubmissionView, StageActionsView,
};
use crate::AppState;

use super::super::json_response::{
    rerun_job_response, resolve_ocr_ambiguity_response, resume_job_response, retry_stage_response,
    stage_actions_response,
};
use crate::routes::common::{build_jobs_route_deps, ApiJson, ApiPath};

pub async fn get_stage_actions(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<StageActionsView>>, AppError> {
    stage_actions_response(build_jobs_route_deps(&state), &headers, &job_id)
}

pub async fn resume_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    resume_job_response(build_jobs_route_deps(&state), &headers, &job_id)
}

pub async fn rerun_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    rerun_job_response(build_jobs_route_deps(&state), &headers, &job_id)
}

pub async fn retry_stage(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
    ApiJson(request): ApiJson<RetryStageRequest>,
) -> Result<Json<ApiResponse<RetryStageSubmissionView>>, AppError> {
    retry_stage_response(build_jobs_route_deps(&state), &headers, &job_id, request)
}

pub async fn resolve_ocr_ambiguity(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
    ApiJson(request): ApiJson<OcrAmbiguityResolutionRequest>,
) -> Result<Json<ApiResponse<OcrAmbiguityResolutionView>>, AppError> {
    resolve_ocr_ambiguity_response(build_jobs_route_deps(&state), &headers, &job_id, request)
}
