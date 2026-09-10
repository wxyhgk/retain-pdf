use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::fonts;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/fonts", get(fonts::list_fonts))
        .route(
            "/api/v1/fonts/upload",
            post(fonts::upload_font).layer(DefaultBodyLimit::disable()),
        )
}
