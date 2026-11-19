use std::fs;
use std::path::PathBuf;

use serde_json::json;

use super::*;

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("retain-usage-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    root
}

fn write_ledger(output_root: &Path, job_id: &str, rows: &[serde_json::Value]) {
    let path = job_usage_ledger_path(output_root, job_id);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    let body: String = rows.iter().map(|row| format!("{row}\n")).collect();
    fs::write(path, body).unwrap();
}

fn row(ts: &str, stage: &str, input: u64, output: u64, cache_hit: Option<u64>) -> serde_json::Value {
    json!({"v": 1, "ts": ts, "source": "pipeline", "stage": stage, "model": "deepseek-flash",
           "host": "api.deepseek.com", "input": input, "output": output, "cache_hit": cache_hit,
           "cache_write": null, "reasoning": 7, "usage_reported": true})
}

#[test]
fn ledger_rows_add_up_by_stage_model_and_month() {
    let root = temp_root("ledger");
    write_ledger(&root, "job-a", &[
        row("2026-09-30T23:59:00Z", "translation", 1000, 200, Some(600)),
        row("2026-10-01T00:01:00Z", "translation", 500, 100, None),
        row("2026-10-01T00:02:00Z", "refine_review", 300, 30, Some(0)),
        json!({"ts": "2026-10-01T00:03:00Z", "stage": "translation", "usage_reported": false}),
    ]);
    // 写到一半的坏行不影响其它行。
    let path = job_usage_ledger_path(&root, "job-a");
    let mut raw = fs::read_to_string(&path).unwrap();
    raw.push_str("{\"ts\": \"2026-10-01T00:0");
    fs::write(&path, raw).unwrap();

    let view = summarize_jobs("document", &root, ["job-a"], Vec::new(), &PriceBook::bundled());

    assert_eq!(view.totals.requests, 4);
    assert_eq!(view.totals.requests_without_usage, 1);
    assert_eq!((view.totals.input_tokens, view.totals.output_tokens, view.totals.total_tokens), (1800, 330, 2130));
    // 第二行没报缓存：不算进命中率的分母。
    assert_eq!((view.totals.cache_hit_tokens, view.totals.cache_reported_input_tokens), (600, 1300));
    assert_eq!(view.totals.reasoning_tokens, 21);
    assert_eq!(view.by_stage[0].stage, "translation");
    assert_eq!((view.by_stage[0].label, view.by_stage[0].group), ("翻译", "translation"));
    assert_eq!(view.by_stage[1].stage, "refine_review");
    assert_eq!(view.by_model.len(), 2, "没报用量那行模型为空，单列");
    assert_eq!(view.by_month.iter().map(|m| m.month.as_str()).collect::<Vec<_>>(), ["2026-09", "2026-10"]);
    assert_eq!((view.jobs_counted, view.jobs_estimated_from_reports), (1, 0));
    assert_eq!(view.first_at.as_deref(), Some("2026-09-30T23:59:00Z"));
    let _ = fs::remove_dir_all(root);
}

#[test]
fn old_jobs_are_estimated_from_their_reports() {
    let root = temp_root("legacy");
    let artifacts = JobPaths::for_job(&root, "job-old").artifacts_dir;
    fs::create_dir_all(artifacts.join("refine_history")).unwrap();
    fs::write(artifacts.join("translation_diagnostics.json"), json!({
        "model": "qwen3.8-flash", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "token_usage": {"requests_with_usage": 113, "prompt_tokens": 194285, "completion_tokens": 28947,
                        "total_tokens": 223232, "prompt_cache_hit_tokens": 0, "prompt_cache_miss_tokens": 0}
    }).to_string()).unwrap();
    let report = |generated_at: &str, review: u64| json!({
        "generated_at": generated_at,
        "models": {"reviewer": {"model": "qwen3.8-flash", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"},
                   "fixer": {"model": "qwen3.8-max", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"}},
        "token_usage": {"by_phase": {"review": {"requests": 15, "prompt_tokens": review, "completion_tokens": 90},
                                     "fix": {"requests": 2, "prompt_tokens": 400, "completion_tokens": 100}}}
    }).to_string();
    fs::write(artifacts.join("refine_report.v1.json"), report("2026-10-09T01:56:00+00:00", 114884)).unwrap();
    fs::write(artifacts.join("refine_history/refine_report-1.v1.json"), report("2026-10-08T10:00:00+00:00", 1000)).unwrap();

    let view = summarize_jobs("document", &root, ["job-old"], Vec::new(), &PriceBook::bundled());

    assert_eq!((view.jobs_counted, view.jobs_estimated_from_reports), (1, 1));
    let stage = |name: &str| view.by_stage.iter().find(|s| s.stage == name).unwrap().usage.clone();
    assert_eq!(stage("translation").total_tokens, 223232);
    assert_eq!(stage("translation").cache_reported_input_tokens, 0, "旧诊断命中、未命中都是 0：当成没报缓存");
    assert_eq!(stage("refine_review").input_tokens, 114884 + 1000, "当前报告和历史报告都算");
    assert_eq!(stage("refine_fix").requests, 4);
    assert!(view.by_model.iter().any(|m| m.model == "qwen3.8-max"), "修改阶段记在 fixer 模型上");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn reports_already_covered_by_the_ledger_are_not_counted_twice() {
    let root = temp_root("mixed");
    let artifacts = JobPaths::for_job(&root, "job-mixed").artifacts_dir;
    fs::create_dir_all(artifacts.join("refine_history")).unwrap();
    // 台账出现前的翻译与第一次精修，台账出现后的第二次精修。
    fs::write(artifacts.join("translation_diagnostics.json"), json!({
        "model": "m", "token_usage": {"requests_with_usage": 10, "prompt_tokens": 5000, "completion_tokens": 500}
    }).to_string()).unwrap();
    fs::write(artifacts.join("refine_history/old.v1.json"), json!({
        "generated_at": "2026-10-08T00:00:00+00:00",
        "token_usage": {"by_phase": {"review": {"requests": 3, "prompt_tokens": 900, "completion_tokens": 9}}}
    }).to_string()).unwrap();
    fs::write(artifacts.join("refine_report.v1.json"), json!({
        "generated_at": "2026-10-10T00:05:00+00:00",
        "token_usage": {"by_phase": {"review": {"requests": 2, "prompt_tokens": 800, "completion_tokens": 8}}}
    }).to_string()).unwrap();
    write_ledger(&root, "job-mixed", &[row("2026-10-10T00:01:00Z", "refine_review", 800, 8, None)]);

    let view = summarize_jobs("document", &root, ["job-mixed"], Vec::new(), &PriceBook::bundled());

    let stage = |name: &str| view.by_stage.iter().find(|s| s.stage == name).unwrap().usage.clone();
    assert_eq!(stage("translation").input_tokens, 5000, "台账里没有翻译侧的行：翻译仍按旧诊断折算");
    assert_eq!(stage("refine_review").input_tokens, 900 + 800, "新的那次精修只按台账算一次");
    let _ = fs::remove_dir_all(root);
}

#[test]
fn a_translated_job_with_a_ledger_ignores_its_diagnostics() {
    let root = temp_root("new");
    let artifacts = JobPaths::for_job(&root, "job-new").artifacts_dir;
    fs::create_dir_all(&artifacts).unwrap();
    fs::write(artifacts.join("translation_diagnostics.json"), json!({
        "token_usage": {"requests_with_usage": 1, "prompt_tokens": 1000, "completion_tokens": 100}
    }).to_string()).unwrap();
    write_ledger(&root, "job-new", &[row("2026-10-10T00:01:00Z", "term_prescan", 1000, 100, Some(0))]);

    let view = summarize_jobs("document", &root, ["job-new"], Vec::new(), &PriceBook::bundled());

    assert_eq!(view.totals.input_tokens, 1000);
    assert_eq!(view.jobs_estimated_from_reports, 0);
    let _ = fs::remove_dir_all(root);
}

#[test]
fn assistant_rows_and_job_directories_feed_the_global_summary() {
    let root = temp_root("global");
    let output_root = root.join("jobs");
    write_ledger(&output_root, "job-1", &[row("2026-10-10T00:01:00Z", "translation", 10, 1, None)]);
    fs::create_dir_all(output_root.join("job-empty")).unwrap();
    let assistant = assistant_usage_ledger_path(&root);
    fs::create_dir_all(assistant.parent().unwrap()).unwrap();
    fs::write(&assistant, format!("{}\n", json!({"ts": "2026-10-10T00:02:00Z", "source": "assistant",
        "stage": "assistant_ask", "model": "deepseek-flash", "input": 50, "output": 5, "document_id": "doc-1"}))).unwrap();

    let ids = all_job_ids(&output_root);
    let view = summarize_jobs("all", &output_root, ids.iter().map(String::as_str), read_ledger(&assistant), &PriceBook::bundled());

    assert_eq!(ids, ["job-1", "job-empty"]);
    assert_eq!(view.jobs_counted, 1, "没用量的任务不算");
    assert_eq!(view.totals.total_tokens, 66);
    let ask = view.by_stage.iter().find(|s| s.stage == "assistant_ask").unwrap();
    assert_eq!((ask.label, ask.group), ("助手问答", "assistant"));
    let _ = fs::remove_dir_all(root);
}

/// 台账里的时间戳是原样的字符串：前 7 个字节切在多字节字符中间（手改过、别的工具写的）以前会 panic，
/// 整个 `/usage` 500。取不出 `YYYY-MM` 的行照样计入总数，只是不进按月、不当最早最晚时间。
#[test]
fn odd_timestamps_are_left_out_of_the_monthly_breakdown() {
    let root = temp_root("odd-ts");
    write_ledger(&root, "job-odd", &[
        row("2026-10-01T00:00:00Z", "translation", 100, 10, None),
        row("2026年10月1日", "translation", 200, 20, None),
        row("garbage-ts", "translation", 300, 30, None),
        row("20261001", "translation", 400, 40, None),
        // 第 7 个字节落在「月」中间：以前 `ts[..7]` 直接 panic。
        row("2026-1月1日", "translation", 500, 50, None),
    ]);

    let view = summarize_jobs("document", &root, ["job-odd"], Vec::new(), &PriceBook::bundled());

    assert_eq!(view.totals.requests, 5);
    assert_eq!(view.totals.input_tokens, 1500);
    assert_eq!(view.by_month.iter().map(|m| m.month.as_str()).collect::<Vec<_>>(), ["2026-10"]);
    assert_eq!(view.by_month[0].usage.input_tokens, 100);
    assert_eq!(view.first_at.as_deref(), Some("2026-10-01T00:00:00Z"));
    assert_eq!(view.last_at.as_deref(), Some("2026-10-01T00:00:00Z"));
    let _ = fs::remove_dir_all(root);
}

/// 响应字段和契约 token-usage.v1 一字不差：Rust 多一个或契约多一个都红。
#[test]
fn view_fields_match_the_token_usage_contract() {
    let schema: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contracts/token-usage.v1.schema.json"))
            .expect("read contract"),
    )
    .unwrap();
    let record = UsageRecord {
        ts: "2026-10-10T00:00:00Z".into(),
        stage: "refine_review".into(),
        requests: 1,
        input: 10,
        output: 2,
        cache_hit: Some(4),
        ..UsageRecord::default()
    };
    let view = serde_json::to_value(summarize("document", &[record], (1, 0), &PriceBook::bundled())).unwrap();
    let keys = |value: &serde_json::Value| {
        let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    };
    let required = |name: &str| {
        let mut keys: Vec<String> = schema["definitions"][name]["required"]
            .as_array()
            .unwrap()
            .iter()
            .map(|key| key.as_str().unwrap().to_string())
            .collect();
        keys.sort();
        keys
    };
    assert_eq!(keys(&view), required("UsageSummaryView"));
    assert_eq!(keys(&view["totals"]), required("UsageBucket"));
    assert_eq!(keys(&view["by_stage"][0]), required("UsageStageView"));
    assert_eq!(keys(&view["by_model"][0]), required("UsageModelView"));
    assert_eq!(keys(&view["by_month"][0]), required("UsageMonthView"));
    assert_eq!(keys(&view["pricing"]), required("UsagePricingView"));
    let groups: Vec<&str> = schema["definitions"]["UsageStageGroup"]["enum"]
        .as_array()
        .unwrap()
        .iter()
        .map(|group| group.as_str().unwrap())
        .collect();
    for stage in ["translation", "term_review", "refine_chief", "assistant_ask", "failure_diagnosis", "new_stage"] {
        assert!(groups.contains(&stage_label(stage).1), "{stage}");
    }
}

/// 花费（2026-11-19）：按内置快照的价估算；缓存命中按缓存价，DeepSeek 忙时乘 2，查不到价的单数。
#[test]
fn ledger_rows_are_priced_and_unknown_models_are_counted_as_unpriced() {
    let root = temp_root("cost");
    let haiku = |ts: &str, host: &str| json!({"v": 1, "ts": ts, "stage": "translation", "model": "claude-haiku-5-5",
        "host": host, "input": 1_000_000, "output": 100_000, "cache_hit": 400_000, "cache_write": 0, "usage_reported": true});
    write_ledger(&root, "job-cost", &[
        haiku("2026-11-19T12:00:00Z", "api.anthropic.com"),
        haiku("2026-11-19T12:00:00Z", "proxy.example.com"),
        row("2026-11-21T02:00:00Z", "translation", 1_000_000, 0, Some(0)),
        row("2026-11-19T02:00:00Z", "translation", 1_000_000, 0, Some(0)),
        json!({"ts": "2026-11-19T12:00:00Z", "stage": "translation", "model": "home-made-model", "host": "llm.local",
               "input": 5000, "output": 500, "usage_reported": true}),
    ]);
    let prices = PriceBook::bundled();
    let view = summarize_jobs("document", &root, ["job-cost"], Vec::new(), &prices);

    let (_, _, haiku_price) = prices.quote("api.anthropic.com", "claude-haiku-5-5", "2026-11-19T12:00:00Z").unwrap();
    // 100 万输入超过 10 万门槛，整次按加价档；40 万命中缓存。
    let tier = haiku_price.tiers.last().unwrap();
    let one_haiku = (600_000.0 * tier.input + 400_000.0 * tier.cache_read.unwrap() + 100_000.0 * tier.output) / 1e6;
    let (_, _, flash) = prices.quote("api.deepseek.com", "deepseek-flash", "2026-11-19T02:00:00Z").unwrap();
    let expected = 2.0 * one_haiku + flash.input + 2.0 * flash.input;
    assert!((view.totals.estimated_cost_usd - expected).abs() < 1e-5, "{} vs {expected}", view.totals.estimated_cost_usd);
    assert_eq!((view.totals.priced_requests, view.totals.list_priced_requests, view.totals.unpriced_requests), (4, 1, 1));

    let model = |model: &str, host: &str| view.by_model.iter().find(|m| m.model == model && m.host == host).unwrap();
    assert_eq!(model("claude-haiku-5-5", "api.anthropic.com").price_basis, Some(PriceBasis::Host));
    assert_eq!(model("claude-haiku-5-5", "proxy.example.com").price_basis, Some(PriceBasis::OfficialList));
    assert_eq!(model("claude-haiku-5-5", "proxy.example.com").price_provider.as_deref(), Some("anthropic"));
    let unknown = model("home-made-model", "llm.local");
    assert_eq!((unknown.price_basis, unknown.usage.unpriced_requests, unknown.usage.estimated_cost_usd), (None, 1, 0.0));
    assert_eq!(view.pricing.currency, "USD");
    assert!(view.pricing.synced_at.is_none() && view.pricing.snapshot_date.is_some());
    let _ = fs::remove_dir_all(root);
}

/// GLM-OCR（2026-11-19 起记账）：阶段 ocr 显示「OCR 识别」、归译前准备，按智谱价估算；
/// 台账里只有 OCR 的行不算「翻译已经逐条记了」，旧诊断照样折算。
#[test]
fn ocr_rows_are_priced_and_do_not_hide_legacy_translation_reports() {
    let root = temp_root("ocr");
    let artifacts = JobPaths::for_job(&root, "job-ocr").artifacts_dir;
    fs::create_dir_all(&artifacts).unwrap();
    fs::write(artifacts.join("translation_diagnostics.json"), json!({
        "model": "m", "token_usage": {"requests_with_usage": 2, "prompt_tokens": 3000, "completion_tokens": 300}
    }).to_string()).unwrap();
    write_ledger(&root, "job-ocr", &[json!({"v": 1, "ts": "2026-11-19T12:00:00Z", "stage": "ocr", "model": "glm-ocr",
        "host": "open.bigmodel.cn", "protocol": "glm_ocr", "input": 700_000, "output": 100_000, "cache_hit": null,
        "cache_write": null, "reasoning": null, "usage_reported": true})]);

    let view = summarize_jobs("document", &root, ["job-ocr"], Vec::new(), &PriceBook::bundled());

    let ocr = view.by_stage.iter().find(|s| s.stage == "ocr").unwrap();
    assert_eq!((ocr.label, ocr.group), ("OCR 识别", "preparation"));
    assert_eq!(ocr.usage.priced_requests, 1);
    assert!((ocr.usage.estimated_cost_usd * 7.16 - 0.16).abs() < 1e-5, "{}", ocr.usage.estimated_cost_usd);
    let translation = view.by_stage.iter().find(|s| s.stage == "translation").unwrap();
    assert_eq!(translation.usage.input_tokens, 3000, "旧诊断照样折算");
    let _ = fs::remove_dir_all(root);
}

// ---- 估价（2026-11-19）----

use super::estimate::{
    estimate_from_history, estimate_from_library, library_sample, lookup_prices, PriceLookupInput, PriceLookupItem, RunCandidate,
};

fn run(job_id: &str, pages: u64) -> RunCandidate {
    RunCandidate { job_id: job_id.to_string(), pages }
}

fn contract_required(name: &str) -> Vec<String> {
    let schema: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contracts/token-usage.v1.schema.json")).unwrap(),
    )
    .unwrap();
    let mut keys: Vec<String> = schema["definitions"][name]["required"].as_array().unwrap().iter().map(|k| k.as_str().unwrap().to_string()).collect();
    keys.sort();
    keys
}

fn sorted_keys(value: &serde_json::Value) -> Vec<String> {
    let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
    keys.sort();
    keys
}

fn haiku_row(ts: &str, stage: &str, input: u64, output: u64, cache_hit: u64) -> serde_json::Value {
    json!({"v": 1, "ts": ts, "stage": stage, "model": "claude-haiku-5-5", "host": "api.anthropic.com",
           "input": input, "output": output, "cache_hit": cache_hit, "cache_write": 0, "usage_reported": true})
}

#[test]
fn price_lookup_quotes_each_connection_with_the_usage_rules() {
    let prices = PriceBook::bundled();
    let item = |base_url: &str, model: &str| PriceLookupItem { base_url: base_url.to_string(), model: model.to_string() };
    let view = lookup_prices(&prices, &PriceLookupInput { items: vec![
        item("https://api.deepseek.com/v1", "deepseek-flash"),
        item("https://proxy.example.com/v1", "claude-haiku-5-5"),
        item("http://1.2.3.4:8000/v1", "home-made"),
    ] });
    let value = serde_json::to_value(&view).unwrap();
    assert_eq!(sorted_keys(&value), contract_required("PriceLookupView"));
    assert_eq!(sorted_keys(&value["items"][0]), contract_required("PriceQuoteView"));
    assert_eq!(sorted_keys(&value["items"][0]["price"]), contract_required("PriceView"));
    assert_eq!(sorted_keys(&value["items"][1]["price"]["tiers"][0]), contract_required("PriceTierView"));
    assert_eq!(value["items"][0]["price_provider"], "deepseek");
    assert_eq!(value["items"][0]["price"]["peak_multiplier"], 2.0, "DeepSeek 忙时 2 倍");
    assert_eq!((value["items"][1]["price_basis"].clone(), value["items"][1]["price"]["peak_multiplier"].clone()), (json!("official_list"), json!(1.0)));
    assert_eq!((value["items"][2]["price"].clone(), value["items"][2]["price_basis"].clone()), (serde_json::Value::Null, serde_json::Value::Null));
    assert_eq!(value["pricing"]["usd_cny"], 7.16);
}

/// 按这本书最近一次翻译重算：OCR 不算（复用），翻译、精修分开；下限按上次的缓存，上限当缓存全没命中。
#[test]
fn a_book_is_estimated_from_its_latest_translation_run() {
    let root = temp_root("estimate-history");
    write_ledger(&root, "job-old", &[haiku_row("2026-11-01T00:00:00Z", "translation", 999_999, 1, 0)]);
    write_ledger(&root, "job-new", &[
        json!({"v": 1, "ts": "2026-11-18T00:00:00Z", "stage": "ocr", "model": "glm-ocr", "host": "open.bigmodel.cn", "input": 700000, "output": 100000, "usage_reported": true}),
        haiku_row("2026-11-18T01:00:00Z", "translation", 10_000, 2_000, 4_000),
        haiku_row("2026-11-18T01:01:00Z", "term_prescan", 5_000, 500, 0),
        haiku_row("2026-11-18T02:00:00Z", "refine_review", 3_000, 300, 0),
    ]);
    let prices = PriceBook::bundled();
    let view = estimate_from_history(&prices, &root, &[run("job-old", 12), run("job-new", 12)], "https://api.deepseek.com", "deepseek-flash", Some(12)).unwrap();
    let value = serde_json::to_value(&view).unwrap();
    assert_eq!(sorted_keys(&value), contract_required("UsageEstimateView"));
    assert_eq!(sorted_keys(&value["translation"]), contract_required("UsageEstimatePart"));
    assert_eq!((view.basis, view.source_job_id.as_deref(), view.pages), ("book_history", Some("job-new"), Some(12)));

    let translation = view.translation.as_ref().unwrap();
    assert_eq!((translation.requests, translation.input_tokens, translation.cache_hit_tokens), (2, 15_000, 4_000), "OCR 不算");
    let (_, _, flash) = prices.quote("api.deepseek.com", "deepseek-flash", "2026-11-19T00:00:00Z").unwrap();
    let low = (11_000.0 * flash.input + 4_000.0 * flash.cache_read.unwrap() + 2_500.0 * flash.output) / 1e6;
    let high = (15_000.0 * flash.input + 2_500.0 * flash.output) / 1e6 * 2.0;
    assert!((translation.low_usd.unwrap() - low).abs() < 1e-6, "{translation:?}");
    assert!((translation.high_usd.unwrap() - high).abs() < 1e-6, "{translation:?}");
    assert!((translation.low_cny.unwrap() - low * 7.16).abs() < 1e-3);
    assert_eq!(view.refine.as_ref().unwrap().input_tokens, 3_000);

    let unpriced = estimate_from_history(&prices, &root, &[run("job-new", 12)], "http://1.2.3.4/v1", "home-made", None).unwrap();
    assert_eq!((unpriced.price_basis, unpriced.translation.as_ref().unwrap().low_usd), (None, None), "查不到价照样给 token");
    assert!(estimate_from_history(&prices, &root, &[run("job-none", 12)], "https://api.deepseek.com", "deepseek-flash", None).is_none());

    // 那次只翻了 6 页、整本 12 页：按页数比例放大一倍
    let half = estimate_from_history(&prices, &root, &[run("job-new", 6)], "https://api.deepseek.com", "deepseek-flash", Some(12)).unwrap();
    let doubled = half.translation.unwrap();
    assert_eq!((doubled.requests, doubled.input_tokens), (4, 30_000));
    assert!((doubled.low_usd.unwrap() - 2.0 * low).abs() < 1e-6);
    let _ = fs::remove_dir_all(root);
}

/// 没翻译过的书：书库各本书最近一次翻译合起来按页平均，再乘页数。
#[test]
fn an_untranslated_book_is_estimated_from_the_library_average_per_page() {
    let root = temp_root("estimate-library");
    write_ledger(&root, "job-a", &vec![haiku_row("2026-11-18T00:00:00Z", "translation", 20_000, 4_000, 0); 2]);
    write_ledger(&root, "job-b", &vec![haiku_row("2026-11-18T00:00:00Z", "translation", 20_000, 4_000, 0); 2]);
    let books = vec![vec![run("job-a", 10)], vec![run("job-b", 30)], vec![run("job-a", 0)], vec![run("job-none", 5)]];
    let sample = library_sample(&root, books);
    assert_eq!(sample.documents, 2, "没页数、没翻译记录的书不算");
    let prices = PriceBook::bundled();
    let view = estimate_from_library(&prices, &sample, "https://api.anthropic.com", "claude-haiku-5-5", 20);
    assert_eq!((view.basis, view.sample_documents, view.sample_pages, view.pages), ("library_average", 2, 40, Some(20)));
    let translation = view.translation.unwrap();
    assert_eq!((translation.requests, translation.input_tokens, translation.output_tokens), (2, 40_000, 8_000), "40 页 4 次请求，20 页 2 次");
    let (_, _, haiku) = prices.quote("api.anthropic.com", "claude-haiku-5-5", "2026-11-19T00:00:00Z").unwrap();
    let expected = 2.0 * (20_000.0 * haiku.input + 4_000.0 * haiku.output) / 1e6;
    assert!((translation.low_usd.unwrap() - expected).abs() < 1e-6);
    assert!(view.refine.is_none());

    let empty = estimate_from_library(&prices, &library_sample(&root, Vec::new()), "https://api.anthropic.com", "claude-haiku-5-5", 20);
    assert_eq!((empty.basis, empty.translation.is_none()), ("none", true));
    let _ = fs::remove_dir_all(root);
}
