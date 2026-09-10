use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_credential_route_deps, ApiJson, ApiPath, ApiQuery};
use crate::services::credentials::api::{
    create_credential, delete_credential, get_credential_metadata, list_credentials,
    update_credential, CreateCredentialInput, CredentialDeleteView, CredentialListView,
    CredentialMutationView, DeleteCredentialQuery, UpdateCredentialInput,
};
use crate::AppState;

pub async fn list_credentials_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<CredentialListView>>, AppError> {
    let deps = build_credential_route_deps(&state);
    Ok(Json(ApiResponse::ok(list_credentials(deps.data_root)?)))
}

pub async fn create_credential_route(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<CreateCredentialInput>,
) -> Result<Json<ApiResponse<CredentialMutationView>>, AppError> {
    let deps = build_credential_route_deps(&state);
    Ok(Json(ApiResponse::ok(create_credential(
        deps.data_root,
        input,
    )?)))
}

pub async fn get_credential_route(
    State(state): State<AppState>,
    ApiPath(credential_ref): ApiPath<String>,
) -> Result<Json<ApiResponse<CredentialMutationView>>, AppError> {
    let deps = build_credential_route_deps(&state);
    Ok(Json(ApiResponse::ok(get_credential_metadata(
        deps.data_root,
        &credential_ref,
    )?)))
}

pub async fn update_credential_route(
    State(state): State<AppState>,
    ApiPath(credential_ref): ApiPath<String>,
    ApiJson(input): ApiJson<UpdateCredentialInput>,
) -> Result<Json<ApiResponse<CredentialMutationView>>, AppError> {
    let deps = build_credential_route_deps(&state);
    Ok(Json(ApiResponse::ok(update_credential(
        deps.data_root,
        &credential_ref,
        input,
    )?)))
}

pub async fn delete_credential_route(
    State(state): State<AppState>,
    ApiPath(credential_ref): ApiPath<String>,
    ApiQuery(query): ApiQuery<DeleteCredentialQuery>,
) -> Result<Json<ApiResponse<CredentialDeleteView>>, AppError> {
    let deps = build_credential_route_deps(&state);
    Ok(Json(ApiResponse::ok(delete_credential(
        deps.db,
        deps.data_root,
        &credential_ref,
        query.expected_revision,
        query.force,
    )?)))
}
