use chrono::TimeZone;
use serde_json::json;

use super::sync::apply_price_source;
use super::*;

fn source(haiku_input: f64) -> Value {
    json!({
        "anthropic": {"id": "anthropic", "models": {
            "claude-haiku-5-5": {"cost": {"input": haiku_input, "output": 0.5, "cache_read": 0.01, "cache_write": 0.125,
                "tiers": [{"input": 0.5, "output": 2.5, "cache_read": 0.05, "cache_write": 0.625, "tier": {"type": "context", "size": 100000}}]}}
        }},
        "deepseek": {"id": "deepseek", "api": "https://api.deepseek.com", "models": {
            "deepseek-flash": {"cost": {"input": 0.15, "output": 0.6, "cache_read": 0.003}}
        }},
        "zhipuai-coding-plan": {"id": "zhipuai-coding-plan", "api": "https://open.bigmodel.cn/api/coding/paas/v4", "models": {
            "glm-5.3-flash": {"cost": {"input": 0, "output": 0}}
        }},
        "zhipuai": {"id": "zhipuai", "api": "https://open.bigmodel.cn/api/paas/v4", "models": {
            "glm-5.3-flash": {"cost": {"input": 0.12, "output": 0.42}}
        }},
        "no-host": {"id": "no-host", "models": {"x": {"cost": {"input": 1, "output": 1}}}},
        "_snapshot_date": "2026-11-01"
    })
}

fn tokens(input: u64, output: u64, cache_hit: u64, cache_write: u64) -> TokenCounts {
    TokenCounts { input, output, cache_hit, cache_write }
}

#[test]
fn providers_are_matched_by_api_host_and_unknown_hosts_fall_back_to_the_official_list_price() {
    let book = PriceBook::from_models_dev(&source(0.1), "test", "2026-11-01");
    assert!(!book.providers.contains_key("no-host"), "没有接口域名的服务商查不到，不留");

    let (provider, basis, _) = book.quote("api.anthropic.com", "claude-haiku-5-5", "2026-11-19T00:00:00Z").unwrap();
    assert_eq!((provider.as_str(), basis), ("anthropic", PriceBasis::Host));

    let (provider, basis, _) = book.quote("proxy.example.com", "anthropic/claude-haiku-5-5", "2026-11-19T00:00:00Z").unwrap();
    assert_eq!((provider.as_str(), basis), ("anthropic", PriceBasis::OfficialList), "代理域名、带前缀的编号按官方标价");

    // 同一个域名下的包月套餐不抢官方的价。
    let (provider, _, price) = book.quote("open.bigmodel.cn", "glm-5.3-flash", "2026-11-19T00:00:00Z").unwrap();
    assert_eq!((provider.as_str(), price.input), ("zhipuai", 0.12));

    assert!(book.quote("api.anthropic.com", "made-up-model", "2026-11-19T00:00:00Z").is_none());
    assert!(book.quote("api.anthropic.com", "", "2026-11-19T00:00:00Z").is_none());
}

#[test]
fn cost_splits_cached_and_written_input_and_uses_the_long_context_tier() {
    let book = PriceBook::from_models_dev(&source(0.1), "test", "2026-11-01");
    let (_, _, price) = book.quote("api.anthropic.com", "claude-haiku-5-5", "2026-11-19T00:00:00Z").unwrap();
    // 10 万输入里 4 万命中缓存、1 万写缓存，5 万普通；输出 2 万。
    let cost = price.cost_usd(tokens(100_000, 20_000, 40_000, 10_000));
    let expected = (50_000.0 * 0.1 + 40_000.0 * 0.01 + 10_000.0 * 0.125 + 20_000.0 * 0.5) / 1e6;
    assert!((cost - expected).abs() < 1e-12, "{cost} vs {expected}");
    // 超过 10 万输入，整次请求按加价档。
    let long = price.cost_usd(tokens(100_001, 0, 0, 0));
    assert!((long - 100_001.0 * 0.5 / 1e6).abs() < 1e-12, "{long}");
    // 报的缓存比输入还多（服务商算法不一致）也不会算出负数。
    assert!(price.cost_usd(tokens(10, 0, 50, 50)) >= 0.0);
}

#[test]
fn deepseek_peak_hours_cost_twice_the_off_peak_price() {
    let book = PriceBook::from_models_dev(&source(0.1), "test", "2026-11-01");
    let one_million_in = tokens(1_000_000, 0, 0, 0);
    let at = |ts: &str| book.estimate("api.deepseek.com", "deepseek-flash", ts, one_million_in).unwrap().usd;
    assert!((at("2026-11-19T02:30:00Z") - 0.30).abs() < 1e-9, "周四 UTC 02:30 是忙时");
    assert!((at("2026-11-19T08:00:00+00:00") - 0.30).abs() < 1e-9);
    assert!((at("2026-11-19T05:00:00Z") - 0.15).abs() < 1e-9, "04–06 点是闲时");
    assert!((at("2026-11-19T10:00:00Z") - 0.15).abs() < 1e-9, "10 点起闲时");
    assert!((at("2026-11-21T02:30:00Z") - 0.15).abs() < 1e-9, "周六全天闲时");
    assert!((at("not a time") - 0.15).abs() < 1e-9, "时间认不出按闲时");
}

#[test]
fn syncing_appends_changed_prices_and_old_requests_keep_the_old_price() {
    let root = std::env::temp_dir().join(format!("retainpdf-pricing-{}", fastrand::u64(..)));
    let day1 = Utc.with_ymd_and_hms(2026, 11, 10, 3, 0, 0).unwrap();
    let day2 = Utc.with_ymd_and_hms(2026, 11, 15, 3, 0, 0).unwrap();
    let first = apply_price_source(&root, &source(0.2), "test", day1).unwrap();
    assert!(first.appended > 0);
    let same = apply_price_source(&root, &source(0.2), "test", day2).unwrap();
    assert_eq!(same.appended, 0, "价格没变不追加");
    let changed = apply_price_source(&root, &source(0.1), "test", day2).unwrap();
    assert_eq!(changed.appended, 1, "只有 Haiku 变了");

    let book = PriceBook::load(&root);
    assert_eq!(book.synced_at.as_deref(), Some("2026-11-15T03:00:00Z"));
    let input_at = |ts: &str| book.quote("api.anthropic.com", "claude-haiku-5-5", ts).unwrap().2.input;
    assert_eq!(input_at("2026-11-12T00:00:00Z"), 0.2, "降价前的请求按旧价");
    assert_eq!(input_at("2026-11-16T00:00:00Z"), 0.1);
    assert_eq!(input_at("2026-10-01T00:00:00Z"), *book.providers["anthropic"].models["claude-haiku-5-5"].first().map(|p| &p.price.input).unwrap(), "比最早的记录还早，用最早的");

    assert!(!sync_due(&root, day2 + chrono::Duration::hours(19)), "20 小时内不再拉");
    assert!(sync_due(&root, day2 + chrono::Duration::hours(20)));
    assert!(sync_due(Path::new("/nonexistent-retainpdf-data-root"), day2), "没同步过就拉");

    assert!(apply_price_source(&root, &json!({"x": {}}), "test", day2).is_err(), "源坏了不覆盖历史");
    assert_eq!(PriceBook::load(&root).synced_at.as_deref(), Some("2026-11-15T03:00:00Z"));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn the_bundled_snapshot_holds_exactly_the_official_providers() {
    // 快照由 ops/development/update_model_prices.py 生成，它的 OFFICIAL_PROVIDERS 要和这边一致。
    let raw: Value = serde_json::from_str(BUNDLED_SNAPSHOT).unwrap();
    let mut in_snapshot: Vec<&str> = raw.as_object().unwrap().keys().map(String::as_str).filter(|key| !key.starts_with('_')).collect();
    let mut official: Vec<&str> = OFFICIAL_PROVIDERS.to_vec();
    in_snapshot.sort_unstable();
    official.sort_unstable();
    assert_eq!(in_snapshot, official, "改了官方服务商清单，要同步改脚本并重新生成快照");
}

#[test]
fn the_bundled_snapshot_prices_the_models_we_use() {
    let book = PriceBook::load(Path::new("/nonexistent-retainpdf-data-root"));
    assert!(book.synced_at.is_none() && book.snapshot_date.is_some(), "没同步过用内置快照");
    for (host, model) in [
        ("api.anthropic.com", "claude-haiku-5-5"),
        ("dashscope.aliyuncs.com", "qwen3.8-flash"),
        ("api.deepseek.com", "deepseek-flash"),
        ("open.bigmodel.cn", "glm-5.3-flash"),
    ] {
        let (_, basis, _) = book.quote(host, model, "2026-11-19T00:00:00Z").unwrap_or_else(|| panic!("{host} {model}"));
        assert_eq!(basis, PriceBasis::Host, "{host} {model}");
    }
}

/// 真的去 models.dev 拉一次（要联网，默认不跑）：
/// `cargo test -p retainpdf-providers pricing::tests::live_sync -- --ignored --nocapture`
#[tokio::test]
#[ignore]
async fn live_sync_from_models_dev() {
    let root = std::env::temp_dir().join(format!("retainpdf-pricing-live-{}", fastrand::u64(..)));
    let outcome = sync_price_book(&root, DEFAULT_PRICE_SOURCE_URL).await.expect("sync");
    let size = std::fs::metadata(price_book_path(&root)).unwrap().len();
    println!("{outcome:?}, {size} bytes");
    let book = PriceBook::load(&root);
    assert!(book.synced_at.is_some());
    for (host, model) in [("api.anthropic.com", "claude-haiku-5-5"), ("api.deepseek.com", "deepseek-flash")] {
        let (provider, basis, price) = book.quote(host, model, "2026-11-19T12:00:00Z").expect(model);
        println!("{host} {model}: {provider} {basis:?} {price:?}");
    }
    let again = sync_price_book(&root, DEFAULT_PRICE_SOURCE_URL).await.expect("sync again");
    println!("second sync appended {}", again.appended);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn glm_ocr_is_priced_from_the_local_table_until_models_dev_lists_it() {
    let book = PriceBook::bundled();
    let (provider, basis, price) = book.quote("open.bigmodel.cn", "glm-ocr", "2026-11-19T12:00:00Z").expect("glm-ocr priced");
    assert_eq!((provider.as_str(), basis), ("zhipuai", PriceBasis::Host));
    assert!((price.input - 0.2 / 7.16).abs() < 1e-12 && price.input == price.output, "0.2 元/百万 token，输入输出同价");
    // 一千页大约 80 万 token：约 0.16 元。
    let cost = price.cost_usd(TokenCounts { input: 700_000, output: 100_000, ..TokenCounts::default() });
    assert!((cost * 7.16 - 0.16).abs() < 1e-9, "{cost}");

    // 同步下来的价格历史不带补充价（以代码为准），读的时候并上；models.dev 收录了以它为准。
    let root = std::env::temp_dir().join(format!("retainpdf-pricing-local-{}", fastrand::u64(..)));
    let now = Utc.with_ymd_and_hms(2026, 11, 20, 0, 0, 0).unwrap();
    let mut listed = source(0.1);
    listed["zhipuai"]["models"]["glm-ocr"] = json!({"cost": {"input": 0.05, "output": 0.05}});
    apply_price_source(&root, &source(0.1), "test", now).unwrap();
    assert!(!PriceBook::load_synced(&root).unwrap().providers["zhipuai"].models.contains_key("glm-ocr"));
    assert!(PriceBook::load(&root).quote("open.bigmodel.cn", "glm-ocr", "2026-11-20T00:00:00Z").is_some());
    apply_price_source(&root, &listed, "test", now).unwrap();
    let (_, _, price) = PriceBook::load(&root).quote("open.bigmodel.cn", "glm-ocr", "2026-11-20T00:00:00Z").map(|(a, b, p)| (a, b, p.clone())).unwrap();
    assert_eq!(price.input, 0.05);
    let _ = std::fs::remove_dir_all(&root);
}
