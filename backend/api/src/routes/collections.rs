//! 分类文件夹(合集)CRUD——collections/collection_documents 表早已随图书馆
//! 数据层建好(见 db/schema/migrations/v01_library_foundation.sql),这里只是补上一直缺失的路由层。
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
use crate::routes::common::{ok_json, run_library_blocking, ApiJson, ApiPath};
use crate::services::library::{
    add_collection_documents_view, create_collection_view, delete_collection_view,
    list_collections_view, patch_collection_view, remove_collection_document_view,
};
use crate::AppState;

pub async fn create_collection_route(
    State(state): State<AppState>,
    principal: Principal,
    ApiJson(payload): ApiJson<CreateCollectionInput>,
) -> Result<Json<ApiResponse<CollectionRecord>>, AppError> {
    let owner = principal.owner_id().to_string();
    Ok(ok_json(
        run_library_blocking(&state, move |library| create_collection_view(library, &payload, &owner)).await?,
    ))
}

pub async fn list_collections_route(
    State(state): State<AppState>,
    principal: Principal,
) -> Result<Json<ApiResponse<CollectionListView>>, AppError> {
    let owner = principal.owner_filter().map(str::to_string);
    Ok(ok_json(
        run_library_blocking(&state, move |library| list_collections_view(library, owner.as_deref())).await?,
    ))
}

pub async fn patch_collection_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchCollectionInput>,
) -> Result<Json<ApiResponse<CollectionRecord>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| {
            patch_collection_view(library, &collection_id, &payload)
        })
        .await?,
    ))
}

pub async fn delete_collection_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
) -> Result<Json<ApiResponse<CollectionMutationResult>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| delete_collection_view(library, &collection_id)).await?,
    ))
}

pub async fn add_collection_documents_route(
    State(state): State<AppState>,
    ApiPath(collection_id): ApiPath<String>,
    ApiJson(payload): ApiJson<AddCollectionDocumentsInput>,
) -> Result<Json<ApiResponse<CollectionRecord>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| {
            add_collection_documents_view(library, &collection_id, payload)
        })
        .await?,
    ))
}

pub async fn remove_collection_document_route(
    State(state): State<AppState>,
    ApiPath((collection_id, document_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<CollectionMutationResult>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| {
            remove_collection_document_view(library, &collection_id, &document_id)
        })
        .await?,
    ))
}
