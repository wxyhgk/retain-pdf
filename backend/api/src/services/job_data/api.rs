//! 通用取数的应用接口：路由只经这里，不直接碰数据库和配置。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use crate::db::Db;
use crate::error::AppError;
use crate::storage_paths::{resolve_data_path, resolve_job_root};

pub use super::{JobDataCatalogView, JobDataView};
use super::{catalog, query, JobDataRoots};

/// 自己持有数据（Arc + PathBuf），可以搬进阻塞线程。
#[derive(Clone)]
pub struct JobDataApiDeps {
    db: Arc<Db>,
    data_root: PathBuf,
}

impl JobDataApiDeps {
    pub fn new(db: Arc<Db>, data_root: PathBuf) -> Self {
        Self { db, data_root }
    }
}

fn roots_for(deps: &JobDataApiDeps, job_id: &str) -> Result<JobDataRoots, AppError> {
    let job = deps
        .db
        .get_job(job_id)
        .map_err(|_| AppError::not_found(format!("job not found: {job_id}")))?;
    let job_root = resolve_job_root(&job, &deps.data_root)
        .ok_or_else(|| AppError::not_found(format!("job has no output directory: {job_id}")))?;
    // 新任务式重渲染的译文在源任务目录里；报告、日志在本任务目录里。
    let translated = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref())
        .and_then(|raw| resolve_data_path(&deps.data_root, raw).ok())
        .unwrap_or_else(|| job_root.join("translated"));
    Ok(JobDataRoots { artifacts: job_root.join("artifacts"), translated, logs: job_root.join("logs") })
}

pub fn job_data_catalog_view(deps: &JobDataApiDeps, job_id: &str) -> Result<JobDataCatalogView, AppError> {
    Ok(catalog(job_id, &roots_for(deps, job_id)?))
}

pub fn job_data_view(
    deps: &JobDataApiDeps,
    job_id: &str,
    dataset: &str,
    params: &HashMap<String, String>,
) -> Result<JobDataView, AppError> {
    query(job_id, dataset, &roots_for(deps, job_id)?, params)
}
