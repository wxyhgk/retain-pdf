use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_agent_runtime_session_route_deps, ApiJson, ApiPath};
use crate::services::agent_runtime_session_api::{
    clear_agent_runtime_session, get_agent_runtime_session, put_agent_runtime_session,
    AgentRuntimeSessionView, ClearAgentRuntimeSessionInput, PutAgentRuntimeSessionInput,
};
use crate::AppState;

pub async fn get_agent_runtime_session_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
) -> Result<Json<ApiResponse<AgentRuntimeSessionView>>, AppError> {
    let deps = build_agent_runtime_session_route_deps(&state);
    Ok(Json(ApiResponse::ok(get_agent_runtime_session(
        &deps,
        &conversation_id,
    )?)))
}

pub async fn put_agent_runtime_session_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiJson(input): ApiJson<PutAgentRuntimeSessionInput>,
) -> Result<Json<ApiResponse<AgentRuntimeSessionView>>, AppError> {
    let deps = build_agent_runtime_session_route_deps(&state);
    Ok(Json(ApiResponse::ok(put_agent_runtime_session(
        &deps,
        &conversation_id,
        &input,
    )?)))
}

pub async fn clear_agent_runtime_session_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiJson(input): ApiJson<ClearAgentRuntimeSessionInput>,
) -> Result<Json<ApiResponse<AgentRuntimeSessionView>>, AppError> {
    let deps = build_agent_runtime_session_route_deps(&state);
    Ok(Json(ApiResponse::ok(clear_agent_runtime_session(
        &deps,
        &conversation_id,
        &input,
    )?)))
}
