use crate::error::AppError;
use crate::models::{ArtifactDownloadQuery, MarkdownQuery, PagePreviewQuery};
use crate::storage_paths::{
    resolve_normalization_report, resolve_normalized_document, resolve_output_pdf,
};
use crate::AppState;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;

use super::common::build_jobs_route_deps;
use super::download_adapter::{
    bundle_response, cover_response, download_document_response, markdown_image_response,
    markdown_response, page_preview_response, registered_artifact_response, thumbnail_response,
};

pub async fn download_pdf(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        false,
        resolve_output_pdf,
        "pdf not ready",
        "application/pdf",
    )
    .await
}

pub async fn download_cover(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    cover_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_thumbnail(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    thumbnail_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_page_preview(
    State(state): State<AppState>,
    AxumPath((job_id, page)): AxumPath<(String, u32)>,
    headers: HeaderMap,
    Query(query): Query<PagePreviewQuery>,
) -> Result<Response, AppError> {
    page_preview_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        page,
        &query,
    )
    .await
}

pub async fn download_artifact_by_key(
    State(state): State<AppState>,
    AxumPath((job_id, artifact_key)): AxumPath<(String, String)>,
    headers: HeaderMap,
    Query(query): Query<ArtifactDownloadQuery>,
) -> Result<Response, AppError> {
    registered_artifact_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        &artifact_key,
        query.include_job_dir,
        false,
    )
    .await
}

pub async fn download_ocr_artifact_by_key(
    State(state): State<AppState>,
    AxumPath((job_id, artifact_key)): AxumPath<(String, String)>,
    headers: HeaderMap,
    Query(query): Query<ArtifactDownloadQuery>,
) -> Result<Response, AppError> {
    registered_artifact_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        &artifact_key,
        query.include_job_dir,
        true,
    )
    .await
}

pub async fn download_normalized_document(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        false,
        resolve_normalized_document,
        "normalized document not ready",
        "application/json",
    )
    .await
}

pub async fn download_ocr_normalized_document(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        true,
        resolve_normalized_document,
        "normalized document not ready",
        "application/json",
    )
    .await
}

pub async fn download_normalization_report(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        false,
        resolve_normalization_report,
        "normalization report not ready",
        "application/json",
    )
    .await
}

pub async fn download_ocr_normalization_report(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        true,
        resolve_normalization_report,
        "normalization report not ready",
        "application/json",
    )
    .await
}

pub async fn download_markdown(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
    Query(query): Query<MarkdownQuery>,
) -> Result<Response, AppError> {
    markdown_response(&build_jobs_route_deps(&state), &headers, job_id, &query).await
}

pub async fn download_markdown_image(
    State(state): State<AppState>,
    AxumPath((job_id, path)): AxumPath<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    markdown_image_response(&build_jobs_route_deps(&state), &headers, &job_id, &path).await
}

pub async fn download_bundle(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    bundle_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}
