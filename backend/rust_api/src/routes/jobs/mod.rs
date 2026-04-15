use crate::error::AppError;
use crate::models::{
    ApiResponse, ArtifactLinksView, JobDetailView, JobStatusKind, JobSubmissionView,
};
use crate::routes::job_helpers::{build_submission_view, request_base_url, stream_file};
use crate::services::jobs::{build_job_artifact_links_view, build_job_detail_view};
use crate::AppState;
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;

mod control;
mod create;
mod download;
mod query;

pub use control::{cancel_job, cancel_ocr_job};
pub use create::{create_job, create_ocr_job, translate_bundle};
pub use download::{
    download_artifact_by_key, download_bundle, download_markdown, download_markdown_image,
    download_normalization_report, download_normalized_document, download_ocr_artifact_by_key,
    download_ocr_normalization_report, download_ocr_normalized_document, download_pdf,
};
pub use query::{
    get_job, get_job_artifacts, get_job_artifacts_manifest, get_job_events, get_ocr_job,
    get_ocr_job_artifacts, get_ocr_job_artifacts_manifest, get_ocr_job_events, list_jobs,
    list_ocr_jobs,
};

fn build_job_detail_response(
    state: &AppState,
    headers: &HeaderMap,
    job: &crate::models::JobSnapshot,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let base_url = request_base_url(headers, state);
    Ok(Json(ApiResponse::ok(build_job_detail_view(
        &state.config.data_root,
        job,
        &base_url,
    ))))
}

fn build_job_artifacts_response(
    state: &AppState,
    headers: &HeaderMap,
    job: &crate::models::JobSnapshot,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let base_url = request_base_url(headers, state);
    Ok(Json(ApiResponse::ok(build_job_artifact_links_view(
        &state.config.data_root,
        job,
        &base_url,
    ))))
}

fn build_job_submission_response(
    state: &AppState,
    headers: &HeaderMap,
    job: &crate::models::JobSnapshot,
    status: JobStatusKind,
) -> Result<Json<ApiResponse<JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, state);
    Ok(Json(ApiResponse::ok(build_submission_view(
        job,
        status,
        job.workflow.clone(),
        &base_url,
    ))))
}

async fn download_job_file(
    state: &AppState,
    job: &crate::models::JobSnapshot,
    job_id: &str,
    resolve_path: impl Fn(&crate::models::JobSnapshot, &std::path::Path) -> Option<std::path::PathBuf>,
    not_ready_label: &str,
    content_type: &str,
) -> Result<Response, AppError> {
    let path = resolve_path(job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("{not_ready_label}: {job_id}")))?;
    stream_file(path, content_type, None).await
}

#[cfg(test)]
mod tests {
    use crate::models::CreateJobInput;
    use serde_json::json;

    #[test]
    fn create_job_json_requires_grouped_payload_shape() {
        let input = CreateJobInput::from_api_value(json!({
            "source": { "upload_id": "grouped-upload" },
            "translation": {
                "model": "deepseek-chat",
                "base_url": "https://api.deepseek.com/v1",
                "api_key": "sk-test"
            },
            "ocr": { "mineru_token": "mineru-token" }
        }))
        .expect("parse payload");

        assert_eq!(input.source.upload_id, "grouped-upload");
    }
}
