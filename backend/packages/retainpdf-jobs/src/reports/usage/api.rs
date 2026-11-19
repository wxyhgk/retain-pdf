//! 用量汇总的应用接口：路由只经这里取数，不直接碰数据库和配置。

use std::path::PathBuf;
use std::sync::Arc;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_providers::PriceBook;

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
///
/// 这本书的全部任务，加上问这本书时助手花的。书不存在时 404（以前给 200 和全零汇总）；有书没任务照旧 200 空汇总。
pub fn document_usage_view(deps: &UsageApiDeps, document_id: &str) -> Result<UsageSummaryView, AppError> {
    deps.db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    let jobs = deps
        .db
        .list_jobs_for_document(document_id, u32::MAX, 0)
        .map_err(|error| AppError::internal(format!("list document jobs failed: {error:#}")))?;
    let assistant = read_ledger(&assistant_usage_ledger_path(&deps.data_root))
        .into_iter()
        .filter(|record| record.document_id == document_id)
        .collect();
    let prices = PriceBook::load(&deps.data_root);
    Ok(summarize_jobs("document", &deps.output_root, jobs.iter().map(|job| job.job_id.as_str()), assistant, &prices))
}

/// 现存的全部任务加上助手。删掉的书不再计入。
/// `owner` 非空（多用户模式的网站账号）时只算这个账号的任务；助手对网站账号还没开放，不计。
pub fn all_usage_view(deps: &UsageApiDeps, owner: Option<&str>) -> Result<UsageSummaryView, AppError> {
    if let Some(owner) = owner {
        let ids = deps
            .db
            .job_ids_for_owner(owner)
            .map_err(|error| AppError::internal(format!("list owned jobs failed: {error:#}")))?;
        return Ok(summarize_jobs("all", &deps.output_root, ids.iter().map(String::as_str), Vec::new(), &PriceBook::load(&deps.data_root)));
    }
    let ids = all_job_ids(&deps.output_root);
    let assistant = read_ledger(&assistant_usage_ledger_path(&deps.data_root));
    Ok(summarize_jobs("all", &deps.output_root, ids.iter().map(String::as_str), assistant, &PriceBook::load(&deps.data_root)))
}
