use axum::routing::{delete, get, post};
use axum::Router;

use crate::app::AppState;
use crate::routes::{backups, token_usage};

pub(super) fn routes() -> Router<AppState> {
    Router::new()
        // 模型用量和备份一样是「设置」页的数据；一本书、一个任务的用量挂在各自的路径下。
        .route("/api/v1/usage", get(token_usage::all_usage_route))
        .route("/api/v1/jobs/:job_id/usage", get(token_usage::job_usage_route))
        .route("/api/v1/documents/:document_id/usage", get(token_usage::document_usage_route))
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
