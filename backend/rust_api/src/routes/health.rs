use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::models::ApiResponse;
use crate::models::JobStatusKind;
use crate::AppState;

#[derive(Serialize)]
pub struct HealthData {
    pub status: &'static str,
    pub db: &'static str,
    pub queue_depth: i64,
    pub running_jobs: i64,
    pub provider_backends: Vec<&'static str>,
    pub time: String,
}

pub async fn health(State(state): State<AppState>) -> Json<ApiResponse<HealthData>> {
    let db_ok = state.db.ping().is_ok();
    let queued = state
        .db
        .count_jobs_with_status(&JobStatusKind::Queued)
        .unwrap_or(0);
    let running = state
        .db
        .count_jobs_with_status(&JobStatusKind::Running)
        .unwrap_or(0);
    Json(ApiResponse::ok(HealthData {
        status: if db_ok { "up" } else { "degraded" },
        db: if db_ok { "ok" } else { "error" },
        queue_depth: queued,
        running_jobs: running,
        provider_backends: vec!["mineru"],
        time: crate::models::now_iso(),
    }))
}
