use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, JobDiagnosticsView, JobResumePlanView};

use crate::routes::common::{jobs_facade, ok_json, JobsRouteDeps};

pub fn job_diagnostics_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
) -> Result<Json<ApiResponse<JobDiagnosticsView>>, AppError> {
    Ok(ok_json(jobs_facade(deps).job_diagnostics_view(job_id)?))
}

pub fn resume_plan_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
) -> Result<Json<ApiResponse<JobResumePlanView>>, AppError> {
    Ok(ok_json(jobs_facade(deps).resume_plan_view(job_id)?))
}
