use axum::http::HeaderMap;
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ReviseTranslationItemRequest, TranslationReplayView, TranslationRevisionView,
};

use crate::routes::common::{jobs_facade, ok_json, request_base_url, JobsRouteDeps};

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

pub async fn revise_translation_item_response(
    deps: JobsRouteDeps<'_>,
    headers: &HeaderMap,
    job_id: &str,
    item_id: &str,
    request: ReviseTranslationItemRequest,
) -> Result<Json<ApiResponse<TranslationRevisionView>>, AppError> {
    let base_url = request_base_url(headers, deps.default_port, &deps.bind_host);
    Ok(ok_json(
        jobs_facade(deps)
            .revise_translation_item(&base_url, job_id, item_id, request)
            .await?,
    ))
}
