//! 质量摘要与按块清单（质量体检卡、阅读页标注）。读的是任务目录里的报告，放到阻塞线程里做。

use axum::extract::State;
use axum::Json;
use serde::Deserialize;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{ok_json, ApiPath, ApiQuery};
use crate::services::quality::{
    quality_items, quality_summary, QualityItemsQuery, QualityItemsView, QualitySources,
    QualitySummaryView, QUALITY_ITEMS_MAX_LIMIT, QUALITY_ITEM_KINDS,
};
use crate::storage_paths::{resolve_data_path, resolve_job_root};
use crate::AppState;

fn sources_for(state: &AppState, job_id: &str) -> Result<QualitySources, AppError> {
    let job = state
        .db
        .get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))?;
    let job_root = resolve_job_root(&job, &state.config.data_root)
        .ok_or_else(|| AppError::not_found(format!("job has no output directory: {job_id}")))?;
    // 新任务式重渲染的译文在源任务目录里；报告在本任务目录里。
    let translated_dir = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref())
        .and_then(|raw| resolve_data_path(&state.config.data_root, raw).ok())
        .unwrap_or_else(|| job_root.join("translated"));
    Ok(QualitySources { artifacts_dir: job_root.join("artifacts"), translated_dir })
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("quality summary task failed"))
}

/// GET /api/v1/jobs/:job_id/quality-summary
pub async fn quality_summary_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<QualitySummaryView>>, AppError> {
    let sources = sources_for(&state, &job_id)?;
    Ok(ok_json(blocking(move || quality_summary(&job_id, &sources)).await?))
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QualityItemsParams {
    pub kind: String,
    #[serde(default)]
    pub page: Option<u64>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub offset: Option<usize>,
    #[serde(default)]
    pub limit: Option<usize>,
}

/// GET /api/v1/jobs/:job_id/quality-items?kind=layout|untranslated|qa|escalated[&page][&severity][&offset][&limit]
pub async fn quality_items_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
    ApiQuery(params): ApiQuery<QualityItemsParams>,
) -> Result<Json<ApiResponse<QualityItemsView>>, AppError> {
    if !QUALITY_ITEM_KINDS.contains(&params.kind.as_str()) {
        return Err(AppError::bad_request(format!(
            "kind must be one of {}",
            QUALITY_ITEM_KINDS.join(", ")
        )));
    }
    let limit = params.limit.unwrap_or(200);
    if limit == 0 || limit > QUALITY_ITEMS_MAX_LIMIT {
        return Err(AppError::bad_request(format!("limit must be 1..={QUALITY_ITEMS_MAX_LIMIT}")));
    }
    let sources = sources_for(&state, &job_id)?;
    let query = QualityItemsQuery {
        kind: params.kind,
        page: params.page,
        severity: params.severity.filter(|value| !value.trim().is_empty()),
        offset: params.offset.unwrap_or(0),
        limit,
    };
    Ok(ok_json(blocking(move || quality_items(&sources, &query)).await?))
}
