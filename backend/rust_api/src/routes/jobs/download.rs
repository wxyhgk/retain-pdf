use crate::error::AppError;
use crate::models::{
    ApiResponse, ArtifactDownloadQuery, JobStatusKind, MarkdownQuery, MarkdownView,
};
use crate::routes::job_helpers::{request_base_url, stream_file};
use crate::services::artifacts::{
    artifact_is_direct_downloadable, attach_job_id_header, build_bundle_for_job,
    build_markdown_bundle_for_job, resolve_registry_artifact,
};
use crate::services::jobs::{load_ocr_job_with_supported_layout, load_supported_job};
use crate::storage_paths::{
    resolve_markdown_images_dir, resolve_markdown_path, resolve_normalization_report,
    resolve_normalized_document, resolve_output_pdf,
};
use crate::AppState;
use axum::extract::{Path as AxumPath, Query, State};
use axum::http::{header, HeaderMap};
use axum::response::{IntoResponse, Response};
use axum::Json;

use super::download_job_file;

pub async fn download_pdf(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_job_file(
        &state,
        &job,
        &job_id,
        resolve_output_pdf,
        "pdf not ready",
        "application/pdf",
    )
    .await
}

pub async fn download_artifact_by_key(
    State(state): State<AppState>,
    AxumPath((job_id, artifact_key)): AxumPath<(String, String)>,
    Query(query): Query<ArtifactDownloadQuery>,
) -> Result<Response, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_registered_artifact(&state, &job, &job_id, &artifact_key, &query).await
}

pub async fn download_ocr_artifact_by_key(
    State(state): State<AppState>,
    AxumPath((job_id, artifact_key)): AxumPath<(String, String)>,
    Query(query): Query<ArtifactDownloadQuery>,
) -> Result<Response, AppError> {
    let job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_registered_artifact(&state, &job, &job_id, &artifact_key, &query).await
}

pub async fn download_normalized_document(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_job_file(
        &state,
        &job,
        &job_id,
        resolve_normalized_document,
        "normalized document not ready",
        "application/json",
    )
    .await
}

pub async fn download_ocr_normalized_document(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_job_file(
        &state,
        &job,
        &job_id,
        resolve_normalized_document,
        "normalized document not ready",
        "application/json",
    )
    .await
}

pub async fn download_normalization_report(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_job_file(
        &state,
        &job,
        &job_id,
        resolve_normalization_report,
        "normalization report not ready",
        "application/json",
    )
    .await
}

pub async fn download_ocr_normalization_report(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let job = load_ocr_job_with_supported_layout(state.db.as_ref(), &state.config.data_root, &job_id)?;
    download_job_file(
        &state,
        &job,
        &job_id,
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
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    let markdown_path = resolve_markdown_path(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown not found: {job_id}")))?;
    let content = tokio::fs::read_to_string(&markdown_path).await?;
    if query.raw {
        return Ok((
            [(header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
            content,
        )
            .into_response());
    }
    let base_url = request_base_url(&headers, &state);
    let raw_path = format!("/api/v1/jobs/{}/markdown?raw=true", job.job_id);
    let images_base_path = format!("/api/v1/jobs/{}/markdown/images/", job.job_id);
    Ok(Json(ApiResponse::ok(MarkdownView {
        job_id,
        content,
        raw_path: raw_path.clone(),
        raw_url: crate::models::to_absolute_url(&base_url, &raw_path),
        images_base_path: images_base_path.clone(),
        images_base_url: crate::models::to_absolute_url(&base_url, &images_base_path),
    }))
    .into_response())
}

pub async fn download_markdown_image(
    State(state): State<AppState>,
    AxumPath((job_id, path)): AxumPath<(String, String)>,
) -> Result<Response, AppError> {
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    let images_dir = resolve_markdown_images_dir(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("markdown images not found: {job_id}")))?;
    let file_path = images_dir.join(&path);
    if !file_path.exists() || !file_path.is_file() {
        return Err(AppError::not_found(format!(
            "markdown image not found: {path}"
        )));
    }
    let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
    stream_file(file_path, mime.as_ref(), None).await
}

pub async fn download_bundle(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let _guard = state.downloads_lock.lock().await;
    let job = load_supported_job(state.db.as_ref(), &state.config.data_root, &job_id)?;
    if !matches!(job.status, JobStatusKind::Succeeded) {
        return Err(AppError::conflict("job is not finished successfully"));
    }
    let zip_path = build_bundle_for_job(
        state.db.as_ref(),
        &state.config.data_root,
        &state.config.downloads_dir,
        &job,
    )?;
    let mut response =
        stream_file(zip_path, "application/zip", Some(format!("{job_id}.zip"))).await?;
    attach_job_id_header(&mut response, &job_id)?;
    Ok(response)
}

async fn download_registered_artifact(
    state: &AppState,
    job: &crate::models::JobSnapshot,
    job_id: &str,
    artifact_key: &str,
    query: &ArtifactDownloadQuery,
) -> Result<Response, AppError> {
    if artifact_key == crate::storage_paths::ARTIFACT_KEY_MARKDOWN_BUNDLE_ZIP {
        let (item, path) = build_markdown_bundle_for_job(
            state.db.as_ref(),
            &state.config.data_root,
            job,
            query.include_job_dir,
        )?;
        return stream_file(path, &item.content_type, item.file_name.clone()).await;
    }
    let Some((item, path)) = resolve_registry_artifact(
        state.db.as_ref(),
        &state.config.data_root,
        job,
        artifact_key,
    )? else {
        return Err(AppError::not_found(format!(
            "artifact not found: {job_id}/{artifact_key}"
        )));
    };
    if !artifact_is_direct_downloadable(&item) {
        return Err(AppError::conflict(format!(
            "artifact is a directory and cannot be streamed directly: {artifact_key}"
        )));
    }
    if !item.ready || !path.exists() || !path.is_file() {
        return Err(AppError::not_found(format!(
            "artifact not ready: {job_id}/{artifact_key}"
        )));
    }
    stream_file(path, &item.content_type, item.file_name.clone()).await
}
