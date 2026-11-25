//! 阅读页提问的问答记录（2026-11-25，数据库 v39）：按书建、列、读、改、删。业务逻辑在书库包的 `ask_threads.rs`。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, AskThreadDeleteResultView, AskThreadListView, AskThreadView, CreateAskThreadInput, PatchAskThreadInput,
};
use crate::routes::common::{ok_json, run_library_blocking, ApiJson, ApiPath};
use crate::services::library::{
    create_ask_thread_view, delete_ask_thread_view, get_ask_thread_view, list_ask_threads_view, patch_ask_thread_view,
};
use crate::AppState;

pub async fn list_ask_threads_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Json<ApiResponse<AskThreadListView>>, AppError> {
    Ok(ok_json(run_library_blocking(&state, move |library| list_ask_threads_view(library, &document_id)).await?))
}

pub async fn create_ask_thread_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
    ApiJson(payload): ApiJson<CreateAskThreadInput>,
) -> Result<Json<ApiResponse<AskThreadView>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| create_ask_thread_view(library, &document_id, &payload)).await?,
    ))
}

pub async fn get_ask_thread_route(
    State(state): State<AppState>,
    ApiPath((document_id, thread_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<AskThreadView>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| get_ask_thread_view(library, &document_id, &thread_id)).await?,
    ))
}

pub async fn patch_ask_thread_route(
    State(state): State<AppState>,
    ApiPath((document_id, thread_id)): ApiPath<(String, String)>,
    ApiJson(payload): ApiJson<PatchAskThreadInput>,
) -> Result<Json<ApiResponse<AskThreadView>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| patch_ask_thread_view(library, &document_id, &thread_id, &payload))
            .await?,
    ))
}

pub async fn delete_ask_thread_route(
    State(state): State<AppState>,
    ApiPath((document_id, thread_id)): ApiPath<(String, String)>,
) -> Result<Json<ApiResponse<AskThreadDeleteResultView>>, AppError> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| delete_ask_thread_view(library, &document_id, &thread_id)).await?,
    ))
}
