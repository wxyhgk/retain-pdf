//! 每个任务的用量汇总存在库里（`job_usage_cache` / `job_usage_rollups`，v34；2026-11-21 数据库重做第 2a 步）。
//!
//! 以前「总用量」每次请求都把全部任务目录里的台账和旧报告逐行解析一遍（本机几秒到几十秒）。现在：
//! - 每个任务记一个「来源指纹」：台账、翻译诊断、精修报告（含 `refine_history/`）的大小和修改时间，加价格表的指纹
//!   和本文件的 [`ROLLUP_VERSION`]。看一眼文件状态就知道存着的还能不能用（114 个任务也就几百次 stat）。
//! - 对得上就用库里的组；对不上（任务还在跑、台账在长；精修又写了报告；价格表同步了新价）就只重算这一个任务，存回去。
//! - 库读写出错不影响结果：退回直接读文件算。
//!
//! 正本照旧是任务目录里的文件；库里这份随时可以删掉重算。

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use retainpdf_core::storage_paths::JobPaths;
use retainpdf_data::db::{Db, UsageCacheEntry, UsageRollupRow};
use retainpdf_providers::{PriceBasis, PriceBook};
use sha2::{Digest, Sha256};

use super::{job_usage_records, rollup::rollup_records, UsageBucket, UsageRollup};

/// 算法变了（分组、折算规则、花费估算）就加一，库里存着的全部作废重算。
const ROLLUP_VERSION: u32 = 1;

/// 一个任务的用量：分好的组、有没有记录、是不是用旧报告折算的。
#[derive(Debug, Clone, PartialEq)]
pub struct JobUsage {
    pub rollups: Vec<UsageRollup>,
    pub has_records: bool,
    pub estimated: bool,
}

/// 价格表的指纹：价格变了，存着的花费就不能用了。
pub fn price_key(prices: &PriceBook) -> String {
    let bytes = serde_json::to_vec(prices).unwrap_or_default();
    Sha256::digest(&bytes).iter().take(8).map(|byte| format!("{byte:02x}")).collect()
}

fn file_state(path: &Path) -> String {
    match fs::metadata(path) {
        Ok(meta) => {
            let modified = meta
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map_or(0, |since| since.as_nanos());
            format!("{}:{modified}", meta.len())
        }
        Err(_) => "-".to_string(),
    }
}

/// 读用量要用到的那几个文件的状态 + 价格表指纹 + 算法版本。任务目录不在时 None（不存）。
fn source_key(output_root: &Path, job_id: &str, price_key: &str) -> Option<String> {
    let paths = JobPaths::for_job(output_root, job_id);
    if !paths.root.is_dir() {
        return None;
    }
    let artifacts = paths.root.join("artifacts");
    let mut parts = vec![
        format!("v{ROLLUP_VERSION}"),
        format!("prices={price_key}"),
        format!("ledger={}", file_state(&paths.token_usage_ledger())),
        format!("diagnostics={}", file_state(&artifacts.join("translation_diagnostics.json"))),
        format!("refine={}", file_state(&artifacts.join("refine_report.v1.json"))),
    ];
    let mut history: Vec<String> = fs::read_dir(artifacts.join("refine_history"))
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| format!("history/{}={}", entry.file_name().to_string_lossy(), file_state(&entry.path())))
                .collect()
        })
        .unwrap_or_default();
    history.sort();
    parts.extend(history);
    Some(parts.join("|"))
}

/// 直接读文件算一个任务（不碰库）。
pub fn compute_job_usage(output_root: &Path, job_id: &str, prices: &PriceBook) -> JobUsage {
    let (records, estimated) = job_usage_records(output_root, job_id);
    JobUsage { rollups: rollup_records(&records, prices), has_records: !records.is_empty(), estimated }
}

/// 这些任务的用量，按给的顺序。存着的对得上就用，对不上的重算并存回去。
pub fn job_usages(db: &Db, output_root: &Path, job_ids: &[&str], prices: &PriceBook) -> Vec<JobUsage> {
    let price_key = price_key(prices);
    let cached = db.usage_cache_entries(job_ids).unwrap_or_else(|error| {
        tracing::warn!("read usage cache failed, recomputing: {error:#}");
        HashMap::new()
    });
    job_ids
        .iter()
        .map(|job_id| {
            let Some(key) = source_key(output_root, job_id, &price_key) else {
                return compute_job_usage(output_root, job_id, prices);
            };
            if let Some(entry) = cached.get(*job_id).filter(|entry| entry.source_key == key) {
                return from_entry(entry);
            }
            let usage = compute_job_usage(output_root, job_id, prices);
            if let Err(error) = db.store_usage_cache(job_id, &to_entry(&usage, key)) {
                tracing::warn!("store usage cache for {job_id} failed: {error:#}");
            }
            usage
        })
        .collect()
}

fn basis_text(basis: PriceBasis) -> String {
    serde_json::to_value(basis).ok().and_then(|value| value.as_str().map(str::to_string)).unwrap_or_default()
}

fn basis_of(text: &str) -> Option<PriceBasis> {
    match text {
        "host" => Some(PriceBasis::Host),
        "official_list" => Some(PriceBasis::OfficialList),
        _ => None,
    }
}

fn to_entry(usage: &JobUsage, source_key: String) -> UsageCacheEntry {
    UsageCacheEntry {
        source_key,
        has_records: usage.has_records,
        estimated: usage.estimated,
        rows: usage
            .rollups
            .iter()
            .map(|rollup| UsageRollupRow {
                stage: rollup.stage.clone(),
                model: rollup.model.clone(),
                host: rollup.host.clone(),
                month: rollup.month.clone(),
                first_at: rollup.first_at.clone(),
                last_at: rollup.last_at.clone(),
                requests: rollup.usage.requests,
                requests_without_usage: rollup.usage.requests_without_usage,
                input_tokens: rollup.usage.input_tokens,
                output_tokens: rollup.usage.output_tokens,
                cache_hit_tokens: rollup.usage.cache_hit_tokens,
                cache_reported_input_tokens: rollup.usage.cache_reported_input_tokens,
                cache_write_tokens: rollup.usage.cache_write_tokens,
                reasoning_tokens: rollup.usage.reasoning_tokens,
                estimated_cost_usd: rollup.usage.estimated_cost_usd,
                priced_requests: rollup.usage.priced_requests,
                list_priced_requests: rollup.usage.list_priced_requests,
                unpriced_requests: rollup.usage.unpriced_requests,
                price_provider: rollup.first_priced.as_ref().map(|(_, provider, _)| provider.clone()),
                price_basis: rollup.first_priced.as_ref().map(|(_, _, basis)| basis_text(*basis)),
                first_priced_seq: rollup.first_priced.as_ref().map(|(seq, _, _)| *seq),
            })
            .collect(),
    }
}

fn from_entry(entry: &UsageCacheEntry) -> JobUsage {
    JobUsage {
        has_records: entry.has_records,
        estimated: entry.estimated,
        rollups: entry
            .rows
            .iter()
            .map(|row| UsageRollup {
                stage: row.stage.clone(),
                model: row.model.clone(),
                host: row.host.clone(),
                month: row.month.clone(),
                first_at: row.first_at.clone(),
                last_at: row.last_at.clone(),
                usage: UsageBucket {
                    requests: row.requests,
                    requests_without_usage: row.requests_without_usage,
                    input_tokens: row.input_tokens,
                    output_tokens: row.output_tokens,
                    total_tokens: row.input_tokens + row.output_tokens,
                    cache_hit_tokens: row.cache_hit_tokens,
                    cache_reported_input_tokens: row.cache_reported_input_tokens,
                    cache_write_tokens: row.cache_write_tokens,
                    reasoning_tokens: row.reasoning_tokens,
                    estimated_cost_usd: row.estimated_cost_usd,
                    priced_requests: row.priced_requests,
                    list_priced_requests: row.list_priced_requests,
                    unpriced_requests: row.unpriced_requests,
                },
                first_priced: match (row.first_priced_seq, &row.price_provider, row.price_basis.as_deref().and_then(basis_of)) {
                    (Some(seq), Some(provider), Some(basis)) => Some((seq, provider.clone(), basis)),
                    _ => None,
                },
            })
            .collect(),
    }
}
