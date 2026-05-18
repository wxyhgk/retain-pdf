use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::{
    ApiResponse, ArtifactLinksView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobListView, ListJobEventsQuery, ListJobsQuery, ListTranslationItemsQuery, ReaderRegionsView,
    TranslationDebugItemView, TranslationDebugListView, TranslationDiagnosticsView,
    TranslationReplayView,
};

use super::common::{jobs_facade, ok_json, request_base_url, JobsRouteDeps};

pub fn list_jobs_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    query: &ListJobsQuery,
) -> Result<Json<ApiResponse<JobListView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port);
    Ok(ok_json(jobs_facade(deps).list_jobs_view(&base_url, query)?))
}

pub fn job_detail_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobDetailView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port);
    Ok(ok_json(
        jobs_facade(deps).job_detail_view(&base_url, job_id, ocr_only)?,
    ))
}

pub fn job_events_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
    query: &ListJobEventsQuery,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobEventListView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps).job_events_view(job_id, query, ocr_only)?,
    ))
}

pub fn job_artifacts_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<ArtifactLinksView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port);
    Ok(ok_json(
        jobs_facade(deps).job_artifacts_view(&base_url, job_id, ocr_only)?,
    ))
}

pub fn job_artifact_manifest_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<JobArtifactManifestView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port);
    Ok(ok_json(
        jobs_facade(deps).job_artifact_manifest_view(&base_url, job_id, ocr_only)?,
    ))
}

pub fn reader_regions_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
) -> Result<Json<ApiResponse<ReaderRegionsView>>, AppError> {
    Ok(ok_json(jobs_facade(deps).reader_regions_view(job_id)?))
}

pub async fn cancel_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    ocr_only: bool,
) -> Result<Json<ApiResponse<crate::models::JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port);
    Ok(ok_json(
        jobs_facade(deps)
            .cancel_submission(&base_url, job_id, ocr_only)
            .await?,
    ))
}

pub fn rerun_job_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
) -> Result<Json<ApiResponse<crate::models::JobSubmissionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port);
    Ok(ok_json(
        jobs_facade(deps).rerun_submission(&base_url, job_id)?,
    ))
}

pub fn translation_diagnostics_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
) -> Result<Json<ApiResponse<TranslationDiagnosticsView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps).translation_diagnostics_view(job_id)?,
    ))
}

pub fn translation_items_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
    query: &ListTranslationItemsQuery,
) -> Result<Json<ApiResponse<TranslationDebugListView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps).translation_items_view(job_id, query)?,
    ))
}

pub fn translation_item_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
    item_id: &str,
) -> Result<Json<ApiResponse<TranslationDebugItemView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps).translation_item_view(job_id, item_id)?,
    ))
}

pub async fn replay_translation_item_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
    item_id: &str,
) -> Result<Json<ApiResponse<TranslationReplayView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps)
            .replay_translation_item(job_id, item_id)
            .await?,
    ))
}
