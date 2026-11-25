use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::run_fonts_blocking;
use crate::services::platform::{self, FontInfo};
use crate::AppState;

/// GET /api/v1/fonts —— 排版能用的字体。上传字体 `POST /fonts/upload` 2026-11-25 删了（没有调用方）。
pub async fn list_fonts(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<FontInfo>>>, AppError> {
    let fonts = run_fonts_blocking(&state, |font_api| Ok(platform::list_fonts(font_api))).await?;
    Ok(Json(ApiResponse::ok(fonts)))
}
