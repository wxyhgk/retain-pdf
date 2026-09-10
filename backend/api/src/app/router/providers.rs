use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::providers;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/providers/ocr", get(providers::list_ocr_providers))
        .route(
            "/api/v1/providers/mineru/validate-token",
            post(providers::validate_mineru_token),
        )
        .route(
            "/api/v1/providers/paddle/validate-token",
            post(providers::validate_paddle_token),
        )
        .route(
            "/api/v1/providers/deepseek/validate-token",
            post(providers::validate_deepseek_token),
        )
        .route(
            "/api/v1/providers/deepseek/balance",
            post(providers::query_deepseek_balance),
        )
}
