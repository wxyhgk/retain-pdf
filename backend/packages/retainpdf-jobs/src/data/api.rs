//! 通用取数的应用接口：路由只经这里，不直接碰数据库和配置。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::load_supported_job;
use retainpdf_core::storage_paths::{resolve_data_path, resolve_job_root};

pub use super::JobDataView;
use super::{query, JobDataRoots};

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

/// `None` = 任务还没有输出目录（排队中、还没开始跑）。
fn roots_for(deps: &JobDataApiDeps, job_id: &str) -> Result<Option<JobDataRoots>, AppError> {
    // 和其余读任务的接口一样走 `load_supported_job`：认合并阅读的虚拟 id，旧目录格式的任务报 409。
    // 虚拟任务的目录是合并目录，里面没有的数据集照常 `available: false`。
    let job = load_supported_job(&deps.db, &deps.data_root, job_id)?;
    // 还没有输出目录和「文件还不在」一样：200 + `available: false`，不是 404。
    let Some(job_root) = resolve_job_root(&job, &deps.data_root) else {
        return Ok(None);
    };
    // 新任务式重渲染的译文在源任务目录里；报告、日志在本任务目录里。
    let translated = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref())
        .and_then(|raw| resolve_data_path(&deps.data_root, raw).ok())
        .unwrap_or_else(|| job_root.join("translated"));
    Ok(Some(JobDataRoots { artifacts: job_root.join("artifacts"), translated, logs: job_root.join("logs") }))
}

pub fn job_data_view(
    deps: &JobDataApiDeps,
    job_id: &str,
    dataset: &str,
    params: &HashMap<String, String>,
) -> Result<JobDataView, AppError> {
    query(job_id, dataset, roots_for(deps, job_id)?.as_ref(), params)
}
