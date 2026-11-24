//! 任务本身：有哪些任务、建一个、看一个、删一个（`/jobs`、`/jobs/:id`）。
//!
//! 建任务内部都走 services::jobs 的 `submit_job`。

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, DeleteJobQuery, JobDeleteResultView, JobDetailView, JobListView, JobSubmissionView,
    ListJobsQuery,
};
use crate::models::request::CreateJobInput;
use crate::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde_json::Value;

use crate::routes::common::{
    build_job_deletion, build_jobs_query_route_deps, build_jobs_route_deps, jobs_facade, ok_json,
    request_base_url, run_job_query_once, run_state_blocking, ApiJson, ApiPath, ApiQuery,
};

pub async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiJson(payload): ApiJson<Value>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let request = CreateJobInput::from_api_value(payload)
        .map_err(|error| AppError::invalid_json_body("invalid job payload", &error))?;
    // 读上传、写库、建目录都是同步的。
    run_state_blocking(&state, "job creation", move |state| {
        let deps = build_jobs_route_deps(state);
        let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
        Ok(ok_json(
            jobs_facade(deps).create_submission(&base_url, &request)?,
        ))
    })
    .await
}

pub async fn list_jobs(
    State(state): State<AppState>,
    principal: Principal,
    headers: HeaderMap,
    ApiQuery(mut query): ApiQuery<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    query.owner = principal.owner_filter().map(str::to_string);
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, "jobs:list".into(), move |jobs| {
        jobs.list_jobs_view(&base_url, &query)
    })
    .await?;
    Ok(ok_json(view))
}

pub async fn get_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, format!("jobs:detail:{job_id}"), move |jobs| {
        jobs.job_detail_view(&base_url, &job_id)
    })
    .await?;
    Ok(ok_json(view))
}

/// 删一个任务（任何工作流，OCR 任务也行）和它的 `-ocr` 子任务，书留着。书架删除的旧地址
/// `DELETE /library/books/:job_id` 2026-10-22 删了。
pub async fn delete_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<DeleteJobQuery>,
) -> Result<Json<ApiResponse<JobDeleteResultView>>, AppError> {
    let force = query.force;
    if force {
        // 强删运行中的任务：先走取消的同一条路径（登记取消 + 终止 worker），再删。
        let lookup = job_id.clone();
        let job_ids = run_state_blocking(&state, "job deletion", move |state| {
            build_job_deletion(state).job_ids(&lookup)
        })
        .await?;
        jobs_facade(build_jobs_route_deps(&state))
            .cancel_before_delete(&job_ids)
            .await;
    }
    // 删库里的行和整个任务目录，大任务要一会儿。
    run_state_blocking(&state, "job deletion", move |state| {
        Ok(ok_json(build_job_deletion(state).delete(&job_id, force)?))
    })
    .await
}
