use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ReaderAiChatRequest, ReaderAiChatView, ReaderMetadataView, ReaderRegionsView,
};

use crate::routes::common::{jobs_facade, ok_json, JobsRouteDeps};

pub fn reader_regions_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
) -> Result<Json<ApiResponse<ReaderRegionsView>>, AppError> {
    Ok(ok_json(jobs_facade(deps).reader_regions_view(job_id)?))
}

pub fn reader_metadata_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
) -> Result<Json<ApiResponse<ReaderMetadataView>>, AppError> {
    Ok(ok_json(jobs_facade(deps).reader_metadata_view(job_id)?))
}

pub async fn reader_ai_chat_response(
    deps: JobsRouteDeps<'_>,
    job_id: &str,
    request: ReaderAiChatRequest,
) -> Result<Json<ApiResponse<ReaderAiChatView>>, AppError> {
    Ok(ok_json(
        jobs_facade(deps).reader_ai_chat(job_id, request).await?,
    ))
}
