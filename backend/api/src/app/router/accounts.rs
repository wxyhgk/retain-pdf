use axum::routing::{get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::accounts;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/logout", post(accounts::logout_route))
        .route("/api/v1/auth/password", post(accounts::change_password_route))
        .route(
            "/api/v1/admin/users",
            get(accounts::list_users_route).post(accounts::create_user_route),
        )
        .route("/api/v1/admin/users/:user_id/reset-password", post(accounts::reset_password_route))
        .route("/api/v1/admin/users/:user_id/disable", post(accounts::disable_user_route))
        .route("/api/v1/admin/users/:user_id/enable", post(accounts::enable_user_route))
        .route(
            "/api/v1/admin/users/:user_id/pages",
            get(accounts::user_pages_route).post(accounts::grant_pages_route),
        )
        .route("/api/v1/account/pages", get(accounts::my_pages_route))
}
