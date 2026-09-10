use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ReaderAiChatRequest, ReaderAiChatView, ReaderMetadataView, ReaderRegionsView,
};
use crate::AppState;

use super::super::json_response::{
    reader_ai_chat_response, reader_metadata_response, reader_regions_response,
};
use crate::routes::common::{build_jobs_route_deps, ApiJson, ApiPath};

pub async fn get_reader_regions(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<ReaderRegionsView>>, AppError> {
    reader_regions_response(build_jobs_route_deps(&state), &job_id)
}

pub async fn get_reader_metadata(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<ReaderMetadataView>>, AppError> {
    reader_metadata_response(build_jobs_route_deps(&state), &job_id)
}

pub async fn reader_ai_chat(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiJson(payload): ApiJson<ReaderAiChatRequest>,
) -> Result<Json<ApiResponse<ReaderAiChatView>>, AppError> {
    reader_ai_chat_response(build_jobs_route_deps(&state), &job_id, payload).await
}
