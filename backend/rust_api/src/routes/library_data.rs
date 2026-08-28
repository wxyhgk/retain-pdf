//! Lớp dữ liệu thư viện API tối thiểu: documents / favorites / tìm kiếm toàn văn.
//! Trước khi cải tiến thư viện frontend, các giao diện projection hiện có /api/v1/library/books giữ nguyên.
//!
//! All handlers go through library_api (PR2–PR4).

use axum::extract::Query;
use axum::extract::{Path as AxumPath, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, CreateFavoriteInput, DocumentDeleteResultView, DocumentListView, DocumentRecord,
    FavoriteListView, FavoriteMutationResult, FavoriteRecord, JobSubmissionView, LibraryDeleteQuery,
    ListDocumentsQuery, ListFavoritesQuery, PatchDocumentInput, PatchFavoriteInput, SearchQuery,
    SearchResultView,
};
use crate::models::request::CreateJobInput;
use crate::routes::common::{build_library_route_deps, ok_json, request_base_url};
use crate::routes::job_helpers::stream_file;
use crate::services::library_api::{
    create_favorite_view, delete_document_view, delete_favorite_view, document_cover_download,
    document_source_pdf_download, document_thumbnail_download, get_document_view,
    list_documents_view, list_favorites_view, patch_document_view, patch_favorite_view,
    search_blocks_view, translate_document_view,
};
use crate::AppState;

// --- documents ---

pub async fn list_documents_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListDocumentsQuery>,
) -> Result<Json<ApiResponse<DocumentListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(list_documents_view(
        &deps.library,
        &query,
        &base_url,
    )?))
}

pub async fn get_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(document_id): AxumPath<String>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(get_document_view(
        &deps.library,
        &document_id,
        &base_url,
    )?))
}

/// GET /api/v1/documents/:id/source.pdf — có thể đọc tệp nguồn ngay cả khi không có job dịch.
pub async fn download_document_source_pdf_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(document_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let deps = build_library_route_deps(&state);
    let file = document_source_pdf_download(&deps.library, &document_id)?;
    stream_file(
        file.path,
        file.content_type,
        file.download_name,
        Some(&headers),
    )
    .await
}

/// GET /api/v1/documents/:id/cover
pub async fn download_document_cover_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(document_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let deps = build_library_route_deps(&state);
    let file = document_cover_download(&deps.library, &document_id)?;
    stream_file(
        file.path,
        file.content_type,
        file.download_name,
        Some(&headers),
    )
    .await
}

/// GET /api/v1/documents/:id/thumbnail
pub async fn download_document_thumbnail_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(document_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let deps = build_library_route_deps(&state);
    let file = document_thumbnail_download(&deps.library, &document_id)?;
    stream_file(
        file.path,
        file.content_type,
        file.download_name,
        Some(&headers),
    )
    .await
}

pub async fn patch_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(document_id): AxumPath<String>,
    Json(payload): Json<PatchDocumentInput>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(patch_document_view(
        &deps.library,
        &document_id,
        &payload,
        &base_url,
    )?))
}

/// DELETE /api/v1/documents/:id —— xóa hoàn toàn tài liệu (hàng + job + uploads + tệp).
/// Được tham chiếu trong yêu thích → 409; job đang chạy cần ?force=true.
pub async fn delete_document_route(
    State(state): State<AppState>,
    AxumPath(document_id): AxumPath<String>,
    Query(query): Query<LibraryDeleteQuery>,
) -> Result<Json<ApiResponse<DocumentDeleteResultView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_document_view(
        &deps.library,
        &document_id,
        query.force,
    )?))
}

// --- translate ---

/// POST /api/v1/documents/:id/translate
/// Tái sử dụng PDF nguồn đã có trong tài liệu lưu trữ để khởi chạy pipeline dịch book, sau khi hoàn thành lifecycle sẽ điền active_job_id.
pub async fn translate_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(document_id): AxumPath<String>,
    Json(request): Json<CreateJobInput>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(translate_document_view(
        &deps.library,
        &deps.jobs,
        &document_id,
        request,
        &base_url,
    )?))
}

// --- favorites ---

pub async fn create_favorite_route(
    State(state): State<AppState>,
    Json(payload): Json<CreateFavoriteInput>,
) -> Result<Json<ApiResponse<FavoriteRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(create_favorite_view(&deps.library, payload)?))
}

pub async fn list_favorites_route(
    State(state): State<AppState>,
    Query(query): Query<ListFavoritesQuery>,
) -> Result<Json<ApiResponse<FavoriteListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(list_favorites_view(&deps.library, &query)?))
}

pub async fn patch_favorite_route(
    State(state): State<AppState>,
    AxumPath(favorite_id): AxumPath<String>,
    Json(payload): Json<PatchFavoriteInput>,
) -> Result<Json<ApiResponse<FavoriteMutationResult>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(patch_favorite_view(
        &deps.library,
        &favorite_id,
        &payload,
    )?))
}

pub async fn delete_favorite_route(
    State(state): State<AppState>,
    AxumPath(favorite_id): AxumPath<String>,
) -> Result<Json<ApiResponse<FavoriteMutationResult>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_favorite_view(
        &deps.library,
        &favorite_id,
    )?))
}

// --- search ---

pub async fn search_blocks_route(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<ApiResponse<SearchResultView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(search_blocks_view(&deps.library, &query)?))
}
