use axum::routing::{delete, get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::backups;

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/backups",
            get(backups::list_backups_route).post(backups::create_backup_route),
        )
        .route("/api/v1/backups/:backup_id", delete(backups::delete_backup_route))
        .route(
            "/api/v1/backups/:backup_id/restore",
            post(backups::restore_backup_route),
        )
}
