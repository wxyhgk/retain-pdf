//! 模型用量（token）汇总：一个任务、一本书、全部。
//!
//! 数据来源：
//! - 任务台账 `<job>/artifacts/token-usage.v1.jsonl`：流水线每次模型返回追加一行（Python
//!   `translate/llm/shared/usage_ledger.py`；路径由 jobsd 经 `RETAIN_USAGE_LEDGER` 给）。
//! - 助手台账 `<data_root>/usage/assistant.v1.jsonl`：AI 助手每次模型返回追加一行。
//! - 有台账之前的旧任务：从 `translation_diagnostics.json` 和精修报告（含 `refine_history/`）
//!   里的 `token_usage` 折算。旧报告丢了思考、精修还丢了缓存，所以这部分只算得出输入输出；
//!   汇总里单独数出有几个任务是这么折算的。
//!
//! 删除的书连同任务目录一起删掉，不再计入总量。

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use crate::storage_paths::JobPaths;

pub const ASSISTANT_USAGE_LEDGER_RELATIVE_PATH: &str = "usage/assistant.v1.jsonl";

pub fn job_usage_ledger_path(output_root: &Path, job_id: &str) -> PathBuf {
    JobPaths::for_job(output_root, job_id).token_usage_ledger()
}

pub fn assistant_usage_ledger_path(data_root: &Path) -> PathBuf {
    data_root.join(ASSISTANT_USAGE_LEDGER_RELATIVE_PATH)
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct UsageBucket {
    pub requests: u64,
    /// 服务商没报用量的请求数（这些请求的 token 没算进来）。
    pub requests_without_usage: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    /// 缓存命中的输入 token（包含在 input_tokens 里）。
    pub cache_hit_tokens: u64,
    /// 报了缓存数据的那些请求的输入 token。命中率 = cache_hit_tokens / 它；为 0 表示不知道。
    pub cache_reported_input_tokens: u64,
    /// 写入缓存的输入 token（只有 Anthropic 报；包含在 input_tokens 里）。
    pub cache_write_tokens: u64,
    /// 思考（推理）token（包含在 output_tokens 里；服务商没报时是 0）。
    pub reasoning_tokens: u64,
}

impl UsageBucket {
    fn add(&mut self, record: &UsageRecord) {
        self.requests += record.requests;
        self.requests_without_usage += record.requests_without_usage;
        self.input_tokens += record.input;
        self.output_tokens += record.output;
        self.total_tokens += record.input + record.output;
        if let Some(hit) = record.cache_hit {
            self.cache_hit_tokens += hit;
            self.cache_reported_input_tokens += record.input;
        }
        self.cache_write_tokens += record.cache_write;
        self.reasoning_tokens += record.reasoning;
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct UsageStageView {
    pub stage: String,
    pub label: &'static str,
    /// translation / preparation / refine / assistant / other —— 界面按它分组。
    pub group: &'static str,
    #[serde(flatten)]
    pub usage: UsageBucket,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct UsageModelView {
    pub model: String,
    pub host: String,
    #[serde(flatten)]
    pub usage: UsageBucket,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct UsageMonthView {
    /// `YYYY-MM`（UTC）。
    pub month: String,
    #[serde(flatten)]
    pub usage: UsageBucket,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct UsageSummaryView {
    /// job / document / all
    pub scope: &'static str,
    pub totals: UsageBucket,
    /// 按 total_tokens 从大到小。
    pub by_stage: Vec<UsageStageView>,
    pub by_model: Vec<UsageModelView>,
    /// 按月份从早到晚。
    pub by_month: Vec<UsageMonthView>,
    /// 有用量记录的任务数。
    pub jobs_counted: u64,
    /// 其中从旧报告折算的任务数（没有缓存 / 思考明细）。
    pub jobs_estimated_from_reports: u64,
    pub first_at: Option<String>,
    pub last_at: Option<String>,
}

/// 一条用量：台账里的一行，或从旧报告折算出来的一段。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct UsageRecord {
    pub ts: String,
    pub stage: String,
    pub model: String,
    pub host: String,
    pub requests: u64,
    pub requests_without_usage: u64,
    pub input: u64,
    pub output: u64,
    pub cache_hit: Option<u64>,
    pub cache_write: u64,
    pub reasoning: u64,
    pub document_id: String,
}

fn count(value: &Value, key: &str) -> u64 {
    value.get(key).and_then(Value::as_u64).unwrap_or(0)
}

fn text(value: &Value, key: &str) -> String {
    value.get(key).and_then(Value::as_str).unwrap_or("").trim().to_string()
}

/// 台账的一行。坏行（写到一半断电之类）跳过，不让整份汇总失败。
fn parse_ledger_line(line: &str) -> Option<UsageRecord> {
    let value: Value = serde_json::from_str(line.trim()).ok()?;
    let reported = value.get("usage_reported").and_then(Value::as_bool).unwrap_or(true);
    Some(UsageRecord {
        ts: text(&value, "ts"),
        stage: match text(&value, "stage") {
            stage if stage.is_empty() => "unspecified".to_string(),
            stage => stage,
        },
        model: text(&value, "model"),
        host: text(&value, "host"),
        requests: 1,
        requests_without_usage: u64::from(!reported),
        input: count(&value, "input"),
        output: count(&value, "output"),
        cache_hit: value.get("cache_hit").and_then(Value::as_u64),
        cache_write: count(&value, "cache_write"),
        reasoning: count(&value, "reasoning"),
        document_id: text(&value, "document_id"),
    })
}

pub fn read_ledger(path: &Path) -> Vec<UsageRecord> {
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    raw.lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(parse_ledger_line)
        .collect()
}

fn modified_ts(path: &Path) -> String {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .map(|time| chrono::DateTime::<chrono::Utc>::from(time).format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_default()
}

fn host_of(base_url: &str) -> String {
    url::Url::parse(base_url.trim())
        .ok()
        .and_then(|url| url.host_str().map(str::to_ascii_lowercase))
        .unwrap_or_default()
}

fn is_translation_side(stage: &str) -> bool {
    !stage.starts_with("refine") && stage != "failure_diagnosis"
}

/// 旧任务（或台账出现之前的那几次运行）：从翻译诊断和精修报告折算。
///
/// - 翻译诊断：台账里还没有任何翻译侧的行时才算（有就说明这次翻译已经逐条记了）。
/// - 精修报告：生成时间早于台账第一行的才算（之后的精修台账里已经有了）。
fn legacy_records(job_root: &Path, ledger: &[UsageRecord]) -> Vec<UsageRecord> {
    let mut records = Vec::new();
    let artifacts = job_root.join("artifacts");
    let first_ledger_ts = ledger.iter().map(|record| record.ts.as_str()).filter(|ts| !ts.is_empty()).min();

    if !ledger.iter().any(|record| is_translation_side(&record.stage)) {
        let path = artifacts.join("translation_diagnostics.json");
        if let Some(summary) = fs::read_to_string(&path).ok().and_then(|raw| serde_json::from_str::<Value>(&raw).ok()) {
            let usage = summary.get("token_usage").cloned().unwrap_or(Value::Null);
            let (input, output) = (count(&usage, "prompt_tokens"), count(&usage, "completion_tokens"));
            if input + output > 0 {
                let (hit, miss) = (count(&usage, "prompt_cache_hit_tokens"), count(&usage, "prompt_cache_miss_tokens"));
                records.push(UsageRecord {
                    ts: modified_ts(&path),
                    stage: "translation".to_string(),
                    model: text(&summary, "model"),
                    host: host_of(&text(&summary, "base_url")),
                    requests: count(&usage, "requests_with_usage"),
                    input,
                    output,
                    cache_hit: (hit + miss > 0).then_some(hit),
                    ..UsageRecord::default()
                });
            }
        }
    }

    let mut reports = vec![artifacts.join("refine_report.v1.json")];
    if let Ok(entries) = fs::read_dir(artifacts.join("refine_history")) {
        reports.extend(entries.filter_map(Result::ok).map(|entry| entry.path()));
    }
    for path in reports {
        let Some(report) = fs::read_to_string(&path).ok().and_then(|raw| serde_json::from_str::<Value>(&raw).ok()) else {
            continue;
        };
        let ts = match text(&report, "generated_at") {
            ts if ts.is_empty() => modified_ts(&path),
            ts => normalize_ts(&ts),
        };
        if first_ledger_ts.is_some_and(|first| ts.as_str() >= first) {
            continue;
        }
        let models = report.get("models").cloned().unwrap_or(Value::Null);
        let model_for = |phase: &str| {
            let role = if phase == "review" { "reviewer" } else { "fixer" };
            let entry = models.get(role).cloned().unwrap_or(Value::Null);
            (text(&entry, "model"), host_of(&text(&entry, "base_url")))
        };
        let usage = report.get("token_usage").cloned().unwrap_or(Value::Null);
        let phases = usage.get("by_phase").and_then(Value::as_object).cloned().unwrap_or_default();
        for (phase, bucket) in phases {
            let (input, output) = (count(&bucket, "prompt_tokens"), count(&bucket, "completion_tokens"));
            if input + output == 0 {
                continue;
            }
            let (model, host) = model_for(&phase);
            records.push(UsageRecord {
                ts: ts.clone(),
                stage: format!("refine_{phase}"),
                model,
                host,
                requests: count(&bucket, "requests"),
                input,
                output,
                ..UsageRecord::default()
            });
        }
    }
    records
}

/// `2026-10-10T03:15:21+00:00` → `2026-10-10T03:15:21Z`，和台账的写法一致才能比大小。
fn normalize_ts(ts: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(ts)
        .map(|time| time.with_timezone(&chrono::Utc).format("%Y-%m-%dT%H:%M:%SZ").to_string())
        .unwrap_or_else(|_| ts.to_string())
}

/// 一个任务的全部用量，以及它是否用了旧报告折算。
pub fn job_usage_records(output_root: &Path, job_id: &str) -> (Vec<UsageRecord>, bool) {
    let paths = JobPaths::for_job(output_root, job_id);
    let mut records = read_ledger(&paths.token_usage_ledger());
    let legacy = legacy_records(&paths.root, &records);
    let estimated = !legacy.is_empty();
    records.extend(legacy);
    (records, estimated)
}

pub fn stage_label(stage: &str) -> (&'static str, &'static str) {
    match stage {
        "translation" => ("翻译", "translation"),
        "classification" => ("版面分类", "translation"),
        "continuation_review" => ("跨页续段检查", "translation"),
        "domain_context" => ("领域判断", "translation"),
        "typst_repair" => ("排版修复", "translation"),
        "term_prescan" => ("术语预扫", "preparation"),
        "term_review" => ("术语审定", "preparation"),
        "style_guide" => ("风格指南", "preparation"),
        "refine_review" => ("审校挑错", "refine"),
        "refine_fix" => ("定点修改", "refine"),
        "refine_chief" => ("主编分流", "refine"),
        "refine_terms" => ("术语专员", "refine"),
        "refine_rewrite" => ("整块重写", "refine"),
        stage if stage.starts_with("refine") => ("精修其它", "refine"),
        "assistant_ask" => ("助手问答", "assistant"),
        "assistant_terminal" => ("助手终端", "assistant"),
        stage if stage.starts_with("assistant") => ("助手其它", "assistant"),
        "failure_diagnosis" => ("失败诊断", "other"),
        _ => ("其它", "other"),
    }
}

/// 汇总若干条用量。`job_counts` 是（有用量的任务数，其中折算的任务数）。
pub fn summarize(scope: &'static str, records: &[UsageRecord], job_counts: (u64, u64)) -> UsageSummaryView {
    let mut totals = UsageBucket::default();
    let mut by_stage: BTreeMap<String, UsageBucket> = BTreeMap::new();
    let mut by_model: BTreeMap<(String, String), UsageBucket> = BTreeMap::new();
    let mut by_month: BTreeMap<String, UsageBucket> = BTreeMap::new();
    for record in records {
        totals.add(record);
        by_stage.entry(record.stage.clone()).or_default().add(record);
        by_model.entry((record.model.clone(), record.host.clone())).or_default().add(record);
        if record.ts.len() >= 7 {
            by_month.entry(record.ts[..7].to_string()).or_default().add(record);
        }
    }
    let mut by_stage: Vec<UsageStageView> = by_stage
        .into_iter()
        .map(|(stage, usage)| {
            let (label, group) = stage_label(&stage);
            UsageStageView { stage, label, group, usage }
        })
        .collect();
    by_stage.sort_by(|a, b| b.usage.total_tokens.cmp(&a.usage.total_tokens).then(a.stage.cmp(&b.stage)));
    let mut by_model: Vec<UsageModelView> = by_model
        .into_iter()
        .map(|((model, host), usage)| UsageModelView { model, host, usage })
        .collect();
    by_model.sort_by(|a, b| b.usage.total_tokens.cmp(&a.usage.total_tokens).then(a.model.cmp(&b.model)));
    let timestamps = records.iter().map(|record| record.ts.as_str()).filter(|ts| !ts.is_empty());
    UsageSummaryView {
        scope,
        totals,
        by_stage,
        by_model,
        by_month: by_month.into_iter().map(|(month, usage)| UsageMonthView { month, usage }).collect(),
        jobs_counted: job_counts.0,
        jobs_estimated_from_reports: job_counts.1,
        first_at: timestamps.clone().min().map(str::to_string),
        last_at: timestamps.max().map(str::to_string),
    }
}

/// 多个任务（加上可选的助手用量）合成一份汇总。
pub fn summarize_jobs<'a>(
    scope: &'static str,
    output_root: &Path,
    job_ids: impl IntoIterator<Item = &'a str>,
    mut extra: Vec<UsageRecord>,
) -> UsageSummaryView {
    let (mut counted, mut estimated) = (0, 0);
    let mut records = Vec::new();
    for job_id in job_ids {
        let (job_records, from_reports) = job_usage_records(output_root, job_id);
        if job_records.is_empty() {
            continue;
        }
        counted += 1;
        estimated += u64::from(from_reports);
        records.extend(job_records);
    }
    records.append(&mut extra);
    summarize(scope, &records, (counted, estimated))
}

/// 输出目录下的全部任务目录名（全局汇总用；不依赖数据库，删掉的任务自然不在了）。
pub fn all_job_ids(output_root: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(output_root) else {
        return Vec::new();
    };
    let mut ids: Vec<String> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
        .filter(|name| !name.starts_with('.'))
        .collect();
    ids.sort();
    ids
}

#[cfg(test)]
mod tests;
