//! 模型价格：用量汇总按它估算花了多少钱（美元）。
//!
//! 数据来自 models.dev（github.com/anomalyco/models.dev，MIT），社区每天在更新各家的输入、输出、
//! 缓存单价。服务端每天同步一次（`sync`），换算成「服务商 → 模型 → 从哪天起是什么价」的价格历史，
//! 存在 `<data_root>/pricing/model-prices.v1.json`：价格变了追加一条，不覆盖，旧账照当天的价格算。
//! 还没同步过（第一次启动、断网、关了同步）用仓库里带的快照 `models-dev-snapshot.json`（和本文件同目录）
//! （`ops/development/update_model_prices.py` 生成，只有官方服务商）。
//!
//! 台账每行记了请求的域名和模型：
//! 1. 域名对上 models.dev 里某个服务商的接口地址（`api`；没写的用 `HOST_OVERRIDES`），在它那里按模型编号查价；
//! 2. 对不上（代理、自建网关）或那家没有这个模型：按 `OFFICIAL_PROVIDERS` 的顺序找这个模型的官方标价，
//!    记作 `official_list`；
//! 3. 都没有：不定价，汇总里数进未定价的请求，不猜。
//!
//! models.dev 里没有的模型（例如智谱 GLM-OCR）在 `LOCAL_PRICES` 里补，按官方人民币价换成美元。
//!
//! 算法：缓存命中、缓存写入、其余输入各按各的单价（没给缓存价的按普通输入价）；输入超过分档门槛
//! （例如 Haiku 5.5 的 10 万 token）用那一档的价；DeepSeek 分忙闲时，models.dev 记的是闲时价，
//! 忙时（工作日 UTC 01–04、06–10 点）乘 2。中国法定节假日整天算闲时，这里判断不了，按工作日算，
//! 节假日的忙时请求会估高。规则来自 DeepSeek 官网价格页（2026-11 核对）。

mod sync;
#[cfg(test)]
mod tests;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Datelike, Timelike, Utc, Weekday};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use sync::{price_sync_url, spawn_daily_price_sync, sync_price_book, PriceSyncOutcome, DEFAULT_PRICE_SOURCE_URL};
#[cfg(test)]
use sync::sync_due;

pub const PRICE_BOOK_RELATIVE_PATH: &str = "pricing/model-prices.v1.json";
const BUNDLED_SNAPSHOT: &str = include_str!("models-dev-snapshot.json");

/// 域名对不上时，按这个顺序找模型的官方标价。和 `ops/development/update_model_prices.py` 一致。
pub const OFFICIAL_PROVIDERS: [&str; 17] = [
    "anthropic", "openai", "google", "deepseek", "alibaba-cn", "alibaba", "zhipuai", "zai",
    "moonshotai-cn", "moonshotai", "xai", "mistral", "minimax-cn", "minimax", "volcengine",
    "siliconflow-cn", "siliconflow",
];

/// models.dev 里没有、我们自己补的价格（官方页面核对过，写明出处和日期）。
/// 读价格时并进去（`with_local_prices`），不写进同步下来的价格历史；models.dev 以后收录了同一个模型，以它为准。
struct LocalPrice {
    provider: &'static str,
    host: &'static str,
    model: &'static str,
    /// 从这天起（核对日期）。
    since: &'static str,
    /// 每百万 token 的人民币单价。
    input_cny: f64,
    output_cny: f64,
    /// 出处，只给人看。
    #[allow(dead_code)]
    source: &'static str,
}

/// 人民币换美元：和 models.dev 换算国内站价格用的汇率一致（2026-11 约 7.16）。
const CNY_PER_USD: f64 = 7.16;

const LOCAL_PRICES: [LocalPrice; 1] = [LocalPrice {
    // 智谱 GLM-OCR（layout_parsing）：「API输入输出同价，仅需 0.2 元/百万Tokens」，2026-11-19 核对。
    provider: "zhipuai",
    host: "open.bigmodel.cn",
    model: "glm-ocr",
    since: "2026-11-19",
    input_cny: 0.2,
    output_cny: 0.2,
    source: "https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr",
}];

/// models.dev 里没写接口地址的官方服务商。
const HOST_OVERRIDES: [(&str, &str); 5] = [
    ("anthropic", "api.anthropic.com"),
    ("openai", "api.openai.com"),
    ("google", "generativelanguage.googleapis.com"),
    ("xai", "api.x.ai"),
    ("mistral", "api.mistral.ai"),
];

/// 每百万 token 的美元单价。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Price {
    pub input: f64,
    pub output: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_read: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_write: Option<f64>,
    /// 输入超过门槛后的单价，门槛从低到高。
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tiers: Vec<PriceTier>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PriceTier {
    /// 一次请求的输入 token 超过这个数，整次请求按这一档算。
    pub above_input_tokens: u64,
    pub input: f64,
    pub output: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_read: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_write: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PricePoint {
    /// `YYYY-MM-DD`（UTC），从这天起是这个价。
    pub since: String,
    #[serde(flatten)]
    pub price: Price,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ProviderPrices {
    pub hosts: Vec<String>,
    /// 模型编号 → 价格历史（按 since 从早到晚）。
    pub models: BTreeMap<String, Vec<PricePoint>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PriceBook {
    pub v: u32,
    pub source: String,
    /// 最后一次同步成功的时间；只用内置快照时是 None。
    #[serde(default)]
    pub synced_at: Option<String>,
    /// 内置快照的日期（价格历史里最早的那批 since）。
    #[serde(default)]
    pub snapshot_date: Option<String>,
    pub providers: BTreeMap<String, ProviderPrices>,
}

/// 价格从哪来。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PriceBasis {
    /// 请求的域名对上了这家服务商。
    Host,
    /// 域名对不上，按模型的官方标价估算。
    OfficialList,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CostEstimate {
    pub usd: f64,
    pub provider: String,
    pub basis: PriceBasis,
}

/// 一次请求的 token（和台账一样：input 含缓存命中、缓存写入；output 含思考）。
#[derive(Debug, Clone, Copy, Default)]
pub struct TokenCounts {
    pub input: u64,
    pub output: u64,
    pub cache_hit: u64,
    pub cache_write: u64,
}

pub fn price_book_path(data_root: &Path) -> PathBuf {
    data_root.join(PRICE_BOOK_RELATIVE_PATH)
}

fn host_of(url: &str) -> Option<String> {
    url::Url::parse(url).ok()?.host_str().map(str::to_ascii_lowercase)
}

fn number(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(Value::as_f64)
}

fn price_of(cost: &Value) -> Option<Price> {
    let mut tiers: Vec<PriceTier> = cost
        .get("tiers")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|tier| {
            let rule = tier.get("tier")?;
            // 只认按输入长度分档（models.dev 写作 type=context）；别的分法认不出来就不用。
            if rule.get("type").and_then(Value::as_str) != Some("context") {
                return None;
            }
            Some(PriceTier {
                above_input_tokens: rule.get("size").and_then(Value::as_u64)?,
                input: number(tier, "input")?,
                output: number(tier, "output")?,
                cache_read: number(tier, "cache_read"),
                cache_write: number(tier, "cache_write"),
            })
        })
        .collect();
    tiers.sort_by_key(|tier| tier.above_input_tokens);
    Some(Price {
        input: number(cost, "input")?,
        output: number(cost, "output")?,
        cache_read: number(cost, "cache_read"),
        cache_write: number(cost, "cache_write"),
        tiers,
    })
}

impl PriceBook {
    /// models.dev 的 api.json（或内置快照，格式相同）→ 每个模型一条、从 `since` 起的价格。
    /// 只留认得出接口域名的服务商：域名对不上的价格查不到，留着没用。
    pub fn from_models_dev(raw: &Value, source: &str, since: &str) -> Self {
        let mut providers = BTreeMap::new();
        for (provider_id, entry) in raw.as_object().into_iter().flatten() {
            if provider_id.starts_with('_') {
                continue;
            }
            let mut hosts: Vec<String> = entry.get("api").and_then(Value::as_str).and_then(host_of).into_iter().collect();
            if let Some((_, host)) = HOST_OVERRIDES.iter().find(|(id, _)| id == provider_id) {
                hosts.push((*host).to_string());
            }
            hosts.dedup();
            if hosts.is_empty() {
                continue;
            }
            let models: BTreeMap<String, Vec<PricePoint>> = entry
                .get("models")
                .and_then(Value::as_object)
                .into_iter()
                .flatten()
                .filter_map(|(model_id, model)| {
                    let price = price_of(model.get("cost")?)?;
                    Some((model_id.clone(), vec![PricePoint { since: since.to_string(), price }]))
                })
                .collect();
            if !models.is_empty() {
                providers.insert(provider_id.clone(), ProviderPrices { hosts, models });
            }
        }
        Self { v: 1, source: source.to_string(), synced_at: None, snapshot_date: None, providers }
    }

    /// 仓库里带的快照。
    pub fn bundled() -> Self {
        let raw: Value = serde_json::from_str(BUNDLED_SNAPSHOT).expect("bundled models.dev snapshot is valid JSON");
        let date = raw.get("_snapshot_date").and_then(Value::as_str).unwrap_or("1970-01-01").to_string();
        let source = raw.get("_source").and_then(Value::as_str).unwrap_or(DEFAULT_PRICE_SOURCE_URL).to_string();
        let mut book = Self::from_models_dev(&raw, &source, &date);
        book.snapshot_date = Some(date);
        book.with_local_prices()
    }

    /// 同步过的价格历史（并上 `LOCAL_PRICES`）；没有或读不了就用内置快照。
    pub fn load(data_root: &Path) -> Self {
        Self::load_synced(data_root).map(Self::with_local_prices).unwrap_or_else(Self::bundled)
    }

    /// 并上 models.dev 里没有的那几个模型的价（已经有的不动）。
    fn with_local_prices(mut self) -> Self {
        for local in &LOCAL_PRICES {
            let provider = self.providers.entry(local.provider.to_string()).or_insert_with(|| ProviderPrices {
                hosts: vec![local.host.to_string()],
                models: BTreeMap::new(),
            });
            provider.models.entry(local.model.to_string()).or_insert_with(|| {
                vec![PricePoint {
                    since: local.since.to_string(),
                    price: Price {
                        input: local.input_cny / CNY_PER_USD,
                        output: local.output_cny / CNY_PER_USD,
                        cache_read: None,
                        cache_write: None,
                        tiers: Vec::new(),
                    },
                }]
            });
        }
        self
    }

    /// 只读同步过的价格历史。
    pub fn load_synced(data_root: &Path) -> Option<Self> {
        std::fs::read_to_string(price_book_path(data_root))
            .ok()
            .and_then(|text| serde_json::from_str::<Self>(&text).ok())
            .filter(|book| book.v == 1)
    }

    /// 并进一次新同步的价格：价格变了的模型追加一条，新服务商、新模型加进来，接口域名用新的。
    /// 返回追加了几条价格。
    pub fn merge(&mut self, fresh: Self) -> usize {
        let mut appended = 0;
        for (provider_id, incoming) in fresh.providers {
            let provider = self.providers.entry(provider_id).or_default();
            provider.hosts = incoming.hosts;
            for (model_id, points) in incoming.models {
                let history = provider.models.entry(model_id).or_default();
                for mut point in points {
                    let Some(last) = history.last() else {
                        history.push(point);
                        appended += 1;
                        continue;
                    };
                    if last.price != point.price {
                        // 时钟往回拨过也不让历史倒序：新价最早从最后一条的那天起。
                        if point.since < last.since {
                            point.since = last.since.clone();
                        }
                        history.push(point);
                        appended += 1;
                    }
                }
            }
        }
        self.source = fresh.source;
        appended
    }

    fn model_points<'a>(&'a self, provider_id: &str, model: &str) -> Option<&'a [PricePoint]> {
        let models = &self.providers.get(provider_id)?.models;
        let lower = model.to_ascii_lowercase();
        let bare = lower.rsplit('/').next().unwrap_or(&lower);
        [model, lower.as_str(), bare]
            .iter()
            .find_map(|key| models.get(*key))
            .map(Vec::as_slice)
            .filter(|points| !points.is_empty())
    }

    /// 这个域名的服务商：官方的排前面（同一个域名下可能还挂着包月套餐之类的服务商）。
    fn providers_for_host(&self, host: &str) -> Vec<&str> {
        let host = host.trim().to_ascii_lowercase();
        if host.is_empty() {
            return Vec::new();
        }
        let mut ids: Vec<&str> = self
            .providers
            .iter()
            .filter(|(_, provider)| provider.hosts.iter().any(|known| *known == host))
            .map(|(id, _)| id.as_str())
            .collect();
        ids.sort_by_key(|id| OFFICIAL_PROVIDERS.iter().position(|official| official == id).unwrap_or(usize::MAX));
        ids
    }

    /// 这次请求按哪家、哪个价算。`ts` 是台账里的时间（RFC 3339），取那天生效的价；比最早的记录还早，用最早的。
    pub fn quote(&self, host: &str, model: &str, ts: &str) -> Option<(String, PriceBasis, &Price)> {
        if model.trim().is_empty() {
            return None;
        }
        let by_host = self.providers_for_host(host).into_iter().find_map(|id| Some((id, PriceBasis::Host, self.model_points(id, model)?)));
        let (provider, basis, points) = by_host.or_else(|| {
            OFFICIAL_PROVIDERS
                .iter()
                .find_map(|id| Some((*id, PriceBasis::OfficialList, self.model_points(id, model)?)))
        })?;
        let day = ts.get(..10).unwrap_or("");
        let point = points.iter().rev().find(|point| point.since.as_str() <= day).unwrap_or(&points[0]);
        Some((provider.to_string(), basis, &point.price))
    }

    pub fn estimate(&self, host: &str, model: &str, ts: &str, tokens: TokenCounts) -> Option<CostEstimate> {
        let (provider, basis, price) = self.quote(host, model, ts)?;
        let usd = price.cost_usd(tokens) * time_of_day_multiplier(&provider, ts);
        Some(CostEstimate { usd, provider, basis })
    }
}

impl Price {
    pub fn cost_usd(&self, tokens: TokenCounts) -> f64 {
        let tier = self.tiers.iter().rev().find(|tier| tokens.input > tier.above_input_tokens);
        let (input, output, cache_read, cache_write) = match tier {
            Some(tier) => (tier.input, tier.output, tier.cache_read, tier.cache_write),
            None => (self.input, self.output, self.cache_read, self.cache_write),
        };
        let cached = tokens.cache_hit.min(tokens.input);
        let written = tokens.cache_write.min(tokens.input - cached);
        let plain = tokens.input - cached - written;
        (plain as f64 * input
            + cached as f64 * cache_read.unwrap_or(input)
            + written as f64 * cache_write.unwrap_or(input)
            + tokens.output as f64 * output)
            / 1_000_000.0
    }
}

/// DeepSeek 忙时（工作日 UTC 01:00–04:00、06:00–10:00）按 models.dev 记的闲时价的 2 倍算。
fn time_of_day_multiplier(provider: &str, ts: &str) -> f64 {
    if provider != "deepseek" {
        return 1.0;
    }
    let Ok(at) = DateTime::parse_from_rfc3339(ts) else {
        return 1.0;
    };
    let at = at.with_timezone(&Utc);
    let weekday = !matches!(at.weekday(), Weekday::Sat | Weekday::Sun);
    let peak_hour = matches!(at.hour(), 1..=3 | 6..=9);
    if weekday && peak_hour {
        2.0
    } else {
        1.0
    }
}
