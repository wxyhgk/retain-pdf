use crate::error::AppError;
use crate::models::api::{ArtifactDownloadQuery, MarkdownQuery, PagePreviewQuery};
use crate::services::jobs::DocumentDownloadKind;
use crate::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;

use crate::routes::common::{build_jobs_route_deps, ApiPath, ApiQuery};
use crate::routes::download_response::{
    bundle_response, cover_response, download_document_response, markdown_document_response,
    markdown_image_response, markdown_response, page_preview_response,
    registered_artifact_response, side_by_side_pdf_response, thumbnail_response,
};

pub async fn download_pdf(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        false,
        DocumentDownloadKind::OutputPdf,
    )
    .await
}

pub async fn download_side_by_side_pdf(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    side_by_side_pdf_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_cover(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    cover_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_thumbnail(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    thumbnail_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_page_preview(
    State(state): State<AppState>,
    ApiPath((job_id, page)): ApiPath<(String, u32)>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<PagePreviewQuery>,
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
    ApiPath((job_id, artifact_key)): ApiPath<(String, String)>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<ArtifactDownloadQuery>,
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
    ApiPath((job_id, artifact_key)): ApiPath<(String, String)>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<ArtifactDownloadQuery>,
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
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        false,
        DocumentDownloadKind::NormalizedDocument,
    )
    .await
}

pub async fn download_ocr_normalized_document(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        true,
        DocumentDownloadKind::NormalizedDocument,
    )
    .await
}

pub async fn download_normalization_report(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        false,
        DocumentDownloadKind::NormalizationReport,
    )
    .await
}

pub async fn download_ocr_normalization_report(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    download_document_response(
        &build_jobs_route_deps(&state),
        &headers,
        &job_id,
        true,
        DocumentDownloadKind::NormalizationReport,
    )
    .await
}

pub async fn download_markdown(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<MarkdownQuery>,
) -> Result<Response, AppError> {
    markdown_response(&build_jobs_route_deps(&state), &headers, job_id, &query).await
}

pub async fn get_markdown_document(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    markdown_document_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_markdown_image(
    State(state): State<AppState>,
    ApiPath((job_id, path)): ApiPath<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    markdown_image_response(&build_jobs_route_deps(&state), &headers, &job_id, &path).await
}

pub async fn download_bundle(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    bundle_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}
