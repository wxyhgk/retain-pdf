//! 多设备同步:查看状态、改设置、立即同步。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, SyncSettingsInput, SyncStatusView};
use crate::routes::common::{build_sync_route_deps, ok_json, ApiJson};
use crate::services::sync::api::{run_sync_now_view, sync_status_view, update_sync_settings_view};
use crate::AppState;

pub async fn get_sync_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<SyncStatusView>>, AppError> {
    let deps = build_sync_route_deps(&state);
    Ok(ok_json(sync_status_view(&deps)?))
}

pub async fn update_sync_route(
    State(state): State<AppState>,
    ApiJson(payload): ApiJson<SyncSettingsInput>,
) -> Result<Json<ApiResponse<SyncStatusView>>, AppError> {
    let deps = build_sync_route_deps(&state);
    Ok(ok_json(update_sync_settings_view(&deps, &payload)?))
}

pub async fn run_sync_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<SyncStatusView>>, AppError> {
    let deps = build_sync_route_deps(&state);
    Ok(ok_json(run_sync_now_view(&deps).await?))
}
