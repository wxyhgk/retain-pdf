use axum::extract::DefaultBodyLimit;
use axum::routing::post;
use axum::Router;

use crate::app::AppState;
use crate::routes::jobs;

pub(super) fn routes() -> Router<AppState> {
    Router::new().route(
        "/api/v1/translate/bundle",
        post(jobs::translate_bundle).layer(DefaultBodyLimit::disable()),
    )
}
