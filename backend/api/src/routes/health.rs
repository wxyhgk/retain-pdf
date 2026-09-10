use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;

use crate::models::api::ApiResponse;
use crate::routes::common::build_health_route_deps;
use crate::services::health_api::{
    build_current_readiness_view, build_health_view, HealthView, ReadinessView,
};
use crate::AppState;

pub async fn health(State(state): State<AppState>) -> Json<ApiResponse<HealthView>> {
    let deps = build_health_route_deps(&state);
    Json(ApiResponse::ok(build_health_view(&deps)))
}

pub async fn ready(
    State(state): State<AppState>,
) -> (StatusCode, Json<ApiResponse<ReadinessView>>) {
    let deps = build_health_route_deps(&state);
    let view = build_current_readiness_view(&deps);
    let status = if view.is_ready() {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(ApiResponse::ok(view)))
}
