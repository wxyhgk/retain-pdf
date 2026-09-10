use axum::Json;

use crate::models::api::ApiResponse;

pub fn ok_json<T>(value: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse::ok(value))
}
