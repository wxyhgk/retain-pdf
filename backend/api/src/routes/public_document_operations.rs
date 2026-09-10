use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{
    build_document_operation_route_deps, request_base_url, ApiJson, ApiPath, ApiQuery,
};
use crate::routes::job_helpers::stream_file;
use crate::services::public_document_operations_api::{
    cancel_public_document_operation, commit_public_document_operation,
    get_public_document_operation, list_document_agent_versions, list_public_document_operations,
    public_document_operation_candidate_download, retry_public_document_operation,
    run_public_document_operation, DocumentAgentVersionListQuery, DocumentAgentVersionListView,
    PublicDocumentOperationActionInput, PublicDocumentOperationListQuery,
    PublicDocumentOperationListView, PublicDocumentOperationView,
};
use crate::AppState;

pub async fn list_document_agent_versions_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<DocumentAgentVersionListQuery>,
) -> Result<Json<ApiResponse<DocumentAgentVersionListView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    let base_url = request_base_url(&headers, deps.config.port, &deps.config.bind_host);
    Ok(Json(ApiResponse::ok(list_document_agent_versions(
        deps.db,
        &document_id,
        &query,
        &base_url,
    )?)))
}

pub async fn list_public_document_operations_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<PublicDocumentOperationListQuery>,
) -> Result<Json<ApiResponse<PublicDocumentOperationListView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    Ok(Json(ApiResponse::ok(list_public_document_operations(
        deps.db,
        deps.config,
        &conversation_id,
        &query,
    )?)))
}

pub async fn get_public_document_operation_route(
    State(state): State<AppState>,
    ApiPath(operation_id): ApiPath<String>,
) -> Result<Json<ApiResponse<PublicDocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    Ok(Json(ApiResponse::ok(get_public_document_operation(
        deps.db,
        deps.config,
        &operation_id,
    )?)))
}

pub async fn run_public_document_operation_route(
    State(state): State<AppState>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<PublicDocumentOperationActionInput>,
) -> Result<Json<ApiResponse<PublicDocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    Ok(Json(ApiResponse::ok(run_public_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}

pub async fn retry_public_document_operation_route(
    State(state): State<AppState>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<PublicDocumentOperationActionInput>,
) -> Result<Json<ApiResponse<PublicDocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    Ok(Json(ApiResponse::ok(retry_public_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}

pub async fn cancel_public_document_operation_route(
    State(state): State<AppState>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<PublicDocumentOperationActionInput>,
) -> Result<Json<ApiResponse<PublicDocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    Ok(Json(ApiResponse::ok(cancel_public_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}

pub async fn commit_public_document_operation_route(
    State(state): State<AppState>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<PublicDocumentOperationActionInput>,
) -> Result<Json<ApiResponse<PublicDocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    Ok(Json(ApiResponse::ok(commit_public_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}

pub async fn download_public_document_operation_candidate_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(operation_id): ApiPath<String>,
) -> Result<Response, AppError> {
    let deps = build_document_operation_route_deps(&state);
    let candidate =
        public_document_operation_candidate_download(deps.db, deps.config, &operation_id)?;
    stream_file(candidate.path, "application/pdf", None, Some(&headers)).await
}
