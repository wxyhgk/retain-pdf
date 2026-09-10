use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::{
    agent_calculations, agent_capabilities, agent_runtime_sessions, document_operations,
};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/internal/agent/capabilities",
            post(agent_capabilities::issue_agent_capability_route),
        )
        .route(
            "/api/v1/internal/agent/operations",
            post(document_operations::create_document_operation_route),
        )
        .route(
            "/api/v1/internal/agent/operations/:operation_id",
            get(document_operations::get_document_operation_route),
        )
        .route(
            "/api/v1/internal/agent/operations/:operation_id/run",
            post(document_operations::run_document_operation_route),
        )
        .route(
            "/api/v1/internal/agent/operations/:operation_id/commit",
            post(document_operations::commit_document_operation_route),
        )
        .route(
            "/api/v1/internal/agent/operations/:operation_id/cancel",
            post(document_operations::cancel_document_operation_route),
        )
        .route(
            "/api/v1/internal/agent/calculations",
            post(agent_calculations::create_agent_calculation_route),
        )
        .route(
            "/api/v1/internal/agent/calculations/:calculation_id/complete",
            post(agent_calculations::complete_agent_calculation_route),
        )
        .route(
            "/api/v1/internal/agent/calculations/:calculation_id/fail",
            post(agent_calculations::fail_agent_calculation_route),
        )
        .route(
            "/api/v1/internal/agent/runtime-sessions/:conversation_id",
            get(agent_runtime_sessions::get_agent_runtime_session_route)
                .put(agent_runtime_sessions::put_agent_runtime_session_route)
                .delete(agent_runtime_sessions::clear_agent_runtime_session_route),
        )
}
