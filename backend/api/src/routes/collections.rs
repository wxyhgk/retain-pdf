//! 分类文件夹(合集)CRUD——collections/collection_documents 表早已随图书馆
//! 数据层建好(见 db/schema.rs),这里只是补上一直缺失的路由层。
//!
//! All handlers go through library_api (PR5).

use axum::extract::State;
use axum::Json;

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::{
    AddCollectionDocumentsInput, ApiResponse, CollectionListView, CollectionMutationResult,
    CollectionRecord, CreateCollectionInput, PatchCollectionInput,
};
use crate::routes::common::{build_library_route_deps, ok_json, ApiJson, ApiPath};
use crate::services::library::api::{
    add_collection_documents_view, collection_agent_workspace, create_collection_view,
    delete_collection_view, list_collections_view, patch_collection_view,
    remove_collection_document_view, CollectionWorkspace,
};
use crate::AppState;

pub async fn create_collection_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiJson(payload): ApiJson<CreateCollectionInput>,
) -> Result<Json<ApiResponse<CollectionRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(create_collection_view(&deps.library, &payload, principal.owner_id())?))
}

pub async fn list_collections_route(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Json<ApiResponse<CollectionListView>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(list_collections_view(&deps.library, principal.owner_filter())?))
}

pub async fn patch_collection_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchCollectionInput>,
) -> Result<Json<ApiResponse<CollectionRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(patch_collection_view(
        &deps.library,
        &collection_id,
        &payload,
    )?))
}

pub async fn delete_collection_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
) -> Result<Json<ApiResponse<CollectionMutationResult>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(delete_collection_view(
        &deps.library,
        &collection_id,
    )?))
}

pub async fn add_collection_documents_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
    ApiJson(payload): ApiJson<AddCollectionDocumentsInput>,
) -> Result<Json<ApiResponse<CollectionRecord>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(add_collection_documents_view(
        &deps.library,
        &collection_id,
        payload,
    )?))
}

pub async fn remove_collection_document_route(
    State(state): State<AppState>,
    ApiPath((collection_id, document_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<CollectionMutationResult>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(remove_collection_document_view(
        &deps.library,
        &collection_id,
        &document_id,
    )?))
}

/// 物化这个文件夹的 agent 工作区，返回清单。
///
/// 每次调用都重建 `books/` —— 成员和 active_job 都会变，而那个目录是纯派生物。
/// 所以前端在开终端**之前**打一次就行，不需要额外的失效逻辑。
pub async fn collection_agent_workspace_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
) -> Result<Json<ApiResponse<CollectionWorkspace>>, AppError> {
    let deps = build_library_route_deps(&state);
    Ok(ok_json(collection_agent_workspace(&deps.library, &collection_id).await?))
}
