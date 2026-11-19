//! 估价（2026-11-19 起）：重新翻译换模型之前，告诉用户大概花多少钱。
//!
//! - 查单价：按（接口地址，模型）批量查，和用量汇总同一套对价规则（域名对服务商、对不上按官方标价）。
//! - 一本书：取这本书最近一次翻译的逐条用量，按新模型的价重算。翻译（含译前准备，不含 OCR：重新翻译复用 OCR）
//!   和精修分开给。下限按上次的缓存命中算；上限当缓存全没命中，DeepSeek 再按忙时算。
//! - 没翻译过的书：书库里各本书最近一次翻译的每页平均（翻译、精修分开）乘页数。
//!
//! 只是估：模型换了，输出长短、重试次数都会变。

use std::collections::BTreeSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use retainpdf_providers::{peak_multiplier, Price, PriceBasis, PriceBook, TokenCounts, CNY_PER_USD};

use super::{job_usage_records, round_usd, stage_label, UsagePricingView, UsageRecord};

pub const MAX_PRICE_LOOKUP_ITEMS: usize = 100;
pub const MAX_ESTIMATE_PAGES: u64 = 100_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DocumentUsageEstimateQuery {
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LibraryUsageEstimateQuery {
    pub base_url: String,
    pub model: String,
    pub pages: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PriceLookupItem {
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PriceLookupInput {
    pub items: Vec<PriceLookupItem>,
}

/// 每百万 token 的美元单价；没给缓存价的是 null（按输入价算）。
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PriceTierView {
    pub above_input_tokens: u64,
    pub input: f64,
    pub output: f64,
    pub cache_read: Option<f64>,
    pub cache_write: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PriceView {
    pub input: f64,
    pub output: f64,
    pub cache_read: Option<f64>,
    pub cache_write: Option<f64>,
    /// 一次请求输入超过门槛后整次按这一档，门槛从低到高。
    pub tiers: Vec<PriceTierView>,
    /// 一天里最贵的时段是标价的几倍（DeepSeek 忙时 2，别家 1）。
    pub peak_multiplier: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PriceQuoteView {
    pub base_url: String,
    pub model: String,
    pub price_provider: Option<String>,
    pub price_basis: Option<PriceBasis>,
    /// 查不到价是 null。
    pub price: Option<PriceView>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PriceLookupView {
    pub pricing: UsagePricingView,
    pub items: Vec<PriceQuoteView>,
}

/// 估出来的一部分（翻译或精修）。
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct UsageEstimatePart {
    pub requests: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_hit_tokens: u64,
    /// 查不到价时四个都是 null。
    pub low_usd: Option<f64>,
    pub high_usd: Option<f64>,
    pub low_cny: Option<f64>,
    pub high_cny: Option<f64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct UsageEstimateView {
    /// `book_history`：按这本书最近一次翻译；`library_average`：按书库每页平均乘页数；`none`：没有可参照的用量。
    pub basis: &'static str,
    pub base_url: String,
    pub model: String,
    pub price_provider: Option<String>,
    pub price_basis: Option<PriceBasis>,
    /// 按书库平均估时乘的页数；按这本书估时是这本书的页数（不知道是 null）。
    pub pages: Option<u64>,
    /// 按这本书估时参照的任务。
    pub source_job_id: Option<String>,
    /// 按书库平均估时参照了几本书、一共几页。
    pub sample_documents: u64,
    pub sample_pages: u64,
    /// 翻译（含译前准备，不含 OCR）；没有参照是 null。
    pub translation: Option<UsageEstimatePart>,
    /// 精修、编辑部；参照里没有精修是 null。
    pub refine: Option<UsageEstimatePart>,
    pub pricing: UsagePricingView,
}

fn host_of(base_url: &str) -> String {
    url::Url::parse(base_url.trim())
        .ok()
        .and_then(|url| url.host_str().map(str::to_ascii_lowercase))
        .unwrap_or_default()
}

fn now_ts() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn price_view(price: &Price, provider: &str) -> PriceView {
    PriceView {
        input: price.input,
        output: price.output,
        cache_read: price.cache_read,
        cache_write: price.cache_write,
        tiers: price
            .tiers
            .iter()
            .map(|tier| PriceTierView {
                above_input_tokens: tier.above_input_tokens,
                input: tier.input,
                output: tier.output,
                cache_read: tier.cache_read,
                cache_write: tier.cache_write,
            })
            .collect(),
        peak_multiplier: peak_multiplier(provider),
    }
}

pub fn lookup_prices(prices: &PriceBook, input: &PriceLookupInput) -> PriceLookupView {
    let now = now_ts();
    let items = input
        .items
        .iter()
        .map(|item| {
            let quote = prices.quote(&host_of(&item.base_url), item.model.trim(), &now);
            PriceQuoteView {
                base_url: item.base_url.clone(),
                model: item.model.clone(),
                price_provider: quote.as_ref().map(|(provider, _, _)| provider.clone()),
                price_basis: quote.as_ref().map(|(_, basis, _)| *basis),
                price: quote.as_ref().map(|(provider, _, price)| price_view(price, provider)),
            }
        })
        .collect();
    PriceLookupView { pricing: UsagePricingView::of(prices), items }
}

/// 一部分的用量：逐条（按这本书估）或按条数平均（按书库估）。
#[derive(Debug, Clone, Default)]
struct Profile {
    requests: u64,
    input: u64,
    output: u64,
    cache_hit: u64,
    cache_write: u64,
}

impl Profile {
    fn add(&mut self, record: &UsageRecord) {
        self.requests += record.requests;
        self.input += record.input;
        self.output += record.output;
        self.cache_hit += record.cache_hit.unwrap_or(0);
        self.cache_write += record.cache_write;
    }

    fn is_empty(&self) -> bool {
        self.requests == 0 && self.input == 0 && self.output == 0
    }
}

/// 一行用量换个价：下限照原样（含缓存命中），上限当缓存全没命中、按最贵时段。
fn bounds(price: &Price, provider: &str, tokens: TokenCounts) -> (f64, f64) {
    let low = price.cost_usd(tokens);
    let high = price.cost_usd(TokenCounts { cache_hit: 0, cache_write: 0, ..tokens }) * peak_multiplier(provider);
    (low, high)
}

fn finish_part(profile: &Profile, cost: Option<(f64, f64)>) -> UsageEstimatePart {
    let (low_usd, high_usd) = match cost {
        Some((low, high)) => (Some(round_usd(low)), Some(round_usd(high))),
        None => (None, None),
    };
    let cny = |usd: Option<f64>| usd.map(|value| (value * CNY_PER_USD * 10_000.0).round() / 10_000.0);
    UsageEstimatePart {
        requests: profile.requests,
        input_tokens: profile.input,
        output_tokens: profile.output,
        cache_hit_tokens: profile.cache_hit,
        low_usd,
        high_usd,
        low_cny: cny(low_usd),
        high_cny: cny(high_usd),
    }
}

/// 重新翻译会重跑的部分：翻译组、译前准备组，OCR 除外（复用）。
fn is_translation_part(stage: &str) -> bool {
    stage != "ocr" && matches!(stage_label(stage).1, "translation" | "preparation")
}

fn is_refine_part(stage: &str) -> bool {
    stage_label(stage).1 == "refine"
}

/// 一组任务里最近一次翻译的那个任务和它的全部用量：翻译部分最后一行时间最晚的。
fn latest_translation_run<'a>(output_root: &Path, job_ids: impl IntoIterator<Item = &'a str>) -> Option<(String, Vec<UsageRecord>)> {
    job_ids
        .into_iter()
        .filter_map(|job_id| {
            let (records, _) = job_usage_records(output_root, job_id);
            let last = records.iter().filter(|r| is_translation_part(&r.stage)).map(|r| r.ts.clone()).max()?;
            Some((last, job_id.to_string(), records))
        })
        .max_by(|a, b| a.0.cmp(&b.0))
        .map(|(_, job_id, records)| (job_id, records))
}

struct Quote<'a> {
    provider: String,
    basis: PriceBasis,
    price: &'a Price,
}

fn quote<'a>(prices: &'a PriceBook, base_url: &str, model: &str) -> Option<Quote<'a>> {
    let (provider, basis, price) = prices.quote(&host_of(base_url), model.trim(), &now_ts())?;
    Some(Quote { provider, basis, price })
}

fn empty_view(prices: &PriceBook, base_url: &str, model: &str, quote: &Option<Quote<'_>>) -> UsageEstimateView {
    UsageEstimateView {
        basis: "none",
        base_url: base_url.to_string(),
        model: model.to_string(),
        price_provider: quote.as_ref().map(|q| q.provider.clone()),
        price_basis: quote.as_ref().map(|q| q.basis),
        pages: None,
        source_job_id: None,
        sample_documents: 0,
        sample_pages: 0,
        translation: None,
        refine: None,
        pricing: UsagePricingView::of(prices),
    }
}

/// 按这本书最近一次翻译的逐条用量重算。没有翻译记录返回 None（调用方退回书库平均）。
pub fn estimate_from_history<'a>(
    prices: &PriceBook,
    output_root: &Path,
    job_ids: impl IntoIterator<Item = &'a str>,
    base_url: &str,
    model: &str,
    pages: Option<u64>,
) -> Option<UsageEstimateView> {
    let (job_id, records) = latest_translation_run(output_root, job_ids)?;
    let quote = quote(prices, base_url, model);
    let part = |keep: fn(&str) -> bool| -> Option<UsageEstimatePart> {
        let mut profile = Profile::default();
        let mut cost = (0.0, 0.0);
        for record in records.iter().filter(|r| keep(&r.stage)) {
            profile.add(record);
            if let Some(q) = &quote {
                let tokens = TokenCounts { input: record.input, output: record.output, cache_hit: record.cache_hit.unwrap_or(0), cache_write: record.cache_write };
                let (low, high) = bounds(q.price, &q.provider, tokens);
                cost = (cost.0 + low, cost.1 + high);
            }
        }
        (!profile.is_empty()).then(|| finish_part(&profile, quote.as_ref().map(|_| cost)))
    };
    let translation = part(is_translation_part);
    let refine = part(is_refine_part);
    Some(UsageEstimateView {
        basis: "book_history",
        pages,
        source_job_id: Some(job_id),
        translation,
        refine,
        ..empty_view(prices, base_url, model, &quote)
    })
}

/// 书库里每本书最近一次翻译（有页数的）合起来，按页平均再乘 `pages`。
pub struct LibrarySample {
    pub documents: u64,
    pages: u64,
    translation: Profile,
    refine: Profile,
}

/// `books`：（这本书的页数，这本书的任务号）。
pub fn library_sample(output_root: &Path, books: impl IntoIterator<Item = (u64, Vec<String>)>) -> LibrarySample {
    let mut sample = LibrarySample { documents: 0, pages: 0, translation: Profile::default(), refine: Profile::default() };
    for (pages, job_ids) in books {
        if pages == 0 {
            continue;
        }
        let Some((_, records)) = latest_translation_run(output_root, job_ids.iter().map(String::as_str)) else {
            continue;
        };
        sample.documents += 1;
        sample.pages += pages;
        for record in &records {
            if is_translation_part(&record.stage) {
                sample.translation.add(record);
            } else if is_refine_part(&record.stage) {
                sample.refine.add(record);
            }
        }
    }
    sample
}

/// 平均下来一次请求多少 token，乘上估出来的请求数：分档按平均请求大小判断。
fn scaled_part(profile: &Profile, factor: f64, quote: &Option<Quote<'_>>) -> Option<UsageEstimatePart> {
    if profile.is_empty() || profile.requests == 0 {
        return None;
    }
    let scale = |value: u64| (value as f64 * factor).round() as u64;
    let scaled = Profile {
        requests: scale(profile.requests).max(1),
        input: scale(profile.input),
        output: scale(profile.output),
        cache_hit: scale(profile.cache_hit),
        cache_write: scale(profile.cache_write),
    };
    let per = |value: u64| value / profile.requests;
    let average = TokenCounts {
        input: per(profile.input),
        output: per(profile.output),
        cache_hit: per(profile.cache_hit),
        cache_write: per(profile.cache_write),
    };
    let cost = quote.as_ref().map(|q| {
        let (low, high) = bounds(q.price, &q.provider, average);
        (low * scaled.requests as f64, high * scaled.requests as f64)
    });
    Some(finish_part(&scaled, cost))
}

pub fn estimate_from_library(prices: &PriceBook, sample: &LibrarySample, base_url: &str, model: &str, pages: u64) -> UsageEstimateView {
    let quote = quote(prices, base_url, model);
    let mut view = empty_view(prices, base_url, model, &quote);
    view.pages = Some(pages);
    if sample.pages == 0 {
        return view;
    }
    let factor = pages as f64 / sample.pages as f64;
    view.basis = "library_average";
    view.sample_documents = sample.documents;
    view.sample_pages = sample.pages;
    view.translation = scaled_part(&sample.translation, factor, &quote);
    view.refine = scaled_part(&sample.refine, factor, &quote);
    view
}

/// 没有参照的空估价（书库空、这本书不知道页数）：照样给出单价从哪来。
pub fn no_basis(prices: &PriceBook, base_url: &str, model: &str, pages: Option<u64>) -> UsageEstimateView {
    let quote = quote(prices, base_url, model);
    UsageEstimateView { pages, ..empty_view(prices, base_url, model, &quote) }
}

/// 一组任务号去重（同一本书的任务按 updated_at 倒序来，可能有重复）。
pub(crate) fn unique(ids: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    ids.into_iter().filter(|id| seen.insert(id.clone())).collect()
}

/// 地址要是 http(s)、模型不能空。
pub(crate) fn validate_connection(base_url: &str, model: &str) -> Result<(), String> {
    let base_url = base_url.trim();
    if !(base_url.starts_with("http://") || base_url.starts_with("https://")) || host_of(base_url).is_empty() {
        return Err("base_url must be an http(s) URL".to_string());
    }
    if model.trim().is_empty() {
        return Err("model is required".to_string());
    }
    Ok(())
}
