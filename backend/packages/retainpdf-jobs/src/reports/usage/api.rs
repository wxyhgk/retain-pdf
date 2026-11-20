//! 用量汇总的应用接口：路由只经这里取数，不直接碰数据库和配置。

use std::path::PathBuf;
use std::sync::Arc;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_api_base::job_loading::load_supported_job;
use retainpdf_core::storage_paths::JobPaths;
use retainpdf_providers::PriceBook;

pub use super::estimate::{
    DocumentUsageEstimateQuery, LibraryUsageEstimateQuery, PriceLookupInput, PriceLookupView, UsageEstimateView,
};
pub use super::UsageSummaryView;
use super::estimate::{
    estimate_from_history, estimate_from_library, library_sample, lookup_prices, no_basis, validate_connection,
    RunCandidate, MAX_ESTIMATE_PAGES, MAX_PRICE_LOOKUP_ITEMS, MIN_REFERENCE_PAGES,
};
use retainpdf_core::models::domain::JobStatusKind;
use retainpdf_core::models::request::parse_page_ranges;
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

/// 单个任务（含它的原地精修、重渲染）。任务不存在时 404（2026-11-14 删掉，2026-11-20 加回：进度页要看这一次花了多少）。
///
/// 和其余读任务的接口一样走 `load_supported_job`：认合并阅读的虚拟 id（合并结果自己没有用量，
/// 给空汇总），旧目录格式的任务报 409，库读不出来报 500。
///
/// 有意保留的一条：库里没有这个任务、但 `output/<任务>/` 目录还在，仍然给 200（用量账本在任务目录里，
/// 和全局汇总 `all_usage_view` 一样不依赖数据库）；库里删掉记录之后，花过多少 token 仍然查得到。
/// 只有「库里没有、目录也没有」才是 404。
pub fn job_usage_view(deps: &UsageApiDeps, job_id: &str) -> Result<UsageSummaryView, AppError> {
    match load_supported_job(&deps.db, &deps.data_root, job_id) {
        Ok(_) => {}
        Err(AppError::NotFound(_)) if JobPaths::for_job(&deps.output_root, job_id).root.is_dir() => {}
        Err(error) => return Err(error),
    }
    Ok(summarize_jobs("job", &deps.output_root, [job_id], Vec::new(), &PriceBook::load(&deps.data_root)))
}

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

/// 一个任务实际翻了几页：没选页（空、`all`）是整本，选了的按范围算；范围写坏了、整本页数不知道的返回 0（不当参照）。
fn translated_pages(spec: &str, document_pages: u32) -> u64 {
    if document_pages == 0 {
        return 0;
    }
    let spec = spec.trim();
    if spec.is_empty() || spec.eq_ignore_ascii_case("all") {
        return u64::from(document_pages);
    }
    parse_page_ranges(spec, document_pages).map(|pages| pages.len() as u64).unwrap_or(0)
}

/// 这本书能当估价参照的翻译：成功完成的任务（取消、失败、排队的不算），翻的页数够（`MIN_REFERENCE_PAGES`，书更短就整本）。
/// `owned`：多用户模式下只留这个账号的任务。
fn reference_runs(
    deps: &UsageApiDeps,
    document_id: &str,
    document_pages: u32,
    owned: Option<&std::collections::BTreeSet<String>>,
) -> Result<Vec<RunCandidate>, AppError> {
    let jobs = deps
        .db
        .list_jobs_for_document(document_id, u32::MAX, 0)
        .map_err(|error| AppError::internal(format!("list document jobs failed: {error:#}")))?;
    let enough = MIN_REFERENCE_PAGES.min(u64::from(document_pages)).max(1);
    let mut seen = std::collections::BTreeSet::new();
    Ok(jobs
        .iter()
        .filter(|job| job.status == JobStatusKind::Succeeded)
        .filter(|job| owned.is_none_or(|owned| owned.contains(&job.job_id)))
        .filter(|job| seen.insert(job.job_id.clone()))
        .map(|job| RunCandidate { job_id: job.job_id.clone(), pages: translated_pages(job.ocr_page_ranges(), document_pages) })
        .filter(|run| run.pages >= enough)
        .collect())
}

/// 书库里每本书能当参照的翻译。`owner` 非空（多用户模式）时只留这个账号的任务。
fn library_books(deps: &UsageApiDeps, owner: Option<&str>) -> Result<Vec<Vec<RunCandidate>>, AppError> {
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
        let runs = reference_runs(deps, &document.document_id, document.page_count, owned.as_ref())?;
        if !runs.is_empty() {
            books.push(runs);
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
    let runs = reference_runs(deps, document_id, document.page_count, None)?;
    if let Some(view) = estimate_from_history(&prices, &deps.output_root, &runs, &query.base_url, &query.model, pages) {
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
