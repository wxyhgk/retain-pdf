//! 质量摘要的应用接口：路由只经这里取数，不直接碰数据库和配置。

use std::path::PathBuf;
use std::sync::Arc;

use crate::db::Db;
use crate::error::AppError;
use crate::storage_paths::{resolve_data_path, resolve_job_root};

pub use super::{QualityItemsView, QualitySummaryView};
use super::{
    quality_items, quality_summary, QualityItemsQuery, QualitySources, QUALITY_ITEMS_MAX_LIMIT,
    QUALITY_ITEM_KINDS,
};

/// 自己持有数据（Arc + PathBuf），可以搬进阻塞线程。
#[derive(Clone)]
pub struct QualityApiDeps {
    db: Arc<Db>,
    data_root: PathBuf,
}

impl QualityApiDeps {
    pub fn new(db: Arc<Db>, data_root: PathBuf) -> Self {
        Self { db, data_root }
    }
}

/// 按块清单的查询参数（已从请求里取出，还没校验）。
#[derive(Debug, Clone, Default)]
pub struct QualityItemsParams {
    pub kind: String,
    pub page: Option<u64>,
    pub severity: Option<String>,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

fn sources_for(deps: &QualityApiDeps, job_id: &str) -> Result<QualitySources, AppError> {
    let job = deps
        .db
        .get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))?;
    let job_root = resolve_job_root(&job, &deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("job has no output directory: {job_id}")))?;
    // 新任务式重渲染的译文在源任务目录里；报告在本任务目录里。
    let translated_dir = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref())
        .and_then(|raw| resolve_data_path(&deps.data_root, raw).ok())
        .unwrap_or_else(|| job_root.join("translated"));
    Ok(QualitySources { artifacts_dir: job_root.join("artifacts"), translated_dir })
}

pub fn quality_summary_view(deps: &QualityApiDeps, job_id: &str) -> Result<QualitySummaryView, AppError> {
    let sources = sources_for(deps, job_id)?;
    Ok(quality_summary(job_id, &sources))
}

pub fn quality_items_view(
    deps: &QualityApiDeps,
    job_id: &str,
    params: QualityItemsParams,
) -> Result<QualityItemsView, AppError> {
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
    let sources = sources_for(deps, job_id)?;
    let query = QualityItemsQuery {
        kind: params.kind,
        page: params.page,
        severity: params.severity.filter(|value| !value.trim().is_empty()),
        offset: params.offset.unwrap_or(0),
        limit,
    };
    Ok(quality_items(&sources, &query))
}
