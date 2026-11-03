use axum::http::{header, HeaderMap, HeaderValue};
use axum::response::Response;

use crate::error::AppError;
use crate::routes::job_helpers::stream_file;
use crate::services::jobs::FileDownload;


pub async fn file_download_response(
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
    if let Some(cache_control) = download.cache_control {
        response
            .headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static(cache_control));
    }
    Ok(response)
}
