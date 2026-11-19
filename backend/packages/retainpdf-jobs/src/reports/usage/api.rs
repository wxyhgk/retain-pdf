//! 用量汇总的应用接口：路由只经这里取数，不直接碰数据库和配置。

use std::path::PathBuf;
use std::sync::Arc;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_providers::PriceBook;

pub use super::estimate::{
    DocumentUsageEstimateQuery, LibraryUsageEstimateQuery, PriceLookupInput, PriceLookupView, UsageEstimateView,
};
pub use super::UsageSummaryView;
use super::estimate::{
    estimate_from_history, estimate_from_library, library_sample, lookup_prices, no_basis, unique,
    validate_connection, MAX_ESTIMATE_PAGES, MAX_PRICE_LOOKUP_ITEMS,
};
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

/// 按（接口地址，模型）批量查单价（2026-11-19 起）。一次最多 100 条。
pub fn price_lookup_view(deps: &UsageApiDeps, input: &PriceLookupInput) -> Result<PriceLookupView, AppError> {
    if input.items.len() > MAX_PRICE_LOOKUP_ITEMS {
        return Err(AppError::bad_request(format!("at most {MAX_PRICE_LOOKUP_ITEMS} items per lookup")));
    }
    Ok(lookup_prices(&PriceBook::load(&deps.data_root), input))
}

fn job_ids_of_document(deps: &UsageApiDeps, document_id: &str) -> Result<Vec<String>, AppError> {
    let jobs = deps
        .db
        .list_jobs_for_document(document_id, u32::MAX, 0)
        .map_err(|error| AppError::internal(format!("list document jobs failed: {error:#}")))?;
    Ok(unique(jobs.iter().map(|job| job.job_id.clone())))
}

/// 书库里每本书（页数，任务号）。`owner` 非空（多用户模式）时只留这个账号的任务。
fn library_books(deps: &UsageApiDeps, owner: Option<&str>) -> Result<Vec<(u64, Vec<String>)>, AppError> {
    let owned: Option<std::collections::BTreeSet<String>> = match owner {
        Some(owner) => Some(
            deps.db
                .job_ids_for_owner(owner)
                .map_err(|error| AppError::internal(format!("list owned jobs failed: {error:#}")))?
                .into_iter()
                .collect(),
        ),
        None => None,
    };
    let documents = deps
        .db
        .list_documents(u32::MAX, 0, None, None, None)
        .map_err(|error| AppError::internal(format!("list documents failed: {error:#}")))?;
    let mut books = Vec::new();
    for document in documents {
        let mut ids = job_ids_of_document(deps, &document.document_id)?;
        if let Some(owned) = &owned {
            ids.retain(|id| owned.contains(id));
        }
        if !ids.is_empty() {
            books.push((u64::from(document.page_count), ids));
        }
    }
    Ok(books)
}

/// 这本书换个模型重新翻译大概多少钱：按它最近一次翻译的逐条用量重算；没翻译过按书库每页平均乘它的页数。
pub fn document_usage_estimate_view(
    deps: &UsageApiDeps,
    document_id: &str,
    query: &DocumentUsageEstimateQuery,
) -> Result<UsageEstimateView, AppError> {
    let document = deps
        .db
        .get_document(document_id)
        .map_err(|error| AppError::from_lookup(error, format!("document not found: {document_id}")))?;
    validate_connection(&query.base_url, &query.model).map_err(AppError::bad_request)?;
    let prices = PriceBook::load(&deps.data_root);
    let pages = Some(u64::from(document.page_count)).filter(|pages| *pages > 0);
    let ids = job_ids_of_document(deps, document_id)?;
    if let Some(view) = estimate_from_history(&prices, &deps.output_root, ids.iter().map(String::as_str), &query.base_url, &query.model, pages) {
        return Ok(view);
    }
    let Some(pages) = pages else {
        return Ok(no_basis(&prices, &query.base_url, &query.model, None));
    };
    let sample = library_sample(&deps.output_root, library_books(deps, None)?);
    Ok(estimate_from_library(&prices, &sample, &query.base_url, &query.model, pages))
}

/// 还没有的书（比如刚要上传的）：书库每页平均乘页数。
pub fn library_usage_estimate_view(
    deps: &UsageApiDeps,
    owner: Option<&str>,
    query: &LibraryUsageEstimateQuery,
) -> Result<UsageEstimateView, AppError> {
    validate_connection(&query.base_url, &query.model).map_err(AppError::bad_request)?;
    if query.pages == 0 || query.pages > MAX_ESTIMATE_PAGES {
        return Err(AppError::bad_request(format!("pages must be 1..={MAX_ESTIMATE_PAGES}")));
    }
    let prices = PriceBook::load(&deps.data_root);
    let sample = library_sample(&deps.output_root, library_books(deps, owner)?);
    Ok(estimate_from_library(&prices, &sample, &query.base_url, &query.model, query.pages))
}
