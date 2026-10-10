//! 模型用量（token）：一个任务、一本书、全部。读的都是磁盘上的台账，放到阻塞线程里做。

use axum::extract::State;
use axum::Json;

use crate::error::AppError;
use crate::models::api::ApiResponse;
use crate::routes::common::{ok_json, ApiPath};
use crate::services::usage::{
    all_job_ids, assistant_usage_ledger_path, read_ledger, summarize_jobs, UsageSummaryView,
};
use crate::storage_paths::JobPaths;
use crate::AppState;

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, AppError> + Send + 'static,
) -> Result<T, AppError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|_| AppError::internal("usage summary task failed"))?
}

/// GET /api/v1/jobs/:job_id/usage
pub async fn job_usage_route(
    State(state): State<AppState>,
    ApiPath(job_id): ApiPath<String>,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let output_root = state.config.output_root.clone();
    let db = state.db.clone();
    let view = blocking(move || {
        if db.get_job(&job_id).is_err() && !JobPaths::for_job(&output_root, &job_id).root.is_dir() {
            return Err(AppError::not_found(format!("job not found: {job_id}")));
        }
        Ok(summarize_jobs("job", &output_root, [job_id.as_str()], Vec::new()))
    })
    .await?;
    Ok(ok_json(view))
}

/// GET /api/v1/documents/:document_id/usage —— 这本书的全部任务，加上问这本书时助手花的。
pub async fn document_usage_route(
    State(state): State<AppState>,
    ApiPath(document_id): ApiPath<String>,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let output_root = state.config.output_root.clone();
    let data_root = state.config.data_root.clone();
    let db = state.db.clone();
    let view = blocking(move || {
        let jobs = db
            .list_jobs_for_document(&document_id, u32::MAX, 0)
            .map_err(|error| AppError::internal(format!("list document jobs failed: {error:#}")))?;
        let assistant = read_ledger(&assistant_usage_ledger_path(&data_root))
            .into_iter()
            .filter(|record| record.document_id == document_id)
            .collect();
        Ok(summarize_jobs(
            "document",
            &output_root,
            jobs.iter().map(|job| job.job_id.as_str()),
            assistant,
        ))
    })
    .await?;
    Ok(ok_json(view))
}

/// GET /api/v1/usage —— 现存的全部任务加上助手。删掉的书不再计入。
pub async fn all_usage_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<UsageSummaryView>>, AppError> {
    let output_root = state.config.output_root.clone();
    let data_root = state.config.data_root.clone();
    let view = blocking(move || {
        let ids = all_job_ids(&output_root);
        let assistant = read_ledger(&assistant_usage_ledger_path(&data_root));
        Ok(summarize_jobs("all", &output_root, ids.iter().map(String::as_str), assistant))
    })
    .await?;
    Ok(ok_json(view))
}
