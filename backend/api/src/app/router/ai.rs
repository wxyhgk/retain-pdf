use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::{agent_calculations, ai_proxy, library_extras, public_document_operations};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/ai/ask", post(ai_proxy::ask_proxy))
        .route(
            "/api/v1/ai/runtime-config",
            get(ai_proxy::get_runtime_config_proxy).put(ai_proxy::update_runtime_config_proxy),
        )
        .route(
            "/api/v1/assets",
            post(library_extras::upload_asset_route).layer(DefaultBodyLimit::disable()),
        )
        .route(
            "/api/v1/assets/:asset_id",
            get(library_extras::download_asset_route),
        )
        .route(
            "/api/v1/ai/conversations",
            post(library_extras::create_conversation_route)
                .get(library_extras::list_conversations_route),
        )
        .route(
            "/api/v1/ai/conversations/fork",
            post(library_extras::fork_conversation_route),
        )
        .route(
            "/api/v1/ai/conversations/:conversation_id",
            get(library_extras::get_conversation_route)
                .patch(library_extras::patch_conversation_route)
                .delete(library_extras::delete_conversation_route),
        )
        .route(
            "/api/v1/ai/conversations/:conversation_id/messages",
            post(library_extras::append_message_route),
        )
        .route(
            "/api/v1/ai/conversations/:conversation_id/operations",
            get(public_document_operations::list_public_document_operations_route),
        )
        .route(
            "/api/v1/ai/conversations/:conversation_id/calculations",
            get(agent_calculations::list_agent_calculations_route),
        )
        .route(
            "/api/v1/ai/calculations/:calculation_id",
            get(agent_calculations::get_agent_calculation_route),
        )
        .route(
            "/api/v1/ai/calculations/:calculation_id/artifacts/:artifact_id",
            get(agent_calculations::download_agent_calculation_artifact_route),
        )
        .route(
            "/api/v1/ai/operations/:operation_id",
            get(public_document_operations::get_public_document_operation_route),
        )
        .route(
            "/api/v1/ai/operations/:operation_id/run",
            post(public_document_operations::run_public_document_operation_route),
        )
        .route(
            "/api/v1/ai/operations/:operation_id/retry",
            post(public_document_operations::retry_public_document_operation_route),
        )
        .route(
            "/api/v1/ai/operations/:operation_id/cancel",
            post(public_document_operations::cancel_public_document_operation_route),
        )
        .route(
            "/api/v1/ai/operations/:operation_id/commit",
            post(public_document_operations::commit_public_document_operation_route),
        )
        .route(
            "/api/v1/ai/operations/:operation_id/candidate.pdf",
            get(public_document_operations::download_public_document_operation_candidate_route),
        )
}
