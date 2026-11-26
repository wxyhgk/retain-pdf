//! 阅读页提问的主对话、副对话和记忆（2026-11-26，数据库 v40）。业务逻辑在书库包的 `ask_conversations.rs`、`ask_memories.rs`。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    AppendAskMessagesInput, AppendAskMessagesView, ApiResponse, AskContextQuery, AskContextView, AskConversationDeleteResultView,
    AskConversationListView, AskConversationRecord, AskMemoryCreatedView, AskMemoryListView, AskMemoryRecord, AskMessagePageView,
    CloseAskConversationInput, CloseAskConversationView, CreateAskMemoryInput, CreateAskSideConversationInput,
    DocumentAskMessagesView, ListAskConversationsQuery, ListAskMemoriesQuery, ListAskMessagesQuery, PatchAskConversationInput,
    PatchAskMemoryInput, AskSettingsRecord, PatchAskSettingsInput, AskCompactionListView, CreateAskCompactionInput,
    CreateAskCompactionView,
};
use crate::routes::common::{ask_summarizer, ok_json, run_library_blocking, ApiJson, ApiPath, ApiQuery};
use crate::services::library::{
    append_ask_messages_view, ask_context_view, close_ask_conversation_view, create_ask_memory_view,
    create_side_ask_conversation_view, delete_ask_conversation_view, delete_ask_memory_view, document_ask_messages_view,
    ensure_main_ask_conversation_view, get_ask_conversation_view, list_ask_conversations_view, list_ask_memories_view,
    list_ask_messages_view, patch_ask_conversation_view, patch_ask_memory_view, get_ask_settings_view, patch_ask_settings_view,
    create_ask_compaction_view, list_ask_compactions_view,
};
use crate::AppState;

type Reply<T> = Result<Json<ApiResponse<T>>, AppError>;

pub async fn ensure_main_conversation_route(State(state): State<AppState>) -> Reply<AskConversationRecord> {
    Ok(ok_json(run_library_blocking(&state, ensure_main_ask_conversation_view).await?))
}

pub async fn list_conversations_route(
    State(state): State<AppState>,
    ApiQuery(query): ApiQuery<ListAskConversationsQuery>,
) -> Reply<AskConversationListView> {
    Ok(ok_json(run_library_blocking(&state, move |library| list_ask_conversations_view(library, &query)).await?))
}

pub async fn create_side_conversation_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<CreateAskSideConversationInput>,
) -> Reply<AskConversationRecord> {
    Ok(ok_json(run_library_blocking(&state, move |library| create_side_ask_conversation_view(library, &payload)).await?))
}

pub async fn get_conversation_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
) -> Reply<AskConversationRecord> {
    Ok(ok_json(run_library_blocking(&state, move |library| get_ask_conversation_view(library, &conversation_id)).await?))
}

pub async fn patch_conversation_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchAskConversationInput>,
) -> Reply<AskConversationRecord> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| patch_ask_conversation_view(library, &conversation_id, &payload)).await?,
    ))
}

pub async fn delete_conversation_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
) -> Reply<AskConversationDeleteResultView> {
    Ok(ok_json(run_library_blocking(&state, move |library| delete_ask_conversation_view(library, &conversation_id)).await?))
}

pub async fn close_conversation_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiJson(payload): ApiJson<CloseAskConversationInput>,
) -> Reply<CloseAskConversationView> {
    let summarize = ask_summarizer(&state);
    Ok(ok_json(
        run_library_blocking(&state, move |library| close_ask_conversation_view(library, &conversation_id, &payload, &summarize))
            .await?,
    ))
}

pub async fn create_compaction_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiJson(payload): ApiJson<CreateAskCompactionInput>,
) -> Reply<CreateAskCompactionView> {
    let summarize = ask_summarizer(&state);
    Ok(ok_json(
        run_library_blocking(&state, move |library| create_ask_compaction_view(library, &conversation_id, &payload, &summarize))
            .await?,
    ))
}

pub async fn list_compactions_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
) -> Reply<AskCompactionListView> {
    Ok(ok_json(run_library_blocking(&state, move |library| list_ask_compactions_view(library, &conversation_id)).await?))
}

pub async fn list_messages_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListAskMessagesQuery>,
) -> Reply<AskMessagePageView> {
    Ok(ok_json(run_library_blocking(&state, move |library| list_ask_messages_view(library, &conversation_id, &query)).await?))
}

pub async fn append_messages_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiJson(payload): ApiJson<AppendAskMessagesInput>,
) -> Reply<AppendAskMessagesView> {
    Ok(ok_json(
        run_library_blocking(&state, move |library| append_ask_messages_view(library, &conversation_id, &payload)).await?,
    ))
}

pub async fn context_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<AskContextQuery>,
) -> Reply<AskContextView> {
    Ok(ok_json(run_library_blocking(&state, move |library| ask_context_view(library, &conversation_id, &query)).await?))
}

pub async fn document_ask_messages_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
) -> Reply<DocumentAskMessagesView> {
    Ok(ok_json(run_library_blocking(&state, move |library| document_ask_messages_view(library, &document_id)).await?))
}

pub async fn list_memories_route(
    State(state): State<AppState>,
    ApiQuery(query): ApiQuery<ListAskMemoriesQuery>,
) -> Reply<AskMemoryListView> {
    Ok(ok_json(run_library_blocking(&state, move |library| list_ask_memories_view(library, &query)).await?))
}

pub async fn create_memory_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<CreateAskMemoryInput>,
) -> Reply<AskMemoryCreatedView> {
    Ok(ok_json(run_library_blocking(&state, move |library| create_ask_memory_view(library, &payload)).await?))
}

pub async fn patch_memory_route(
    State(state): State<AppState>,
    ApiPath(memory_id): ApiPath<String>,
    ApiJson(payload): ApiJson<PatchAskMemoryInput>,
) -> Reply<AskMemoryRecord> {
    Ok(ok_json(run_library_blocking(&state, move |library| patch_ask_memory_view(library, &memory_id, &payload)).await?))
}

pub async fn delete_memory_route(
    State(state): State<AppState>,
    ApiPath(memory_id): ApiPath<String>,
) -> Reply<AskMemoryRecord> {
    Ok(ok_json(run_library_blocking(&state, move |library| delete_ask_memory_view(library, &memory_id)).await?))
}

pub async fn get_settings_route(State(state): State<AppState>) -> Reply<AskSettingsRecord> {
    Ok(ok_json(run_library_blocking(&state, get_ask_settings_view).await?))
}

pub async fn patch_settings_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<PatchAskSettingsInput>,
) -> Reply<AskSettingsRecord> {
    Ok(ok_json(run_library_blocking(&state, move |library| patch_ask_settings_view(library, &payload)).await?))
}
