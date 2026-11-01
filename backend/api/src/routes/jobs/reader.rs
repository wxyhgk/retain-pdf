//! 阅读：阅读页要的东西（`/jobs/:id/reader/…`）。区块位置、元信息、原文 Markdown 的 JSON 视图。

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, ReaderMetadataView, ReaderRegionItemView, ReaderRegionsView};
use crate::AppState;

use crate::routes::common::{build_jobs_download_route_deps, ok_json, run_job_query, ApiPath};
use crate::routes::download_response::markdown_document_response;

pub async fn get_reader_regions(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<ReaderRegionsView>>, AppError> {
    let view = run_job_query(&state, format!("reader-regions:{job_id}"), move |jobs| {
        jobs.reader_regions_view(&job_id)
    })
    .await?;
    Ok(ok_json(view))
}

/// 一个区块（引用一段用）：和 `reader/regions` 的一项一样。
pub async fn get_reader_region(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<ReaderRegionItemView>>, AppError> {
    let view = run_job_query(&state, format!("reader-region:{job_id}"), move |jobs| {
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
