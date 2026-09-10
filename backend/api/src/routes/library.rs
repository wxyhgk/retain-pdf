use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, LibraryBatchDeleteInput, LibraryBatchDeleteResultView, LibraryBookDetailView,
    LibraryBookListView, LibraryDeleteQuery, LibraryDeleteResultView, ListJobsQuery,
};
use crate::routes::common::build_jobs_route_deps;
use crate::routes::common::request_base_url;
use crate::routes::common::{build_library_route_deps, ok_json, ApiJson, ApiPath, ApiQuery};
use crate::routes::download_response::{cover_response, thumbnail_response};
use crate::services::library::api::{
    delete_library_book_view, delete_library_books_view, get_library_book_view,
    list_library_books_view,
};
use crate::AppState;

pub async fn list_books(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiQuery(query): ApiQuery<ListJobsQuery>,
) -> Result<Json<ApiResponse<LibraryBookListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(list_library_books_view(
        &deps.library,
        &query,
        &base_url,
    )?))
}

pub async fn get_book(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<LibraryBookDetailView>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(get_library_book_view(
        &deps.library,
        &job_id,
        &base_url,
    )?))
}

pub async fn delete_book(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<LibraryDeleteQuery>,
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
    ApiJson(input): ApiJson<LibraryBatchDeleteInput>,
) -> Result<Json<ApiResponse<LibraryBatchDeleteResultView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_library_books_view(&deps.library, &input)?))
}

pub async fn download_book_cover(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    cover_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}

pub async fn download_book_thumbnail(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    thumbnail_response(&build_jobs_route_deps(&state), &headers, &job_id).await
}
