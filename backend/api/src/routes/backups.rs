//! 数据库备份:查看、立即备份、恢复、删除。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, BackupItemView, BackupRestoreView, BackupStatusView};
use crate::routes::common::{build_backup_route_deps, ok_json, ApiPath};
use crate::services::backup::api::{
    backup_status_view, create_backup_view, delete_backup_view, restore_backup_view,
};
use crate::AppState;

pub async fn list_backups_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<BackupStatusView>>, AppError> {
    let deps = build_backup_route_deps(&state);
    Ok(ok_json(backup_status_view(&deps)?))
}

pub async fn create_backup_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<BackupItemView>>, AppError> {
    let deps = build_backup_route_deps(&state);
    Ok(ok_json(create_backup_view(&deps).await?))
}

pub async fn restore_backup_route(
    State(state): State<AppState>,
    ApiPath(backup_id): ApiPath<String>,
) -> Result<Json<ApiResponse<BackupRestoreView>>, AppError> {
    let deps = build_backup_route_deps(&state);
    Ok(ok_json(restore_backup_view(&deps, &backup_id).await?))
}

pub async fn delete_backup_route(
    State(state): State<AppState>,
    ApiPath(backup_id): ApiPath<String>,
) -> Result<Json<ApiResponse<BackupStatusView>>, AppError> {
    let deps = build_backup_route_deps(&state);
    Ok(ok_json(delete_backup_view(&deps, &backup_id).await?))
}
