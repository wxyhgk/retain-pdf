use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{build_agent_capability_route_deps, ApiJson};
use crate::services::agent_capability_api::{
    issue_agent_capability, AgentCapabilityIssueInput, AgentCapabilityIssueView,
};
use crate::AppState;

pub async fn issue_agent_capability_route(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<AgentCapabilityIssueInput>,
) -> Result<Json<ApiResponse<AgentCapabilityIssueView>>, AppError> {
    let deps = build_agent_capability_route_deps(&state);
    Ok(Json(ApiResponse::ok(issue_agent_capability(
        deps.db,
        deps.authority,
        &input,
    )?)))
}
