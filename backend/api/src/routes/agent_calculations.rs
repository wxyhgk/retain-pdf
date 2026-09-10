use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_agent_calculation_route_deps, ApiJson, ApiPath, ApiQuery};
use crate::routes::job_helpers::stream_file;
use crate::services::agent_calculations::api::{
    agent_calculation_artifact_download, complete_agent_calculation, create_agent_calculation,
    fail_agent_calculation, get_agent_calculation, list_agent_calculations,
    AgentCalculationListQuery, AgentCalculationListView, AgentCalculationView,
    CompleteAgentCalculationInput, CreateAgentCalculationInput, FailAgentCalculationInput,
};
use crate::AppState;

pub async fn create_agent_calculation_route(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<CreateAgentCalculationInput>,
) -> Result<Json<ApiResponse<AgentCalculationView>>, AppError> {
    let deps = build_agent_calculation_route_deps(&state);
    Ok(Json(ApiResponse::ok(create_agent_calculation(
        &deps, &input,
    )?)))
}

pub async fn complete_agent_calculation_route(
    State(state): State<AppState>,
    ApiPath(calculation_id): ApiPath<String>,
    ApiJson(input): ApiJson<CompleteAgentCalculationInput>,
) -> Result<Json<ApiResponse<AgentCalculationView>>, AppError> {
    let deps = build_agent_calculation_route_deps(&state);
    Ok(Json(ApiResponse::ok(complete_agent_calculation(
        &deps,
        &calculation_id,
        &input,
    )?)))
}

pub async fn fail_agent_calculation_route(
    State(state): State<AppState>,
    ApiPath(calculation_id): ApiPath<String>,
    ApiJson(input): ApiJson<FailAgentCalculationInput>,
) -> Result<Json<ApiResponse<AgentCalculationView>>, AppError> {
    let deps = build_agent_calculation_route_deps(&state);
    Ok(Json(ApiResponse::ok(fail_agent_calculation(
        &deps,
        &calculation_id,
        &input,
    )?)))
}

pub async fn list_agent_calculations_route(
    State(state): State<AppState>,
    ApiPath(conversation_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<AgentCalculationListQuery>,
) -> Result<Json<ApiResponse<AgentCalculationListView>>, AppError> {
    let deps = build_agent_calculation_route_deps(&state);
    Ok(Json(ApiResponse::ok(list_agent_calculations(
        &deps,
        &conversation_id,
        &query,
    )?)))
}

pub async fn get_agent_calculation_route(
    State(state): State<AppState>,
    ApiPath(calculation_id): ApiPath<String>,
) -> Result<Json<ApiResponse<AgentCalculationView>>, AppError> {
    let deps = build_agent_calculation_route_deps(&state);
    Ok(Json(ApiResponse::ok(get_agent_calculation(
        &deps,
        &calculation_id,
    )?)))
}

pub async fn download_agent_calculation_artifact_route(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiPath((calculation_id, artifact_id)): ApiPath<(String, String)>,
) -> Result<Response, AppError> {
    let deps = build_agent_calculation_route_deps(&state);
    let artifact = agent_calculation_artifact_download(&deps, &calculation_id, &artifact_id)?;
    stream_file(artifact.path, &artifact.mime_type, None, Some(&headers)).await
}
