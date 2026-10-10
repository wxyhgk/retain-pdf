use axum::http::{HeaderMap, HeaderValue};
use axum::response::Response;

use crate::error::AppError;
use crate::routes::job_helpers::stream_file;
use crate::models::api::LayoutDocxQuery;
use crate::services::jobs::{DocumentDownloadKind, FileDownload};

use crate::routes::common::JobsDownloadRouteDeps;

pub async fn download_document_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
    kind: DocumentDownloadKind,
) -> Result<Response, AppError> {
    file_download_response(
        deps.downloads
            .download_job_document(job_id, ocr_only, kind)
            .await?,
        headers,
    )
    .await
}

pub async fn markdown_image_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    path: &str,
) -> Result<Response, AppError> {
    file_download_response(
        deps.downloads.markdown_image_download(job_id, path)?,
        headers,
    )
    .await
}

/// 画板里的一个文件。文件名的防护在 services 侧（单层名、拒符号链接、
/// 解析后仍在目录内），这里只负责把结果变成 HTTP 响应。
pub async fn ai_board_file_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    name: &str,
) -> Result<Response, AppError> {
    file_download_response(deps.downloads.ai_board_file_download(job_id, name)?, headers).await
}

pub async fn cover_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(deps.downloads.cover_download(job_id).await?, headers)
        .await
        .map(crate::routes::job_helpers::with_image_cache)
}

pub async fn thumbnail_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(deps.downloads.thumbnail_download(job_id).await?, headers)
        .await
        .map(crate::routes::job_helpers::with_image_cache)
}

pub async fn side_by_side_pdf_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(
        deps.downloads.side_by_side_pdf_download(job_id).await?,
        headers,
    )
    .await
}

pub async fn layout_docx_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    query: &LayoutDocxQuery,
) -> Result<Response, AppError> {
    // 只把 query 往下传,DPI 的取值范围由 service 决定——路由层不该知道
    // `LayoutDocxOptions` 这种内部类型（架构门禁盯着这条，和 page_preview 一个路子）。
    file_download_response(
        deps.downloads.layout_docx_download(job_id, query).await?,
        headers,
    )
    .await
}

pub async fn bundle_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Response, AppError> {
    file_download_response(deps.downloads.bundle_download(job_id).await?, headers).await
}

pub async fn registered_artifact_response(
    deps: &JobsDownloadRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    artifact_key: &str,
    include_job_dir: bool,
    ocr_only: bool,
) -> Result<Response, AppError> {
    file_download_response(
        deps.downloads
            .registered_artifact_download(job_id, artifact_key, include_job_dir, ocr_only)
            .await?,
        headers,
    )
    .await
}

pub(super) async fn file_download_response(
    download: FileDownload,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let attachment = download.download_name.is_some();
    let mut response = stream_file(
        download.path,
        &download.content_type,
        download.download_name,
        Some(headers),
    )
    .await?;
    if !attachment {
        if let Some(name) = download.inline_name.as_deref() {
            crate::routes::job_helpers::set_content_disposition(&mut response, "inline", name)?;
        }
    }
    if let Some(job_id) = download.job_id_header {
        response.headers_mut().insert(
            "X-Job-Id",
            HeaderValue::from_str(&job_id).map_err(|e| AppError::internal(e.to_string()))?,
        );
    }
    Ok(response)
}
