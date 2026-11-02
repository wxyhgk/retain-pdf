//! 操作：能对任务做什么、去做（`/jobs/:id/actions/…`）。取消、重跑、续跑、重试某一阶段、OCR 拿不准时由用户选。

use axum::body::Bytes;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::Deserialize;
use serde_json::Value;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, JobResumePlanView, JobSubmissionView, OcrAmbiguityResolutionRequest,
    OcrAmbiguityResolutionView, RetryStageRequest, RetryStageSubmissionView, StageActionsView,
};
use crate::AppState;

use crate::routes::common::{
    build_jobs_query_route_deps, build_jobs_route_deps, jobs_facade, ok_json, request_base_url,
    run_state_blocking, ApiJson, ApiPath, JobsRouteDeps,
};

pub async fn get_stage_actions(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<StageActionsView>>, AppError> {
    run_state_blocking(&state, "job actions", move |state| {
        stage_actions_response(build_jobs_route_deps(state), &headers, &job_id)
    })
    .await
}

pub async fn resume_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let overrides = parse_rerun_overrides(&body)?;
    run_state_blocking(&state, "job resume", move |state| {
        resume_job_response(build_jobs_route_deps(state), &headers, &job_id, &overrides)
    })
    .await
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
struct RerunRequest {
    #[serde(default)]
    overrides: Value,
}

/// 续跑的请求体可以不带（以前一直是空的）。带的话只接受换模型 key：
/// `{"overrides": {"translation": {"api_key" | "credential_ref" | "reviewer_api_key" | "reviewer_credential_ref"}}}`
/// ——换了 key 之后续跑要用新 key，其它设置一律沿用原任务。
fn parse_rerun_overrides(body: &[u8]) -> Result<Value, AppError> {
    if body.iter().all(u8::is_ascii_whitespace) {
        return Ok(Value::Null);
    }
    let request: RerunRequest = serde_json::from_slice(body)
        .map_err(|error| AppError::bad_request(format!("invalid rerun request: {error}")))?;
    const ALLOWED: [&str; 4] = ["api_key", "credential_ref", "reviewer_api_key", "reviewer_credential_ref"];
    match &request.overrides {
        Value::Null => {}
        Value::Object(sections) => {
            for (section, value) in sections {
                let fields = value.as_object().filter(|_| section == "translation").ok_or_else(|| {
                    AppError::bad_request(format!("rerun overrides only accept translation keys, got {section}"))
                })?;
                if let Some(field) = fields.keys().find(|field| !ALLOWED.contains(&field.as_str())) {
                    return Err(AppError::bad_request(format!(
                        "rerun overrides only accept translation.{{{}}}, got translation.{field}",
                        ALLOWED.join(",")
                    )));
                }
                let given = |key: &str| fields.get(key).and_then(Value::as_str).is_some_and(|v| !v.trim().is_empty());
                for (inline, reference) in [("api_key", "credential_ref"), ("reviewer_api_key", "reviewer_credential_ref")] {
                    if given(inline) && given(reference) {
                        return Err(AppError::bad_request(format!(
                            "translation.{inline} and translation.{reference} are mutually exclusive"
                        )));
                    }
                }
            }
        }
        _ => return Err(AppError::bad_request("rerun overrides must be an object")),
    }
    Ok(request.overrides)
}

pub async fn retry_stage(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
    ApiJson(request): ApiJson<RetryStageRequest>,
) -> Result<Json<ApiResponse<RetryStageSubmissionView>>, AppError> {
    run_state_blocking(&state, "job stage retry", move |state| {
        retry_stage_response(build_jobs_route_deps(state), &headers, &job_id, request)
    })
    .await
}

pub async fn resolve_ocr_ambiguity(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
    ApiJson(request): ApiJson<OcrAmbiguityResolutionRequest>,
) -> Result<Json<ApiResponse<OcrAmbiguityResolutionView>>, AppError> {
    run_state_blocking(&state, "ocr ambiguity resolution", move |state| {
        resolve_ocr_ambiguity_response(build_jobs_route_deps(state), &headers, &job_id, request)
    })
    .await
}

pub async fn get_resume_plan(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<JobResumePlanView>>, AppError> {
    run_state_blocking(&state, "job resume plan", move |state| {
        let deps = build_jobs_query_route_deps(state);
        Ok(ok_json(deps.jobs.resume_plan_view(&job_id)?))
    })
    .await
}

pub async fn cancel_job(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    cancel_job_response(build_jobs_route_deps(&state), &headers, &job_id).await
}

fn stage_actions_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Json<ApiResponse<StageActionsView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).stage_actions_view(&base_url, job_id)?,
    ))
}

async fn cancel_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps)
            .cancel_submission(&base_url, job_id)
            .await?,
    ))
}

fn resume_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    overrides: &serde_json::Value,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).rerun_submission(&base_url, job_id, overrides)?,
    ))
}

fn retry_stage_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    request: RetryStageRequest,
) -> Result<Json<ApiResponse<RetryStageSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).retry_stage_submission(&base_url, job_id, request)?,
    ))
}

fn resolve_ocr_ambiguity_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    request: OcrAmbiguityResolutionRequest,
) -> Result<Json<ApiResponse<OcrAmbiguityResolutionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).resolve_ocr_ambiguity_submission(&base_url, job_id, request)?,
    ))
}
