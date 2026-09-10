use axum::routing::get;
use axum::Router;

use crate::app::AppState;
use crate::routes::common::method_not_allowed;
use crate::routes::health;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::health))
        .route("/ready", get(health::ready))
        .method_not_allowed_fallback(method_not_allowed)
}
