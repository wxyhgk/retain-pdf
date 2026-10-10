//! 质量摘要：译前准备、质检、排版、精修、没翻译的块，一张卡用得上的数都在这里。
//!
//! 三份报告（translation_qa / fit_report / refine_report）各有几百 KB，前端只为一张卡拉整份不划算，
//! 这里只取各自的 summary 段，外加按块的清单（阅读页标溢出、没翻译、质检问题、留给人确认的块）。
//! 报告缺失的部分给 null，不报错：没精修过的书就没有 refine。

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::{Map, Value};

/// 缩放比例低于它算「缩得太小」（阅读页要标出来）。
pub const SMALL_SCALE_THRESHOLD: f64 = 0.75;
pub const QUALITY_ITEMS_MAX_LIMIT: usize = 1000;

/// 一个任务的质量数据在磁盘上的位置。
#[derive(Debug, Clone)]
pub struct QualitySources {
    pub artifacts_dir: PathBuf,
    /// 译文目录（新任务式重渲染时指向源任务的 translated/）。
    pub translated_dir: PathBuf,
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_str(&fs::read_to_string(path).ok()?).ok()
}

fn u64_at(value: &Value, key: &str) -> u64 {
    value.get(key).and_then(Value::as_u64).unwrap_or(0)
}

fn text_at(value: &Value, key: &str) -> String {
    value.get(key).and_then(Value::as_str).unwrap_or("").to_string()
}

fn object_at(value: &Value, key: &str) -> Map<String, Value> {
    value.get(key).and_then(Value::as_object).cloned().unwrap_or_default()
}

/// 阅读页（/reader/regions）的块编号：`p001-b2` / `p001-b002` → `p001-b0002`。
/// 与 `services/jobs/reader_regions/value_extract.rs::canonical_item_id` 同一规则；
/// 阅读页按它跳转、取框，所以清单里的 item_id 必须是这一套。
fn reader_item_id(value: &str) -> String {
    let Some((page, block)) = value.split_once("-b") else {
        return value.to_string();
    };
    match block.parse::<u32>() {
        Ok(number) => format!("{page}-b{number:04}"),
        Err(_) => value.to_string(),
    }
}

/// `p012-b003` → 12。
fn page_of_item(item_id: &str) -> Option<u64> {
    item_id.strip_prefix('p')?.split('-').next()?.parse().ok()
}

// ---------------------------------------------------------------- 摘要

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct TermBaseStatus {
    pub complete: bool,
    pub term_count: u64,
    pub locked_count: u64,
    pub conflict_count: u64,
    pub batch_count: u64,
    pub failed_batch_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct StyleGuideStatus {
    pub complete: bool,
    pub llm_status: String,
    pub rule_count: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct PreparationStatus {
    pub mode: String,
    pub term_base: Option<TermBaseStatus>,
    pub style_guide: Option<StyleGuideStatus>,
    /// `term_base_incomplete` / `style_guide_fallback`；空 = 完整。
    pub problems: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct QaSummary {
    pub generated_at: String,
    pub item_count: u64,
    pub checked_item_count: u64,
    pub violation_count: u64,
    pub by_severity: Map<String, Value>,
    pub by_check: Map<String, Value>,
    pub by_type: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct LayoutSummary {
    pub blocks: u64,
    pub shrunk_blocks: u64,
    pub small_blocks: u64,
    pub small_scale_threshold: f64,
    pub overflow_blocks: u64,
    pub overflow_pages: Vec<u64>,
    pub min_scale: Option<f64>,
    pub min_final_font_size: Option<f64>,
    pub math_formulas: u64,
    pub math_failed: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct QaSnapshot {
    pub violation_count: u64,
    pub by_severity: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RefineSummary {
    pub mode: String,
    pub status: String,
    pub stopped_reason: Option<String>,
    pub generated_at: String,
    pub qa_before: Option<QaSnapshot>,
    pub qa_after: Option<QaSnapshot>,
    pub applied: u64,
    pub rejected: u64,
    pub skipped: u64,
    pub reject_reasons: Map<String, Value>,
    pub skip_reasons: Map<String, Value>,
    pub escalated_count: u64,
}

/// 没翻译的块按原因分开计：公式、模型判定不需要翻（编号、DOI、版权声明……）都不是问题，只有 failed 是。
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
pub struct UntranslatedSummary {
    pub failed: u64,
    pub formula: u64,
    pub model_kept: u64,
    pub other: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct QualitySummaryView {
    pub job_id: String,
    pub preparation: Option<PreparationStatus>,
    pub qa: Option<QaSummary>,
    pub layout: Option<LayoutSummary>,
    pub refine: Option<RefineSummary>,
    pub untranslated: UntranslatedSummary,
}

fn preparation_status(sources: &QualitySources) -> Option<PreparationStatus> {
    let term_base = read_json(&sources.translated_dir.join("term-base.v1.json"));
    let style_guide = read_json(&sources.translated_dir.join("style-guide.v1.json"));
    if term_base.is_none() && style_guide.is_none() {
        return None;
    }
    let mode = term_base.as_ref().map(|payload| text_at(payload, "preparation_mode")).unwrap_or_default();
    let term_base = term_base.map(|payload| {
        let summary = payload.get("summary").cloned().unwrap_or(Value::Null);
        let extraction = payload.get("extraction").cloned().unwrap_or(Value::Null);
        TermBaseStatus {
            complete: payload.get("complete").and_then(Value::as_bool).unwrap_or(false),
            term_count: u64_at(&summary, "term_count"),
            locked_count: u64_at(&summary, "locked_count"),
            conflict_count: u64_at(&summary, "conflict_count"),
            batch_count: u64_at(&extraction, "batch_count"),
            failed_batch_ids: extraction
                .get("failed_batch_ids")
                .and_then(Value::as_array)
                .map(|ids| ids.iter().filter_map(Value::as_str).map(str::to_string).collect())
                .unwrap_or_default(),
        }
    });
    let style_guide = style_guide.map(|payload| StyleGuideStatus {
        complete: payload.get("complete").and_then(Value::as_bool).unwrap_or(false),
        llm_status: text_at(&payload, "llm_status"),
        rule_count: payload.get("rules").and_then(Value::as_array).map_or(0, |rules| rules.len() as u64),
    });
    let mut problems = Vec::new();
    if term_base.as_ref().is_some_and(|status| !status.complete) {
        problems.push("term_base_incomplete");
    }
    if style_guide.as_ref().is_some_and(|status| !status.complete || status.llm_status != "ok") {
        problems.push("style_guide_fallback");
    }
    Some(PreparationStatus { mode, term_base, style_guide, problems })
}

fn qa_summary(sources: &QualitySources) -> Option<QaSummary> {
    let report = read_json(&sources.artifacts_dir.join("translation_qa.v1.json"))?;
    let summary = report.get("summary").cloned().unwrap_or(Value::Null);
    Some(QaSummary {
        generated_at: text_at(&report, "generated_at"),
        item_count: u64_at(&summary, "item_count"),
        checked_item_count: u64_at(&summary, "checked_item_count"),
        violation_count: u64_at(&summary, "violation_count"),
        by_severity: object_at(&summary, "by_severity"),
        by_check: object_at(&summary, "by_check"),
        by_type: object_at(&summary, "by_type"),
    })
}

fn layout_blocks(sources: &QualitySources) -> Option<(Value, Vec<Value>)> {
    let report = read_json(&sources.artifacts_dir.join("fit_report.v1.json"))?;
    let blocks = report.get("blocks").and_then(Value::as_array).cloned().unwrap_or_default();
    Some((report.get("summary").cloned().unwrap_or(Value::Null), blocks))
}

fn is_small(block: &Value) -> bool {
    block.get("measured").and_then(Value::as_bool).unwrap_or(true)
        && block.get("scale").and_then(Value::as_f64).is_some_and(|scale| scale < SMALL_SCALE_THRESHOLD)
}

fn is_overflow(block: &Value) -> bool {
    block.get("overflow").and_then(Value::as_bool).unwrap_or(false)
}

fn layout_summary(sources: &QualitySources) -> Option<LayoutSummary> {
    let (summary, blocks) = layout_blocks(sources)?;
    let mut overflow_pages: Vec<u64> = blocks
        .iter()
        .filter(|block| is_overflow(block))
        .filter_map(|block| block.get("page").and_then(Value::as_u64))
        .collect();
    overflow_pages.sort_unstable();
    overflow_pages.dedup();
    Some(LayoutSummary {
        blocks: u64_at(&summary, "blocks"),
        shrunk_blocks: u64_at(&summary, "shrunk_blocks"),
        small_blocks: blocks.iter().filter(|block| is_small(block)).count() as u64,
        small_scale_threshold: SMALL_SCALE_THRESHOLD,
        overflow_blocks: u64_at(&summary, "overflow_blocks"),
        overflow_pages,
        min_scale: summary.get("min_scale").and_then(Value::as_f64),
        min_final_font_size: summary.get("min_final_font_size").and_then(Value::as_f64),
        math_formulas: u64_at(&summary, "math_formulas"),
        math_failed: u64_at(&summary, "math_failed"),
    })
}

fn qa_snapshot(value: Option<&Value>) -> Option<QaSnapshot> {
    let value = value.filter(|value| value.is_object())?;
    Some(QaSnapshot {
        violation_count: u64_at(value, "violation_count"),
        by_severity: object_at(value, "by_severity"),
    })
}

fn refine_report(sources: &QualitySources) -> Option<Value> {
    read_json(&sources.artifacts_dir.join("refine_report.v1.json"))
}

fn escalated_entries(report: &Value) -> Vec<Value> {
    report
        .get("editorial")
        .and_then(|editorial| editorial.get("escalated"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn refine_summary(sources: &QualitySources) -> Option<RefineSummary> {
    let report = refine_report(sources)?;
    let fix = report.get("fix_summary").cloned().unwrap_or(Value::Null);
    Some(RefineSummary {
        mode: text_at(&report, "mode"),
        status: text_at(&report, "status"),
        stopped_reason: report.get("stopped_reason").and_then(Value::as_str).map(str::to_string),
        generated_at: text_at(&report, "generated_at"),
        qa_before: qa_snapshot(report.get("qa_before")),
        qa_after: qa_snapshot(report.get("qa_after")),
        applied: u64_at(&fix, "applied"),
        rejected: u64_at(&fix, "rejected"),
        skipped: u64_at(&fix, "skipped"),
        reject_reasons: object_at(&fix, "reject_reasons"),
        skip_reasons: object_at(&fix, "skip_reasons"),
        escalated_count: escalated_entries(&report).len() as u64,
    })
}

/// 没翻译的原因归类。公式类以 `skip_` 开头且含 formula / equation。
fn untranslated_reason(final_status: &str, skip_reason: &str) -> Option<&'static str> {
    match final_status {
        "failed" => Some("failed"),
        "kept_origin" => Some(if skip_reason.contains("formula") || skip_reason.contains("equation") {
            "formula"
        } else if skip_reason == "skip_model_keep_origin" {
            "model_kept"
        } else {
            "other"
        }),
        _ => None,
    }
}

/// 译文目录下每页的块（`page-NNN-*.json`），只取判断「没翻译」要用的字段。
fn untranslated_items(sources: &QualitySources) -> Vec<QualityItem> {
    let Ok(entries) = fs::read_dir(&sources.translated_dir) else {
        return Vec::new();
    };
    let mut paths: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("page-") && name.ends_with(".json"))
        })
        .collect();
    paths.sort();
    let mut items = Vec::new();
    for path in paths {
        let Some(Value::Array(blocks)) = read_json(&path) else {
            continue;
        };
        for block in blocks {
            let status = text_at(&block, "final_status");
            let skip_reason = text_at(&block, "skip_reason");
            let Some(reason) = untranslated_reason(&status, &skip_reason) else {
                continue;
            };
            let item_id = text_at(&block, "item_id");
            let page = block
                .get("page_idx")
                .and_then(Value::as_u64)
                .map(|index| index + 1)
                .or_else(|| page_of_item(&item_id));
            items.push(QualityItem::new(item_id, page, reason, serde_json::json!({ "skip_reason": skip_reason })));
        }
    }
    items
}

pub fn quality_summary(job_id: &str, sources: &QualitySources) -> QualitySummaryView {
    let mut untranslated = UntranslatedSummary::default();
    for item in untranslated_items(sources) {
        match item.reason.as_str() {
            "failed" => untranslated.failed += 1,
            "formula" => untranslated.formula += 1,
            "model_kept" => untranslated.model_kept += 1,
            _ => untranslated.other += 1,
        }
    }
    QualitySummaryView {
        job_id: job_id.to_string(),
        preparation: preparation_status(sources),
        qa: qa_summary(sources),
        layout: layout_summary(sources),
        refine: refine_summary(sources),
        untranslated,
    }
}

// ---------------------------------------------------------------- 按块清单

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct QualityItem {
    /// 阅读页的块编号（四位，和 /reader/regions 的 item_id 同一套），用来跳转、取框。
    pub item_id: String,
    /// 译文条目编号（三位），改译文、看修订历史的接口用它。
    pub translation_item_id: String,
    pub page: Option<u64>,
    pub reason: String,
    /// 各类自己的字段：layout 是 scale / final_font_size / overflow_pt；untranslated 是 skip_reason；
    /// qa 是 id / check / type / severity / message；escalated 是 categories / attempts。
    #[serde(flatten)]
    pub detail: Value,
}

impl QualityItem {
    fn new(translation_item_id: String, page: Option<u64>, reason: &str, detail: Value) -> Self {
        Self {
            item_id: reader_item_id(&translation_item_id),
            translation_item_id,
            page,
            reason: reason.to_string(),
            detail,
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct QualityItemsView {
    pub kind: String,
    pub total: u64,
    pub offset: usize,
    pub limit: usize,
    pub items: Vec<QualityItem>,
}

#[derive(Debug, Clone, Default)]
pub struct QualityItemsQuery {
    pub kind: String,
    pub page: Option<u64>,
    pub severity: Option<String>,
    pub offset: usize,
    pub limit: usize,
}

pub const QUALITY_ITEM_KINDS: &[&str] = &["layout", "untranslated", "qa", "escalated"];

fn layout_items(sources: &QualitySources) -> Vec<QualityItem> {
    let Some((_summary, blocks)) = layout_blocks(sources) else {
        return Vec::new();
    };
    blocks
        .iter()
        .filter_map(|block| {
            let reason = if is_overflow(block) {
                "overflow"
            } else if is_small(block) {
                "small_scale"
            } else {
                return None;
            };
            Some(QualityItem::new(
                text_at(block, "item_id"),
                block.get("page").and_then(Value::as_u64),
                reason,
                serde_json::json!({
                    "scale": block.get("scale"),
                    "final_font_size": block.get("final_font_size"),
                    "overflow_pt": block.get("overflow_pt"),
                }),
            ))
        })
        .collect()
}

fn qa_items(sources: &QualitySources, severity: Option<&str>) -> Vec<QualityItem> {
    let Some(report) = read_json(&sources.artifacts_dir.join("translation_qa.v1.json")) else {
        return Vec::new();
    };
    report
        .get("violations")
        .and_then(Value::as_array)
        .map(|violations| {
            violations
                .iter()
                .filter(|violation| severity.is_none_or(|wanted| text_at(violation, "severity") == wanted))
                .map(|violation| {
                    let location = violation.get("location").cloned().unwrap_or(Value::Null);
                    let item_id = text_at(&location, "item_id");
                    let page = location.get("page_number").and_then(Value::as_u64).or_else(|| page_of_item(&item_id));
                    QualityItem::new(
                        item_id,
                        page,
                        &text_at(violation, "type"),
                        serde_json::json!({
                            "id": violation.get("id"),
                            "check": violation.get("check"),
                            "type": violation.get("type"),
                            "severity": violation.get("severity"),
                            "message": violation.get("message"),
                        }),
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

fn escalated_items(sources: &QualitySources) -> Vec<QualityItem> {
    let Some(report) = refine_report(sources) else {
        return Vec::new();
    };
    escalated_entries(&report)
        .iter()
        .map(|entry| {
            let item_id = text_at(entry, "item_id");
            let page = entry.get("page_number").and_then(Value::as_u64).or_else(|| page_of_item(&item_id));
            QualityItem::new(
                item_id,
                page,
                &text_at(entry, "reason"),
                serde_json::json!({
                    "categories": entry.get("categories").cloned().unwrap_or(Value::Array(Vec::new())),
                    "attempts": entry.get("attempts").cloned().unwrap_or(Value::Array(Vec::new())),
                }),
            )
        })
        .collect()
}

/// 调用方已校验过 kind 在 [`QUALITY_ITEM_KINDS`] 里、limit 在 1..=1000。
pub fn quality_items(sources: &QualitySources, query: &QualityItemsQuery) -> QualityItemsView {
    let items = match query.kind.as_str() {
        "layout" => layout_items(sources),
        "untranslated" => untranslated_items(sources),
        "qa" => qa_items(sources, query.severity.as_deref()),
        "escalated" => escalated_items(sources),
        _ => Vec::new(),
    };
    let filtered: Vec<QualityItem> = items
        .into_iter()
        .filter(|item| query.page.is_none_or(|page| item.page == Some(page)))
        .collect();
    QualityItemsView {
        kind: query.kind.clone(),
        total: filtered.len() as u64,
        offset: query.offset,
        limit: query.limit,
        items: filtered.into_iter().skip(query.offset).take(query.limit).collect(),
    }
}

#[cfg(test)]
mod tests;
