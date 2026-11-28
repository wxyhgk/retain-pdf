//! 阅读：阅读页要的东西（`/jobs/:id/reader/…`）。区块位置、元信息、原文 Markdown 的 JSON 视图。

use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, ReaderLayoutView, ReaderMetadataView, ReaderRegionsView};
use crate::AppState;

use crate::routes::common::{
    build_jobs_download_route_deps, build_jobs_query_route_deps, ok_json, request_base_url, run_job_query,
    run_job_query_once, ApiPath,
};
use crate::routes::download_response::{file_download_response, markdown_document_response};
use crate::routes::job_helpers::if_none_match_values;

/// 带 ETag（弱校验，响应可能压缩）：浏览器带着上次的 ETag 来、译文和原文结构都没变就回 304，大书不用再传
/// 几 MB；`Cache-Control: private, no-cache` 让浏览器存下来、每次用前先问。
pub async fn get_reader_regions(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let known: Vec<String> = if_none_match_values(&headers)
        .iter()
        .filter_map(|value| value.strip_prefix('"')?.strip_suffix('"').map(str::to_string))
        .collect();
    let key = format!("reader-regions:{job_id}:{}", known.join(","));
    let (fingerprint, view) = run_job_query(&state, key, move |jobs| {
        jobs.reader_regions_view_if_changed(&job_id, &known)
    })
    .await?;
    let mut response = match view {
        Some(view) => ok_json::<ReaderRegionsView>(view).into_response(),
        None => StatusCode::NOT_MODIFIED.into_response(),
    };
    let headers = response.headers_mut();
    if let Ok(etag) = HeaderValue::from_str(&format!("W/\"{fingerprint}\"")) {
        headers.insert(header::ETAG, etag);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("private, no-cache"));
    Ok(response)
}

/// 一个区块（引用一段用）：和 `reader/regions` 的一项一样。
pub async fn get_reader_metadata(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<ReaderMetadataView>>, AppError> {
    let view = run_job_query(&state, format!("reader-metadata:{job_id}"), move |jobs| {
        jobs.reader_metadata_view(&job_id)
    })
    .await?;
    Ok(ok_json(view))
}

/// rpr_fit 排的版面清单。没有版面不是错误：`available: false`、`reason`，能补排时带 `generate`。
pub async fn get_reader_layout(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ReaderLayoutView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query(&state, format!("reader-layout:{job_id}:{base_url}"), move |jobs| {
        jobs.reader_layout_view(&base_url, &job_id)
    })
    .await?;
    Ok(ok_json(view))
}

/// 一页版面，带 ETag（弱校验，响应可能压缩）；和清单里这页的 `etag` 一样就回 304。
pub async fn get_reader_layout_page(
    State(state): State<AppState>,
    ApiPath((job_id, page_index)): ApiPath<(String, u32)>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let known: Vec<String> = if_none_match_values(&headers)
        .iter()
        .filter_map(|value| value.strip_prefix('"')?.strip_suffix('"').map(str::to_string))
        .collect();
    let (etag, page) = run_job_query_once(
        &state,
        format!("reader-layout-page:{job_id}:{page_index}"),
        move |jobs| jobs.reader_layout_page_if_changed(&job_id, page_index, &known),
    )
    .await?;
    let mut response = match page {
        Some(page) => ok_json::<serde_json::Value>(page).into_response(),
        None => StatusCode::NOT_MODIFIED.into_response(),
    };
    let headers = response.headers_mut();
    if let Ok(etag) = HeaderValue::from_str(&format!("W/\"{etag}\"")) {
        headers.insert(header::ETAG, etag);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("private, no-cache"));
    Ok(response)
}

/// 版面的底图 PDF，支持分段读；清单里没有底图是 404。
pub async fn get_reader_layout_background(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let download = run_job_query_once(&state, format!("reader-layout-background:{job_id}"), move |jobs| {
        jobs.reader_layout_background(&job_id)
    })
    .await?;
    file_download_response(download, &headers).await
}

/// 原文 Markdown 的 JSON 视图，图片链接已换成绝对地址。
pub async fn get_markdown_document(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    markdown_document_response(&build_jobs_download_route_deps(&state), &headers, &job_id).await
}
