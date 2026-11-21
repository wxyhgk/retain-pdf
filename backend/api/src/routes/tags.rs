//! 标签（2026-11-21，数据库 v37）：建、列、改、删，给书设标签。业务逻辑在书库包的 `tags.rs`。

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, CreateTagInput, DocumentRecord, PatchTagInput, SetDocumentTagsInput, TagDeleteResultView,
    TagListView, TagRecord,
};
use crate::routes::common::{build_library_route_deps, ok_json, request_base_url, run_library_blocking, ApiJson, ApiPath};
use crate::services::library::{create_tag_view, delete_tag_view, list_tags_view, patch_tag_view, set_document_tags_view};
use crate::AppState;

pub async fn list_tags_route(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Json<ApiResponse<TagListView>>, AppError> {
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(run_library_blocking(&state, move |library| list_tags_view(library, owner.as_deref())).await?))
}

pub async fn create_tag_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiJson(payload): ApiJson<CreateTagInput>,
) -> Result<Json<ApiResponse<TagRecord>>, AppError> {
    let owner = principal.owner_id().to_string();
    Ok(ok_json(run_library_blocking(&state, move |library| create_tag_view(library, &payload, &owner)).await?))
}

pub async fn patch_tag_route(
    State(state): State<AppState>,
    ApiPath(tag_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchTagInput>,
) -> Result<Json<ApiResponse<TagRecord>>, AppError> {
    Ok(ok_json(run_library_blocking(&state, move |library| patch_tag_view(library, &tag_id, &payload)).await?))
}

pub async fn delete_tag_route(
    State(state): State<AppState>,
    ApiPath(tag_id): ApiPath<String>,
) -> Result<Json<ApiResponse<TagDeleteResultView>>, AppError> {
    Ok(ok_json(run_library_blocking(&state, move |library| delete_tag_view(library, &tag_id)).await?))
}

pub async fn set_document_tags_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<SetDocumentTagsInput>,
) -> Result<Json<ApiResponse<DocumentRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        run_library_blocking(&state, move |library| set_document_tags_view(library, &document_id, payload, &base_url))
            .await?,
    ))
}
