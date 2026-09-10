use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobListView, ListJobEventsQuery, ListJobsQuery,
};

use crate::routes::common::{jobs_facade, ok_json, request_base_url, JobsRouteDeps};

pub fn list_jobs_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    query: &ListJobsQuery,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(jobs_facade(deps).list_jobs_view(&base_url, query)?))
}

pub fn job_detail_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).job_detail_view(&base_url, job_id, ocr_only)?,
    ))
}

pub fn job_events_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
    query: &ListJobEventsQuery,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps).job_events_view(job_id, query, ocr_only)?,
    ))
}

pub fn job_artifacts_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).job_artifacts_view(&base_url, job_id, ocr_only)?,
    ))
}

pub fn job_artifact_manifest_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).job_artifact_manifest_view(&base_url, job_id, ocr_only)?,
    ))
}
