//! 按需下载的字体、Typst：设置页看下载进度、手动重试。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::build_runtime_assets_route_deps;
use crate::services::platform::{self, RuntimeAssetsView};
use crate::AppState;

pub async fn get_runtime_assets(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<RuntimeAssetsView>>, AppError> {
    let deps = build_runtime_assets_route_deps(&state);
    let view = tokio::task::spawn_blocking(move || platform::runtime_assets_view(&deps.api()))
        .await
        .map_err(|_| AppError::internal("runtime assets status failed"))?;
    Ok(Json(ApiResponse::ok(view)))
}

pub async fn download_runtime_assets(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<RuntimeAssetsView>>, AppError> {
    let deps = build_runtime_assets_route_deps(&state);
    Ok(Json(ApiResponse::ok(platform::start_runtime_assets_download(&deps.api()))))
}
