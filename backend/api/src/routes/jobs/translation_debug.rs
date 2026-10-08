use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, JobReportView, ListTranslationItemsQuery, ReviseTranslationItemRequest,
    TranslationDebugItemView, TranslationDebugListView, TranslationDiagnosticsView,
    TranslationReplayView, TranslationRevisionHistoryView, TranslationRevisionView,
};
use crate::AppState;

use super::json_response::{replay_translation_item_response, revise_translation_item_response};
use crate::routes::common::{
    build_jobs_query_route_deps, build_jobs_route_deps, ok_json, ApiJson, ApiPath, ApiQuery,
};

pub async fn get_translation_diagnostics(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    _headers: HeaderMap,
) -> Result<Json<ApiResponse<TranslationDiagnosticsView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    Ok(ok_json(deps.jobs.translation_diagnostics_view(&job_id)?))
}

pub async fn get_translation_qa(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobReportView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    Ok(ok_json(deps.jobs.translation_qa_view(&job_id)?))
}

pub async fn get_fit_report(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobReportView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    Ok(ok_json(deps.jobs.fit_report_view(&job_id)?))
}

pub async fn list_translation_items(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListTranslationItemsQuery>,
) -> Result<Json<ApiResponse<TranslationDebugListView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    Ok(ok_json(deps.jobs.translation_items_view(&job_id, &query)?))
}

pub async fn get_translation_item(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationDebugItemView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    Ok(ok_json(deps.jobs.translation_item_view(&job_id, &item_id)?))
}

pub async fn replay_translation_item_route(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationReplayView>>, AppError> {
    replay_translation_item_response(build_jobs_route_deps(&state), &job_id, &item_id).await
}

pub async fn revise_translation_item_route(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
    headers: HeaderMap,
    ApiJson(request): ApiJson<ReviseTranslationItemRequest>,
) -> Result<Json<ApiResponse<TranslationRevisionView>>, AppError> {
    revise_translation_item_response(
        build_jobs_route_deps(&state),
        &headers,
        &job_id,
        &item_id,
        request,
    )
    .await
}

pub async fn get_translation_item_revisions(
    State(state): State<AppState>,
    ApiPath((job_id, item_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<TranslationRevisionHistoryView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    Ok(ok_json(
        deps.jobs.translation_item_revisions_view(&job_id, &item_id)?,
    ))
}
