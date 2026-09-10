use axum::extract::{Extension, State};
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_document_operation_route_deps, ApiJson, ApiPath};
use crate::services::document_operation_api::{
    authorize_create_scope, authorize_operation_scope, cancel_document_operation,
    commit_document_operation, create_document_operation, get_document_operation_view,
    run_document_operation, AgentCapabilityClaims, CancelDocumentOperationInput,
    CommitDocumentOperationInput, CreateDocumentOperationInput, DocumentOperationView,
    RunDocumentOperationInput,
};
use crate::AppState;

pub async fn create_document_operation_route(
    State(state): State<AppState>,
    capability: Option<Extension<AgentCapabilityClaims>>,
    ApiJson(input): ApiJson<CreateDocumentOperationInput>,
) -> Result<Json<ApiResponse<DocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    authorize_create_scope(
        capability.as_ref().map(|value| &value.0),
        &input.conversation_id,
        &input.document_id,
    )?;
    Ok(Json(ApiResponse::ok(create_document_operation(
        deps.db,
        deps.config,
        &input,
    )?)))
}

pub async fn get_document_operation_route(
    State(state): State<AppState>,
    capability: Option<Extension<AgentCapabilityClaims>>,
    ApiPath(operation_id): ApiPath<String>,
) -> Result<Json<ApiResponse<DocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    authorize_operation_scope(
        deps.db,
        capability.as_ref().map(|value| &value.0),
        &operation_id,
    )?;
    Ok(Json(ApiResponse::ok(get_document_operation_view(
        deps.db,
        deps.config,
        &operation_id,
        false,
    )?)))
}

pub async fn run_document_operation_route(
    State(state): State<AppState>,
    capability: Option<Extension<AgentCapabilityClaims>>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<RunDocumentOperationInput>,
) -> Result<Json<ApiResponse<DocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    authorize_operation_scope(
        deps.db,
        capability.as_ref().map(|value| &value.0),
        &operation_id,
    )?;
    Ok(Json(ApiResponse::ok(run_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}

pub async fn cancel_document_operation_route(
    State(state): State<AppState>,
    capability: Option<Extension<AgentCapabilityClaims>>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<CancelDocumentOperationInput>,
) -> Result<Json<ApiResponse<DocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    authorize_operation_scope(
        deps.db,
        capability.as_ref().map(|value| &value.0),
        &operation_id,
    )?;
    Ok(Json(ApiResponse::ok(cancel_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}

pub async fn commit_document_operation_route(
    State(state): State<AppState>,
    capability: Option<Extension<AgentCapabilityClaims>>,
    ApiPath(operation_id): ApiPath<String>,
    ApiJson(input): ApiJson<CommitDocumentOperationInput>,
) -> Result<Json<ApiResponse<DocumentOperationView>>, AppError> {
    let deps = build_document_operation_route_deps(&state);
    authorize_operation_scope(
        deps.db,
        capability.as_ref().map(|value| &value.0),
        &operation_id,
    )?;
    Ok(Json(ApiResponse::ok(commit_document_operation(
        deps.db,
        deps.config,
        &operation_id,
        &input,
    )?)))
}
