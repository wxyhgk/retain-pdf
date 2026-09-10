use axum::routing::get;
use axum::Router;

use crate::app::AppState;
use crate::routes::credentials;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/credentials",
            get(credentials::list_credentials_route).post(credentials::create_credential_route),
        )
        .route(
            "/api/v1/credentials/:credential_ref",
            get(credentials::get_credential_route)
                .put(credentials::update_credential_route)
                .delete(credentials::delete_credential_route),
        )
}
