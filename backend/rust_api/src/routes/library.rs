use axum::extract::{Path as AxumPath, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::{
    ApiResponse, LibraryBatchDeleteInput, LibraryBatchDeleteResultView, LibraryBookDetailView,
    LibraryBookListView, LibraryDeleteQuery, LibraryDeleteResultView, ListJobsQuery,
};
use crate::routes::common::{build_library_route_deps, ok_json};
use crate::routes::jobs::common::build_jobs_route_deps;
use crate::routes::jobs::common::request_base_url;
use crate::routes::jobs::download_adapter::{cover_response, thumbnail_response};
use crate::services::library_api::{
    delete_library_book_view, delete_library_books_view, get_library_book_view,
    list_library_books_view,
};
use crate::AppState;

pub async fn list_books(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListJobsQuery>,
) -> Result<Json<ApiResponse<LibraryBookListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(list_library_books_view(
        &deps.library,
        &query,
        &base_url,
    )?))
}

pub async fn get_book(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Json<ApiResponse<LibraryBookDetailView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port);
    Ok(ok_json(get_library_book_view(
        &deps.library,
        &job_id,
        &base_url,
    )?))
}

pub async fn delete_book(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    Query(query): Query<LibraryDeleteQuery>,
) -> Result<Json<ApiResponse<LibraryDeleteResultView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_library_book_view(
        &deps.library,
        &job_id,
        query.force,
    )?))
}

pub async fn delete_books(
    State(state): State<AppState>,
    Json(input): Json<LibraryBatchDeleteInput>,
) -> Result<Json<ApiResponse<LibraryBatchDeleteResultView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_library_books_view(&deps.library, &input)?))
}

pub async fn download_book_cover(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    cover_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_book_thumbnail(
    State(state): State<AppState>,
    AxumPath(job_id): AxumPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    thumbnail_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}
