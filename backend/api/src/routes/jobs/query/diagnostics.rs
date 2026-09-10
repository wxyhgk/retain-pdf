use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, JobDiagnosticsView, JobResumePlanView};
use crate::AppState;

use super::super::json_response::{job_diagnostics_response, resume_plan_response};
use crate::routes::common::{build_jobs_route_deps, ApiPath};

pub async fn get_job_diagnostics(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobDiagnosticsView>>, AppError> {
    job_diagnostics_response(build_jobs_route_deps(&state), &job_id)
}

pub async fn get_resume_plan(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobResumePlanView>>, AppError> {
    resume_plan_response(build_jobs_route_deps(&state), &job_id)
}
