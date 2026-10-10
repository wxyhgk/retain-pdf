use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::common::method_not_allowed;
use crate::routes::{accounts, health};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::health))
        .route("/ready", get(health::ready))
        // 不需要登录：前端先问「现在是什么模式、登没登录」，再决定显示登录页。
        .route("/api/v1/auth/session", get(accounts::session_route))
        .route("/api/v1/auth/login", post(accounts::login_route))
        .method_not_allowed_fallback(method_not_allowed)
}
