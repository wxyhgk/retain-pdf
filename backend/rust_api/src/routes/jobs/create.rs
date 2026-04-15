use crate::error::AppError;
use crate::models::{ApiResponse, CreateJobInput, JobStatusKind, JobSubmissionView};
use crate::routes::job_helpers::{build_submission_view, request_base_url, stream_file};
use crate::routes::job_requests::{parse_ocr_job_request, parse_translate_bundle_request};
use crate::services::artifacts::attach_job_id_header;
use crate::services::jobs::{
    build_translation_bundle_artifact, create_ocr_job_from_upload, create_translation_job,
    UploadedPdfInput,
};
use crate::AppState;
use axum::extract::{Multipart, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use serde_json::Value;

pub async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let request = CreateJobInput::from_api_value(payload)
        .map_err(|e| AppError::bad_request(format!("invalid job payload: {e}")))?;
    let workflow = request.workflow.clone();
    let job = create_translation_job(&state, &request)?;
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_submission_view(
        &job,
        JobStatusKind::Queued,
        workflow,
        &base_url,
    ))))
}

pub async fn create_ocr_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let parsed = parse_ocr_job_request(&mut multipart).await?;
    let upload = match (parsed.filename, parsed.file_bytes, parsed.developer_mode) {
        (Some(filename), Some(bytes), developer_mode) => Some(UploadedPdfInput {
            filename,
            bytes,
            developer_mode,
        }),
        (None, None, _) => None,
        _ => return Err(AppError::bad_request("file upload is incomplete")),
    };

    let job = create_ocr_job_from_upload(&state, &parsed.request, upload).await?;
    let base_url = request_base_url(&headers, &state);
    Ok(Json(ApiResponse::ok(build_submission_view(
        &job,
        JobStatusKind::Queued,
        crate::models::WorkflowKind::Ocr,
        &base_url,
    ))))
}

pub async fn translate_bundle(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Response, AppError> {
    let parsed = parse_translate_bundle_request(&mut multipart).await?;
    let bundle = build_translation_bundle_artifact(
        &state,
        parsed.request,
        UploadedPdfInput {
            filename: parsed.filename,
            bytes: parsed.file_bytes,
            developer_mode: parsed.developer_mode,
        },
    )
    .await?;
    let mut response = stream_file(
        bundle.zip_path,
        "application/zip",
        Some(format!("{}.zip", bundle.job_id)),
    )
    .await?;
    attach_job_id_header(&mut response, &bundle.job_id)?;
    Ok(response)
}
