//! 阅读：阅读页要的东西（`/jobs/:id/reader/…`）。区块位置、元信息、原文 Markdown 的 JSON 视图。

use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, ReaderMetadataView, ReaderRegionItemView, ReaderRegionsView};
use crate::AppState;

use crate::routes::common::{build_jobs_download_route_deps, ok_json, run_job_query, ApiPath};
use crate::routes::download_response::markdown_document_response;
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
pub async fn get_reader_region(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<ReaderRegionItemView>>, AppError> {
    // 合并并发请求的键要带区块编号：只按任务合并的话，同一任务并发取两块，后到的拿到先到的那一块。
    let key = format!("reader-region:{job_id}:{item_id}");
    let view = run_job_query(&state, key, move |jobs| {
        jobs.reader_region_item_view(&job_id, &item_id)
    })
    .await?;
    Ok(ok_json(view))
}

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

/// 原文 Markdown 的 JSON 视图，图片链接已换成绝对地址。
pub async fn get_markdown_document(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    markdown_document_response(&build_jobs_download_route_deps(&state), &headers, &job_id).await
}
