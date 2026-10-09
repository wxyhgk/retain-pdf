use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::sync;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/sync",
            get(sync::get_sync_route).put(sync::update_sync_route),
        )
        .route("/api/v1/sync/run", post(sync::run_sync_route))
        .route("/api/v1/sync/test", post(sync::test_sync_route))
}
