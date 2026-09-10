use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, JobSubmissionView, OcrAmbiguityResolutionRequest, OcrAmbiguityResolutionView,
    RetryStageRequest, RetryStageSubmissionView, StageActionsView,
};

use crate::routes::common::{jobs_facade, ok_json, request_base_url, JobsRouteDeps};

pub fn stage_actions_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Json<ApiResponse<StageActionsView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).stage_actions_view(&base_url, job_id)?,
    ))
}

pub async fn cancel_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps)
            .cancel_submission(&base_url, job_id, ocr_only)
            .await?,
    ))
}

pub fn rerun_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).rerun_submission(&base_url, job_id)?,
    ))
}

pub fn resume_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    rerun_job_response(deps, headers, job_id)
}

pub fn retry_stage_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    request: RetryStageRequest,
) -> Result<Json<ApiResponse<RetryStageSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).retry_stage_submission(&base_url, job_id, request)?,
    ))
}

pub fn resolve_ocr_ambiguity_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    request: OcrAmbiguityResolutionRequest,
) -> Result<Json<ApiResponse<OcrAmbiguityResolutionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).resolve_ocr_ambiguity_submission(&base_url, job_id, request)?,
    ))
}
