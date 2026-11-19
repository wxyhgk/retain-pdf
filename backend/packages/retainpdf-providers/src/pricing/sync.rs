//! 每天从 models.dev 同步一次价格，并进 `<data_root>/pricing/model-prices.v1.json` 的价格历史。
//!
//! 地址可以用环境变量 `RETAINPDF_MODEL_PRICES_URL` 换成镜像；设成空字符串就不同步（断网环境），
//! 汇总照旧用上次同步的历史或内置快照。只发一个不带任何账号信息的 GET。

use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{bail, Context};
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::Value;

use super::{price_book_path, PriceBook};

pub const DEFAULT_PRICE_SOURCE_URL: &str = "https://models.dev/api.json";
const PRICE_SOURCE_ENV: &str = "RETAINPDF_MODEL_PRICES_URL";
/// models.dev 现在 7MB 左右，留足余量；超过就当源出了问题。
const MAX_SOURCE_BYTES: usize = 64 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PriceSyncOutcome {
    pub providers: usize,
    pub models: usize,
    /// 这次新追加的价格条数（新模型、价格变了的模型）。
    pub appended: usize,
}

/// 启动后等一会儿再查，不和启动时的其它活抢。
const FIRST_CHECK_DELAY: Duration = Duration::from_secs(30);
/// 每小时看一眼，上次同步超过 20 小时才真去拉：服务常重启、电脑常睡眠，按固定 24 小时排会一直拖。
const CHECK_INTERVAL: Duration = Duration::from_secs(60 * 60);
const SYNC_AFTER_HOURS: i64 = 20;

/// 服务启动时调一次：后台每天同步一次价格。关了同步（环境变量设成空）返回 None。
/// 失败只记日志，下个小时再试；汇总照旧用上次的历史或内置快照。
pub fn spawn_daily_price_sync(data_root: PathBuf) -> Option<tokio::task::JoinHandle<()>> {
    let Some(url) = price_sync_url() else {
        tracing::info!("model price sync disabled ({PRICE_SOURCE_ENV} is empty)");
        return None;
    };
    Some(tokio::spawn(async move {
        tokio::time::sleep(FIRST_CHECK_DELAY).await;
        let mut ticker = tokio::time::interval(CHECK_INTERVAL);
        loop {
            ticker.tick().await;
            if !sync_due(&data_root, Utc::now()) {
                continue;
            }
            match sync_price_book(&data_root, &url).await {
                Ok(outcome) => tracing::info!(
                    providers = outcome.providers,
                    models = outcome.models,
                    appended = outcome.appended,
                    "model prices synced"
                ),
                Err(error) => tracing::warn!("model price sync failed: {error:#}"),
            }
        }
    }))
}

/// 没同步过，或上次同步超过 20 小时。
pub(super) fn sync_due(data_root: &Path, now: DateTime<Utc>) -> bool {
    let last = PriceBook::load_synced(data_root)
        .and_then(|book| book.synced_at)
        .and_then(|at| DateTime::parse_from_rfc3339(&at).ok());
    last.is_none_or(|at| now.signed_duration_since(at.with_timezone(&Utc)) >= chrono::Duration::hours(SYNC_AFTER_HOURS))
}

/// 同步地址；环境变量设成空字符串表示不同步。
pub fn price_sync_url() -> Option<String> {
    match std::env::var(PRICE_SOURCE_ENV) {
        Ok(value) => Some(value.trim().to_string()).filter(|value| !value.is_empty()),
        Err(_) => Some(DEFAULT_PRICE_SOURCE_URL.to_string()),
    }
}

pub async fn sync_price_book(data_root: &Path, url: &str) -> anyhow::Result<PriceSyncOutcome> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent("retainpdf-price-sync")
        .build()?;
    let response = client.get(url).send().await?.error_for_status()?;
    if response.content_length().is_some_and(|length| length as usize > MAX_SOURCE_BYTES) {
        bail!("price source is larger than {MAX_SOURCE_BYTES} bytes");
    }
    let body = response.bytes().await?;
    if body.len() > MAX_SOURCE_BYTES {
        bail!("price source is larger than {MAX_SOURCE_BYTES} bytes");
    }
    let raw: Value = serde_json::from_slice(&body).context("parse price source")?;
    let data_root = data_root.to_path_buf();
    let url = url.to_string();
    tokio::task::spawn_blocking(move || apply_price_source(&data_root, &raw, &url, Utc::now())).await?
}

/// 把拉到的 models.dev 数据并进价格历史并落盘（先写临时文件再改名）。第一次同步直接用拉到的数据起步，
/// 不并内置快照：快照只在从没同步过时兜底，比第一次同步还早的请求按最早那批价算。
pub(crate) fn apply_price_source(
    data_root: &Path,
    raw: &Value,
    url: &str,
    now: DateTime<Utc>,
) -> anyhow::Result<PriceSyncOutcome> {
    let fresh = PriceBook::from_models_dev(raw, url, &now.format("%Y-%m-%d").to_string());
    if fresh.providers.is_empty() {
        bail!("price source has no providers with a known API host");
    }
    let mut book = PriceBook::load_synced(data_root)
        .unwrap_or_else(|| PriceBook { providers: Default::default(), ..fresh.clone() });
    let appended = book.merge(fresh);
    book.synced_at = Some(now.to_rfc3339_opts(SecondsFormat::Secs, true));
    let path = price_book_path(data_root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec(&book)?)?;
    std::fs::rename(&tmp, &path)?;
    Ok(PriceSyncOutcome {
        providers: book.providers.len(),
        models: book.providers.values().map(|provider| provider.models.len()).sum(),
        appended,
    })
}
