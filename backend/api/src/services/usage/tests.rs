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

    let view = summarize_jobs("job", &root, ["job-a"], Vec::new());

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

    let view = summarize_jobs("job", &root, ["job-old"], Vec::new());

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

    let view = summarize_jobs("job", &root, ["job-mixed"], Vec::new());

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

    let view = summarize_jobs("job", &root, ["job-new"], Vec::new());

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
    let view = summarize_jobs("all", &output_root, ids.iter().map(String::as_str), read_ledger(&assistant));

    assert_eq!(ids, ["job-1", "job-empty"]);
    assert_eq!(view.jobs_counted, 1, "没用量的任务不算");
    assert_eq!(view.totals.total_tokens, 66);
    let ask = view.by_stage.iter().find(|s| s.stage == "assistant_ask").unwrap();
    assert_eq!((ask.label, ask.group), ("助手问答", "assistant"));
    let _ = fs::remove_dir_all(root);
}

/// 响应字段和契约 token-usage.v1 一字不差：Rust 多一个或契约多一个都红。
#[test]
fn view_fields_match_the_token_usage_contract() {
    let schema: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../contracts/token-usage.v1.schema.json"))
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
    let view = serde_json::to_value(summarize("job", &[record], (1, 0))).unwrap();
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
