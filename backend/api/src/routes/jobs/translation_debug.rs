use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ListTranslationItemsQuery, TranslationDebugItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationReplayView,
};
use crate::AppState;

use super::json_response::{
    replay_translation_item_response, translation_diagnostics_response, translation_item_response,
    translation_items_response,
};
use crate::routes::common::{build_jobs_route_deps, ApiPath, ApiQuery};

pub async fn get_translation_diagnostics(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    _headers: HeaderMap,
) -> Result<Json<ApiResponse<TranslationDiagnosticsView>>, AppError> {
    translation_diagnostics_response(build_jobs_route_deps(&state), &job_id)
}

pub async fn list_translation_items(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListTranslationItemsQuery>,
) -> Result<Json<ApiResponse<TranslationDebugListView>>, AppError> {
    translation_items_response(build_jobs_route_deps(&state), &job_id, &query)
}

pub async fn get_translation_item(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationDebugItemView>>, AppError> {
    translation_item_response(build_jobs_route_deps(&state), &job_id, &item_id)
}

pub async fn replay_translation_item_route(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationReplayView>>, AppError> {
    replay_translation_item_response(build_jobs_route_deps(&state), &job_id, &item_id).await
}
