//! 质量摘要的应用接口：路由只经这里取数，不直接碰数据库和配置。

use std::path::PathBuf;
use std::sync::Arc;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::load_supported_job;
use retainpdf_core::storage_paths::{resolve_data_path, resolve_job_root};

pub use super::QualitySummaryView;
use super::{quality_summary, QualitySources};

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

/// `None` = 任务还没有输出目录（排队中、还没开始跑）。
fn sources_for(deps: &QualityApiDeps, job_id: &str) -> Result<Option<QualitySources>, AppError> {
    // 和其余读任务的接口一样走 `load_supported_job`：认合并阅读的虚拟 id，旧目录格式的任务报 409。
    // 虚拟任务的目录是合并目录，没有的报告照常给 null / 空清单。
    let job = load_supported_job(&deps.db, &deps.data_root, job_id)?;
    // 摘要类接口：还没有输出目录也是 200，各段 null、清单为空（不是 404）。
    let Some(job_root) = resolve_job_root(&job, &deps.data_root) else {
        return Ok(None);
    };
    // 新任务式重渲染的译文在源任务目录里；报告在本任务目录里。
    let translated_dir = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.translations_dir.as_deref())
        .and_then(|raw| resolve_data_path(&deps.data_root, raw).ok())
        .unwrap_or_else(|| job_root.join("translated"));
    Ok(Some(QualitySources { artifacts_dir: job_root.join("artifacts"), translated_dir }))
}

pub fn quality_summary_view(deps: &QualityApiDeps, job_id: &str) -> Result<QualitySummaryView, AppError> {
    let sources = sources_for(deps, job_id)?;
    Ok(quality_summary(job_id, sources.as_ref()))
}
