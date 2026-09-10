use crate::error::AppError;
use crate::models::api::{ApiResponse, JobSubmissionView};
use crate::models::request::CreateJobInput;
use crate::routes::job_requests::{parse_ocr_job_request, parse_translate_bundle_request};
use crate::AppState;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde_json::Value;

use crate::routes::common::{
    build_jobs_route_deps, jobs_facade, ok_json, request_base_url, ApiJson, ApiMultipart,
};

pub async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiJson(payload): ApiJson<Value>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let request = CreateJobInput::from_api_value(payload)
        .map_err(|e| AppError::bad_request(format!("invalid job payload: {e}")))?;
    let deps = build_jobs_route_deps(&state);
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps).create_submission(&base_url, &request)?,
    ))
}

pub async fn create_ocr_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiMultipart(mut multipart): ApiMultipart,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let deps = build_jobs_route_deps(&state);
    let parsed = parse_ocr_job_request(&mut multipart, deps.upload_max_bytes).await?;
    let upload = match (parsed.filename, parsed.file_bytes, parsed.developer_mode) {
        (Some(filename), Some(bytes), developer_mode) => Some((filename, bytes, developer_mode)),
        (None, None, _) => None,
        _ => return Err(AppError::bad_request("file upload is incomplete")),
    };
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = jobs_facade(deps)
        .create_ocr_submission(&base_url, &parsed.request, upload)
        .await?;
    Ok(ok_json(view))
}

pub async fn translate_bundle(
    State(state): State<AppState>,
    headers: HeaderMap,
    ApiMultipart(mut multipart): ApiMultipart,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let deps = build_jobs_route_deps(&state);
    let parsed = parse_translate_bundle_request(&mut multipart, deps.upload_max_bytes).await?;
    let base_url = request_base_url(&headers, deps.default_port, &deps.bind_host);
    let view = jobs_facade(deps)
        .create_translation_bundle_submission(
            &base_url,
            parsed.request,
            parsed.filename,
            parsed.file_bytes,
            parsed.developer_mode,
        )
        .await?;
    Ok(ok_json(view))
}
