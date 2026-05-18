use std::path::{Path, PathBuf};

use axum::http::{header, HeaderMap, HeaderValue};
use axum::response::IntoResponse;
use axum::response::Response;

use crate::error::AppError;
use crate::models::{to_absolute_url, JobSnapshot, MarkdownQuery, MarkdownView, PagePreviewQuery};
use crate::routes::common::ok_json;
use crate::routes::job_helpers::stream_file;

use super::common::{request_base_url, JobsRouteDeps};
use crate::services::jobs::{FileDownload, MarkdownDownload};

fn jobs_facade_ref<'a>(deps: &'a JobsRouteDeps<'a>) -> crate::services::jobs::JobsFacade<'a> {
    deps.jobs.clone()
}

pub async fn download_document_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
    resolve_path: impl Fn(&JobSnapshot, &Path) -> Option<PathBuf>,
    not_ready_label: &str,
    content_type: &str,
) -> Result<Response, AppError> {
    file_download_response(
        jobs_facade_ref(deps).download_job_document(
            job_id,
            ocr_only,
            resolve_path,
            not_ready_label,
            content_type,
        )?,
        headers,
    )
    .await
}

pub async fn markdown_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: String,
    query: &MarkdownQuery,
) -> Result<Response, AppError> {
    let markdown = jobs_facade_ref(deps).markdown_document(job_id).await?;
    markdown_download_response(headers, markdown, query.raw, deps.default_port)
}

pub async fn markdown_image_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    path: &str,
) -> Result<Response, AppError> {
    file_download_response(
        jobs_facade_ref(deps).markdown_image_download(job_id, path)?,
        headers,
    )
    .await
}

pub async fn cover_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(jobs_facade_ref(deps).cover_download(job_id)?, headers).await
}

pub async fn thumbnail_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(jobs_facade_ref(deps).thumbnail_download(job_id)?, headers).await
}

pub async fn page_preview_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    page: u32,
    query: &PagePreviewQuery,
) -> Result<Response, AppError> {
    let mut response = file_download_response(
        jobs_facade_ref(deps).page_preview_download(job_id, page, query)?,
        headers,
    )
    .await?;
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=31536000, immutable"),
    );
    Ok(response)
}

pub async fn bundle_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(
        jobs_facade_ref(deps).bundle_download(job_id).await?,
        headers,
    )
    .await
}

pub async fn registered_artifact_response(
    deps: &JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    artifact_key: &str,
    include_job_dir: bool,
    ocr_only: bool,
) -> Result<Response, AppError> {
    file_download_response(
        jobs_facade_ref(deps).registered_artifact_download(
            job_id,
            artifact_key,
            include_job_dir,
            ocr_only,
        )?,
        headers,
    )
    .await
}

async fn file_download_response(
    download: FileDownload,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let mut response = stream_file(
        download.path,
        &download.content_type,
        download.download_name,
        Some(headers),
    )
    .await?;
    if let Some(job_id) = download.job_id_header {
        response.headers_mut().insert(
            "X-Job-Id",
            HeaderValue::from_str(&job_id).map_err(|e| AppError::internal(e.to_string()))?,
        );
    }
    Ok(response)
}

fn markdown_download_response(
    headers: &HeaderMap,
    markdown: MarkdownDownload,
    raw: bool,
    default_port: u16,
) -> Result<Response, AppError> {
    if raw {
        return Ok((
            [(header::CONTENT_TYPE, "text/markdown; charset=utf-8")],
            markdown.content,
        )
            .into_response());
    }
    let base_url = request_base_url(headers, default_port);
    let raw_path = format!("/api/v1/jobs/{}/markdown?raw=true", markdown.job_id);
    let images_base_path = format!("/api/v1/jobs/{}/markdown/images/", markdown.job_id);
    Ok(ok_json(MarkdownView {
        job_id: markdown.job_id,
        content: markdown.content,
        raw_path: raw_path.clone(),
        raw_url: to_absolute_url(&base_url, &raw_path),
        images_base_path: images_base_path.clone(),
        images_base_url: to_absolute_url(&base_url, &images_base_path),
    })
    .into_response())
}
