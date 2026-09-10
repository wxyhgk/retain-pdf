use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobListView, ListJobEventsQuery, ListJobsQuery,
};
use crate::models::domain::WorkflowKind;
use crate::AppState;

use super::super::json_response::{
    job_artifact_manifest_response, job_artifacts_response, job_detail_response,
    job_events_response, list_jobs_response,
};
use crate::routes::common::{build_jobs_route_deps, ApiPath, ApiQuery};

pub async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    list_jobs_response(build_jobs_route_deps(&state), &headers, &query)
}

pub async fn list_ocr_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiQuery(mut query): ApiQuery<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    query.workflow = Some(WorkflowKind::Ocr);
    list_jobs(State(state), headers, ApiQuery(query)).await
}

pub async fn get_ocr_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    job_detail_response(build_jobs_route_deps(&state), &headers, &job_id, true)
}

pub async fn get_ocr_job_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    job_events_response(build_jobs_route_deps(&state), &job_id, &query, true)
}

pub async fn get_ocr_job_artifacts(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    job_artifacts_response(build_jobs_route_deps(&state), &headers, &job_id, true)
}

pub async fn get_ocr_job_artifacts_manifest(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    job_artifact_manifest_response(build_jobs_route_deps(&state), &headers, &job_id, true)
}

pub async fn get_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    job_detail_response(build_jobs_route_deps(&state), &headers, &job_id, false)
}

pub async fn get_job_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    job_events_response(build_jobs_route_deps(&state), &job_id, &query, false)
}

pub async fn get_job_artifacts(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    job_artifacts_response(build_jobs_route_deps(&state), &headers, &job_id, false)
}

pub async fn get_job_artifacts_manifest(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    job_artifact_manifest_response(build_jobs_route_deps(&state), &headers, &job_id, false)
}
