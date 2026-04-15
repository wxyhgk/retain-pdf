use crate::error::AppError;
use crate::models::{
    ApiResponse, ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobListView, ListJobEventsQuery, ListJobsQuery,
};
use crate::routes::job_helpers::request_base_url;
use crate::services::jobs::{
    build_job_artifact_manifest_view, build_job_events_view, build_job_list_view, load_job_or_404,
    load_ocr_job_with_supported_layout, load_supported_job,
};
use crate::AppState;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::HeaderMap;
use axum::Json;

use super::{build_job_artifacts_response, build_job_detail_response};

pub async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_job_list_view(
        state.db.as_ref(),
        &state.config.data_root,
        &query,
        &base_url,
    )?)))
}

pub async fn list_ocr_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(mut query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    query.workflow = Some(crate::models::WorkflowKind::Ocr);
    list_jobs(State(state), headers, Query(query)).await
}

pub async fn get_ocr_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    build_job_detail_response(&state, &headers, &job)
}

pub async fn get_ocr_job_events(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    let _job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    Ok(Json(ApiResponse::ok(build_job_events_view(
        state.db.as_ref(),
        &job_id,
        &query,
    )?)))
}

pub async fn get_ocr_job_artifacts(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    build_job_artifacts_response(&state, &headers, &job)
}

pub async fn get_ocr_job_artifacts_manifest(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    let job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_job_artifact_manifest_view(
        state.db.as_ref(),
        &state.config.data_root,
        &job,
        &base_url,
    )?)))
}

pub async fn get_job(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    build_job_detail_response(&state, &headers, &job)
}

pub async fn get_job_events(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    let _job = load_job_or_404(state.db.as_ref(), &job_id)?;
    Ok(Json(ApiResponse::ok(build_job_events_view(
        state.db.as_ref(),
        &job_id,
        &query,
    )?)))
}

pub async fn get_job_artifacts(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    build_job_artifacts_response(&state, &headers, &job)
}

pub async fn get_job_artifacts_manifest(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_job_artifact_manifest_view(
        state.db.as_ref(),
        &state.config.data_root,
        &job,
        &base_url,
    )?)))
}
