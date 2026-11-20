//! 报告：跑完结果怎么样（`/jobs/:id/reports/…`）。质量、翻译质检和诊断、排版缩放、精修、失败原因、模型用量。
//! 读的大多是任务目录里的报告文件，放到阻塞线程里做。

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{ApiResponse, JobDiagnosticsView, JobReportView, TranslationDiagnosticsView};
use crate::routes::common::{
    build_jobs_query_route_deps, build_quality_route_deps, build_usage_route_deps, ok_json,
    run_state_blocking, ApiPath,
};
use crate::services::jobs::{job_usage_view, quality_summary_view, QualitySummaryView, UsageSummaryView};
use crate::AppState;

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("report task failed"))?
}

/// 质量体检卡：报告的摘要，不用把整份报告拉下来。
pub async fn quality_summary_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<QualitySummaryView>>, AppError> {
    let deps = build_quality_route_deps(&state);
    Ok(ok_json(blocking(move || quality_summary_view(&deps, &job_id)).await?))
}

/// 失败原因。
pub async fn get_job_diagnostics(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobDiagnosticsView>>, AppError> {
    run_state_blocking(&state, "job diagnostics", move |state| {
        let deps = build_jobs_query_route_deps(state);
        Ok(ok_json(deps.jobs.job_diagnostics_view(&job_id)?))
    })
    .await
}

pub async fn get_translation_diagnostics(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    _headers: HeaderMap,
) -> Result<Json<ApiResponse<TranslationDiagnosticsView>>, AppError> {
    run_state_blocking(&state, "translation diagnostics", move |state| {
        let deps = build_jobs_query_route_deps(state);
        Ok(ok_json(deps.jobs.translation_diagnostics_view(&job_id)?))
    })
    .await
}

pub async fn get_translation_qa(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobReportView>>, AppError> {
    run_state_blocking(&state, "translation qa", move |state| {
        let deps = build_jobs_query_route_deps(state);
        Ok(ok_json(deps.jobs.translation_qa_view(&job_id)?))
    })
    .await
}

pub async fn get_fit_report(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobReportView>>, AppError> {
    run_state_blocking(&state, "fit report", move |state| {
        let deps = build_jobs_query_route_deps(state);
        Ok(ok_json(deps.jobs.fit_report_view(&job_id)?))
    })
    .await
}

pub async fn get_refine_report(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobReportView>>, AppError> {
    run_state_blocking(&state, "refine report", move |state| {
        let deps = build_jobs_query_route_deps(state);
        Ok(ok_json(deps.jobs.refine_report_view(&job_id)?))
    })
    .await
}

/// 这个任务自己的模型用量（token、估算花费），不含同一本书的其它任务。
pub async fn job_usage_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let deps = build_usage_route_deps(&state);
    Ok(ok_json(blocking(move || job_usage_view(&deps, &job_id)).await?))
}
