use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;

use crate::auth::Principal;
use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobListView, ListJobEventsQuery, ListJobsQuery,
};
use crate::models::domain::WorkflowKind;
use crate::AppState;

use crate::routes::common::{
    build_jobs_query_route_deps, ok_json, request_base_url, run_job_query, run_job_query_once,
    ApiPath, ApiQuery,
};

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

pub async fn list_ocr_jobs(
    State(state): State<AppState>,
    principal: Principal,
    headers: HeaderMap,
    ApiQuery(mut query): ApiQuery<ListJobsQuery>,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    query.workflow = Some(WorkflowKind::Ocr);
    list_jobs(State(state), principal, headers, ApiQuery(query)).await
}

pub async fn get_ocr_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, format!("ocr:detail:{job_id}"), move |jobs| {
        jobs.job_detail_view(&base_url, &job_id, true)
    })
    .await?;
    Ok(ok_json(view))
}

pub async fn get_ocr_job_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    let key = format!(
        "events:ocr:{job_id}:{:?}:{}:{:?}",
        query.start, query.limit, query.cursor
    );
    Ok(ok_json(
        run_job_query(&state, key, move |jobs| {
            jobs.job_events_view(&job_id, &query, true)
        })
        .await?,
    ))
}

pub async fn get_ocr_job_artifacts(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, format!("ocr:artifacts:{job_id}"), move |jobs| {
        jobs.job_artifacts_view(&base_url, &job_id, true)
    })
    .await?;
    Ok(ok_json(view))
}

pub async fn get_ocr_job_artifacts_manifest(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, format!("ocr:manifest:{job_id}"), move |jobs| {
        jobs.job_artifact_manifest_view(&base_url, &job_id, true)
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
        jobs.job_detail_view(&base_url, &job_id, false)
    })
    .await?;
    Ok(ok_json(view))
}

pub async fn get_job_events(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(query): ApiQuery<ListJobEventsQuery>,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    let key = format!(
        "events:all:{job_id}:{:?}:{}:{:?}",
        query.start, query.limit, query.cursor
    );
    Ok(ok_json(
        run_job_query(&state, key, move |jobs| {
            jobs.job_events_view(&job_id, &query, false)
        })
        .await?,
    ))
}

pub async fn get_job_artifacts(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, format!("jobs:artifacts:{job_id}"), move |jobs| {
        jobs.job_artifacts_view(&base_url, &job_id, false)
    })
    .await?;
    Ok(ok_json(view))
}

pub async fn get_job_artifacts_manifest(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    let deps = build_jobs_query_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = run_job_query_once(&state, format!("jobs:manifest:{job_id}"), move |jobs| {
        jobs.job_artifact_manifest_view(&base_url, &job_id, false)
    })
    .await?;
    Ok(ok_json(view))
}
