use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ListTranslationItemsQuery, TranslationDebugItemView, TranslationDebugListView,
    TranslationDiagnosticsView, TranslationReplayView,
};

use crate::routes::common::{jobs_facade, ok_json, JobsRouteDeps};

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
