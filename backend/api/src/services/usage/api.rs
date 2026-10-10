//! 用量汇总的应用接口：路由只经这里取数，不直接碰数据库和配置。

use std::path::PathBuf;
use std::sync::Arc;

use crate::db::Db;
use crate::error::AppError;
use crate::storage_paths::JobPaths;

pub use super::UsageSummaryView;
use super::{all_job_ids, assistant_usage_ledger_path, read_ledger, summarize_jobs};

/// 自己持有数据（Arc + PathBuf），可以搬进阻塞线程。
#[derive(Clone)]
pub struct UsageApiDeps {
    db: Arc<Db>,
    output_root: PathBuf,
    data_root: PathBuf,
}

impl UsageApiDeps {
    pub fn new(db: Arc<Db>, output_root: PathBuf, data_root: PathBuf) -> Self {
        Self { db, output_root, data_root }
    }
}

/// 单个任务（含它的原地精修、重渲染）。任务不存在时 404。
pub fn job_usage_view(deps: &UsageApiDeps, job_id: &str) -> Result<UsageSummaryView, AppError> {
    if deps.db.get_job(job_id).is_err() && !JobPaths::for_job(&deps.output_root, job_id).root.is_dir() {
        return Err(AppError::not_found(format!("job not found: {job_id}")));
    }
    Ok(summarize_jobs("job", &deps.output_root, [job_id], Vec::new()))
}

/// 这本书的全部任务，加上问这本书时助手花的。
pub fn document_usage_view(deps: &UsageApiDeps, document_id: &str) -> Result<UsageSummaryView, AppError> {
    let jobs = deps
        .db
        .list_jobs_for_document(document_id, u32::MAX, 0)
        .map_err(|error| AppError::internal(format!("list document jobs failed: {error:#}")))?;
    let assistant = read_ledger(&assistant_usage_ledger_path(&deps.data_root))
        .into_iter()
        .filter(|record| record.document_id == document_id)
        .collect();
    Ok(summarize_jobs("document", &deps.output_root, jobs.iter().map(|job| job.job_id.as_str()), assistant))
}

/// 现存的全部任务加上助手。删掉的书不再计入。
pub fn all_usage_view(deps: &UsageApiDeps) -> UsageSummaryView {
    let ids = all_job_ids(&deps.output_root);
    let assistant = read_ledger(&assistant_usage_ledger_path(&deps.data_root));
    summarize_jobs("all", &deps.output_root, ids.iter().map(String::as_str), assistant)
}
