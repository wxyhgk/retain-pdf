//! 图书馆数据层的最小 API:documents / favorites / 全文检索。
//! 前端图书馆改版前,现有 /api/v1/library/books 投影接口保持不动。
//!
//! All handlers go through library_api (PR2–PR4).

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ApplyDocumentMetadataSuggestionInput, CreateDocumentMetadataSuggestionInput,
    CreateFavoriteInput, DocumentDeleteResultView, DocumentJobListView, DocumentListView,
    DocumentMetadataSuggestionApplyView, DocumentMetadataSuggestionListView,
    DocumentMetadataSuggestionView, DocumentRecord, FavoriteListView, FavoriteMutationResult,
    FavoriteRecord, JobSubmissionView, LibraryDeleteQuery, ListDocumentJobsQuery,
    ListDocumentMetadataSuggestionsQuery, ListDocumentsQuery, ListFavoritesQuery,
    PatchDocumentInput, PatchFavoriteInput, SearchQuery, SearchResultView,
};
use crate::models::request::CreateJobInput;
use crate::routes::common::{
    build_library_route_deps, ok_json, request_base_url, ApiJson, ApiPath, ApiQuery,
};
use crate::routes::job_helpers::stream_file;
use crate::services::library::api::{
    apply_document_metadata_suggestion_view, create_document_metadata_suggestion_view,
    create_favorite_view, delete_document_view, delete_favorite_view, document_cover_download,
    document_source_pdf_download, document_thumbnail_download, get_document_view,
    list_document_jobs_view, list_document_metadata_suggestions_view, list_documents_view,
    list_favorites_view, ocr_document_view, patch_document_view, patch_favorite_view,
    search_blocks_view, translate_document_view,
};
use crate::AppState;

// --- documents ---

pub async fn list_documents_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<ListDocumentsQuery>,
) -> Result<Json<ApiResponse<DocumentListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(list_documents_view(
        &deps.library,
        &query,
        &base_url,
    )?))
}

pub async fn get_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(get_document_view(
        &deps.library,
        &document_id,
        &base_url,
    )?))
}

/// GET /api/v1/documents/:id/source.pdf — 无翻译 job 也能读源文件。
pub async fn download_document_source_pdf_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
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
    ApiPath(document_id): ApiPath<String>,
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
    ApiPath(document_id): ApiPath<String>,
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
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchDocumentInput>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(patch_document_view(
        &deps.library,
        &document_id,
        &payload,
        &base_url,
    )?))
}

pub async fn create_document_metadata_suggestion_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(input): ApiJson<CreateDocumentMetadataSuggestionInput>,
) -> Result<Json<ApiResponse<DocumentMetadataSuggestionView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(create_document_metadata_suggestion_view(
        &deps.library,
        &document_id,
        &input,
    )?))
}

pub async fn list_document_metadata_suggestions_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListDocumentMetadataSuggestionsQuery>,
) -> Result<Json<ApiResponse<DocumentMetadataSuggestionListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(list_document_metadata_suggestions_view(
        &deps.library,
        &document_id,
        &query,
    )?))
}

pub async fn apply_document_metadata_suggestion_route(
    State(state): State<AppState>,
    ApiPath((document_id, suggestion_id)): ApiPath<(String, String)>,
    ApiJson(input): ApiJson<ApplyDocumentMetadataSuggestionInput>,
) -> Result<Json<ApiResponse<DocumentMetadataSuggestionApplyView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(apply_document_metadata_suggestion_view(
        &deps.library,
        &document_id,
        &suggestion_id,
        &input,
    )?))
}

/// DELETE /api/v1/documents/:id —— 彻底删除文档(行 + jobs + uploads + 文件)。
/// 被收藏引用 → 409;运行中 job 需 ?force=true。
pub async fn delete_document_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<LibraryDeleteQuery>,
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
/// 复用馆藏文档已存的源 PDF 发起 book 翻译流水线，完成后 lifecycle 会回填 active_job_id。
pub async fn translate_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(request): ApiJson<CreateJobInput>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(translate_document_view(
        &deps.library,
        &deps.jobs,
        &document_id,
        request,
        &base_url,
    )?))
}

/// POST /api/v1/documents/:id/ocr
/// Reuse the document's stored source PDF and create an OCR-only job.
pub async fn ocr_document_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(request): ApiJson<CreateJobInput>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        ocr_document_view(&deps.library, &deps.jobs, &document_id, request, &base_url).await?,
    ))
}

/// GET /api/v1/documents/:id/jobs
/// Return all OCR/translation runs associated with the document, newest first.
pub async fn list_document_jobs_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListDocumentJobsQuery>,
) -> Result<Json<ApiResponse<DocumentJobListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(list_document_jobs_view(
        &deps.library,
        &deps.jobs,
        &document_id,
        &query,
        &base_url,
    )?))
}

// --- favorites ---

pub async fn create_favorite_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<CreateFavoriteInput>,
) -> Result<Json<ApiResponse<FavoriteRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(create_favorite_view(&deps.library, payload)?))
}

pub async fn list_favorites_route(
    State(state): State<AppState>,
    ApiQuery(query): ApiQuery<ListFavoritesQuery>,
) -> Result<Json<ApiResponse<FavoriteListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(list_favorites_view(&deps.library, &query)?))
}

pub async fn patch_favorite_route(
    State(state): State<AppState>,
    ApiPath(favorite_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchFavoriteInput>,
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
    ApiPath(favorite_id): ApiPath<String>,
) -> Result<Json<ApiResponse<FavoriteMutationResult>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_favorite_view(&deps.library, &favorite_id)?))
}

// --- search ---

pub async fn search_blocks_route(
    State(state): State<AppState>,
    ApiQuery(query): ApiQuery<SearchQuery>,
) -> Result<Json<ApiResponse<SearchResultView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(search_blocks_view(&deps.library, &query)?))
}
