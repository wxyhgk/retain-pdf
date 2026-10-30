//! 一本书的翻译覆盖和任务记录 —— 书籍详情「进度」分区展示用。
//!
//! 只**计算**，不生成：合并计划是纯函数，这里不调 Python、不建合并目录，打开详情页不会
//! 触发一次合并。
//!
//! 「覆盖」和阅读入口用同一套规则（每页取最近翻译了它的那个任务），所以这里说「第 7 页
//! 来自某次翻译」，阅读器打开时第 7 页就是那次翻译。

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::Serialize;

use retainpdf_data::db::Db;
use retainpdf_api_base::error::AppError;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use retainpdf_core::document_pages::translated_document_pages;
use retainpdf_jobs::{stored_path, terminal_completion_note, StoredFile};

use super::plan::{merge_plan, PageSource};
use super::reading::document_merge_sources;

/// 连续几页来自同一个来源：`job_id` 为空表示原文（没翻译）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CoverageSegment {
    pub first: u32,
    pub last: u32,
    pub job_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CoverageJobView {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub created_at: String,
    pub finished_at: Option<String>,
    /// 翻译模型；纯 OCR 任务为空。
    pub model: String,
    /// 翻译引擎：`legacy`（现有流程）或 `agent`（翻译 agent）；老任务、纯 OCR 任务是 `legacy`。
    pub engine: String,
    /// 有翻译 agent 的编辑部事件可看（`GET /jobs/:job_id/progress/editorial`）。agent 任务开翻以后才有。
    pub has_editorial_events: bool,
    /// 这个任务处理的文档页（1 起、升序）。成功的翻译任务按实际执行算；没完成的按请求算；
    /// 算不出来（老任务没记录）就是空。
    pub pages: Vec<u32>,
    /// 当前合并结果里，有几页取自这个任务（被后来的翻译盖掉的不算）。
    pub supplied_pages: u32,
    /// 复用了别的任务的 OCR。
    pub ocr_reused: bool,
    /// 成功但有额外说明（目前就是「N 个内容块保留原文未翻译」）。没有就是 None ——
    /// 和任务列表的 completion_note 同一个来源，前端凭有没有决定要不要提示。
    pub note: Option<String>,
    /// 成功的翻译任务里该翻却保留原文（没翻出来）的内容块数，读 translation_diagnostics.json；
    /// 和写 note 的 completion_pipeline 同一个算法。读不到按 0。
    pub kept_origin_blocks: u32,
    /// 上面那些块里，落在「当前合并结果仍取自这个任务」的页上的有几块。分次范围翻译后
    /// 旧任务只剩几页还在用，按整个任务算会一直偏大（重翻了那几页提醒也不消）。
    /// 诊断里没有逐块记录（旧任务）时退回 kept_origin_blocks。
    pub kept_origin_blocks_supplied: u32,
    /// 失败原因的一句话（failure.summary，中文）。只有失败任务有。
    pub failure_summary: Option<String>,
    /// 原始错误的第一行（截到 160 字），给「展开看原因」用。只有失败任务有。
    pub error_head: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TranslationCoverageView {
    pub page_count: u32,
    /// 有译文的文档页数。
    pub translated_pages: u32,
    /// 当前合并结果用到了几次翻译。
    pub contributing_jobs: u32,
    /// 整本书按页的来源，连续同源的页合成一段。
    pub segments: Vec<CoverageSegment>,
    /// 这本书的全部任务，新到旧。
    pub jobs: Vec<CoverageJobView>,
}

/// 文档页 → 来源的整本计划，压成连续段。
pub(crate) fn segments_of(plan: &[PageSource]) -> Vec<CoverageSegment> {
    let mut segments: Vec<CoverageSegment> = Vec::new();
    for (index, source) in plan.iter().enumerate() {
        let page = index as u32 + 1;
        let job_id = match source {
            PageSource::Original => None,
            PageSource::Job { job_id, .. } => Some(job_id.clone()),
        };
        match segments.last_mut() {
            Some(segment) if segment.job_id == job_id && segment.last + 1 == page => segment.last = page,
            _ => segments.push(CoverageSegment { first: page, last: page, job_id }),
        }
    }
    segments
}

/// 一个任务处理的文档页：成功的翻译按实际执行（OCR 页号表 + 本地 start/end），否则按请求。
fn job_pages(job: &JobSnapshot, document_page_count: u32) -> Vec<u32> {
    let artifacts = job.artifacts.as_ref();
    let ocr_pages = artifacts.map(|a| a.ocr_page_numbers.clone()).unwrap_or_default();
    if job.workflow == WorkflowKind::Ocr {
        if !ocr_pages.is_empty() {
            return ocr_pages;
        }
        return parse_spec(job.ocr_page_ranges(), document_page_count);
    }
    let (start_page, end_page) = job.translation_page_window();
    if job.status == JobStatusKind::Succeeded && !ocr_pages.is_empty() {
        if let Some(pages) = translated_document_pages(&ocr_pages, start_page, end_page) {
            return pages;
        }
    }
    if !job.translation_page_list().is_empty() {
        let mut pages = job.translation_page_list().to_vec();
        pages.sort_unstable();
        pages.dedup();
        return pages;
    }
    parse_spec(job.ocr_page_ranges(), document_page_count)
}

/// `"1-3,7"` → `[1,2,3,7]`；空串或 `all` 表示整本。认不出的部分跳过。
fn parse_spec(spec: &str, document_page_count: u32) -> Vec<u32> {
    let spec = spec.trim();
    if spec.is_empty() || spec.eq_ignore_ascii_case("all") {
        return (1..=document_page_count).collect();
    }
    let mut pages = Vec::new();
    for part in spec.split(',') {
        let part = part.trim();
        let (first, last) = part.split_once('-').unwrap_or((part, part));
        if let (Ok(first), Ok(last)) = (first.trim().parse::<u32>(), last.trim().parse::<u32>()) {
            pages.extend((first.max(1)..=last.min(document_page_count)).filter(|_| first <= last));
        }
    }
    pages.sort_unstable();
    pages.dedup();
    pages
}

/// 该翻没翻出来的块数：`dead_letter_count` 与 `unresolved_translation_count` 取大 ——
/// 和 retainpdf-runner completion_pipeline 写「N 个内容块保留原文」用的是同一个数。
/// 不用 `status_summary.kept_origin`：它把行间公式、模型判定保留这类按设计不翻的块也算进去了。
fn kept_origin_blocks(data_root: &Path, job_id: &str) -> u32 {
    let path = data_root.join("jobs").join(job_id).join("artifacts").join("translation_diagnostics.json");
    let Ok(text) = std::fs::read_to_string(path) else { return 0 };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else { return 0 };
    let count = |key: &str| value.get(key).and_then(serde_json::Value::as_u64).unwrap_or(0);
    count("dead_letter_count").max(count("unresolved_translation_count")).min(u32::MAX as u64) as u32
}

fn kept_origin_total(data_root: &Path, job: &JobSnapshot) -> u32 {
    if job.status == JobStatusKind::Succeeded && job.workflow != WorkflowKind::Ocr {
        kept_origin_blocks(data_root, &job.job_id)
    } else {
        0
    }
}

fn kept_origin_supplied(data_root: &Path, job: &JobSnapshot, pages: Option<&BTreeSet<u32>>) -> u32 {
    let total = kept_origin_total(data_root, job);
    let Some(pages) = pages else { return 0 };
    if total == 0 {
        return 0;
    }
    let ocr_pages = job.artifacts.as_ref().map(|a| a.ocr_page_numbers.clone()).unwrap_or_default();
    match kept_origin_by_document_page(data_root, &job.job_id, &ocr_pages) {
        Some(by_page) => by_page.iter().filter(|(page, _)| pages.contains(page)).map(|(_, count)| *count).sum(),
        None => total,
    }
}

/// translation_diagnostics.json 的 dead_letter_items / unresolved_items：每块一条（同一块两边都有
/// 只算一次），`page_idx` 是这个任务 OCR 产物里的本地页（0 起），映射回文档页用
/// `ocr_page_numbers`（见 retainpdf_core::document_pages）；没有映射就按「本地 = 文档 - 1」（全书任务）。
/// 没有逐块记录，或列表被截断（Python 端各只留前 100 条）时返回 None，调用方退回整任务的数。
fn kept_origin_by_document_page(data_root: &Path, job_id: &str, ocr_pages: &[u32]) -> Option<BTreeMap<u32, u32>> {
    let path = data_root.join("jobs").join(job_id).join("artifacts").join("translation_diagnostics.json");
    let text = std::fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    let mut seen = BTreeMap::new();
    for (list_key, count_key) in [
        ("dead_letter_items", "dead_letter_count"),
        ("unresolved_items", "unresolved_translation_count"),
    ] {
        let Some(count) = value.get(count_key).and_then(serde_json::Value::as_u64) else { continue };
        let items = value.get(list_key).and_then(serde_json::Value::as_array)?;
        if (items.len() as u64) < count {
            return None;
        }
        for item in items {
            let Some(local) = item.get("page_idx").and_then(serde_json::Value::as_u64) else { return None };
            let item_id = item.get("item_id").and_then(serde_json::Value::as_str).unwrap_or_default();
            seen.insert(format!("{local}:{item_id}"), local);
        }
    }
    let mut by_page: BTreeMap<u32, u32> = BTreeMap::new();
    for local in seen.into_values() {
        let page = ocr_pages.get(local as usize).copied().unwrap_or(local as u32 + 1);
        *by_page.entry(page).or_default() += 1;
    }
    Some(by_page)
}

/// 原始错误里最有用的一行：Python traceback 的第一行永远是「Traceback (most recent call
/// last):」，异常本身在最后一个非空行；其它错误（Rust 的「failed to … / Caused by: …」）
/// 第一行就是摘要。
fn error_headline(error: &str) -> Option<&str> {
    let first = error.lines().map(str::trim).find(|line| !line.is_empty())?;
    if first.starts_with("Traceback (most recent call last)") {
        return error.lines().map(str::trim).filter(|line| !line.is_empty()).last();
    }
    Some(first)
}

/// 失败任务的一段文字：去空白、截到 160 字；非失败任务或空串返回 None。
fn failed_text(job: &JobSnapshot, text: Option<&str>) -> Option<String> {
    if job.status != JobStatusKind::Failed {
        return None;
    }
    let text = text?.trim();
    if text.is_empty() {
        return None;
    }
    Some(text.chars().take(160).collect())
}

pub(crate) fn translation_coverage(
    db: &Db,
    data_root: &Path,
    document_id: &str,
    document_page_count: u32,
) -> Result<TranslationCoverageView, AppError> {
    let mut jobs = db.list_jobs_for_document(document_id, 500, 0)?;
    jobs.sort_by(|a, b| (&b.created_at, &b.job_id).cmp(&(&a.created_at, &a.job_id)));
    let sources = document_merge_sources(&jobs, data_root);
    let ranked: Vec<_> = sources.iter().map(|source| source.ranked.clone()).collect();
    let plan = merge_plan(document_page_count, &ranked);
    let mut supplied: BTreeMap<&str, u32> = BTreeMap::new();
    let mut supplied_pages: BTreeMap<&str, BTreeSet<u32>> = BTreeMap::new();
    for (index, source) in plan.iter().enumerate() {
        if let PageSource::Job { job_id, .. } = source {
            *supplied.entry(job_id.as_str()).or_default() += 1;
            supplied_pages.entry(job_id.as_str()).or_default().insert(index as u32 + 1);
        }
    }
    let translated_pages = supplied.values().sum();
    let contributing_jobs = supplied.len() as u32;
    let job_views = jobs
        .iter()
        .map(|job| CoverageJobView {
            job_id: job.job_id.clone(),
            workflow: job.workflow.clone(),
            status: job.status.clone(),
            created_at: job.created_at.clone(),
            finished_at: job.finished_at.clone(),
            model: if job.workflow == WorkflowKind::Ocr {
                String::new()
            } else {
                job.translation_model().to_string()
            },
            engine: job.translation_engine().to_string(),
            has_editorial_events: stored_path(job, data_root, StoredFile::AgentEditorialEvents).is_some(),
            pages: job_pages(job, document_page_count),
            supplied_pages: supplied.get(job.job_id.as_str()).copied().unwrap_or(0),
            ocr_reused: job.source_job_id().is_some(),
            note: if job.status == JobStatusKind::Succeeded {
                terminal_completion_note(job)
            } else {
                None
            },
            kept_origin_blocks: kept_origin_total(data_root, job),
            kept_origin_blocks_supplied: kept_origin_supplied(
                data_root,
                job,
                supplied_pages.get(job.job_id.as_str()),
            ),
            failure_summary: failed_text(job, job.failure.as_ref().map(|f| f.summary.as_str())),
            error_head: failed_text(job, job.error.as_deref().and_then(error_headline)),
        })
        .collect();
    Ok(TranslationCoverageView {
        page_count: document_page_count,
        translated_pages,
        contributing_jobs,
        segments: segments_of(&plan),
        jobs: job_views,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn job(id: &str, local: usize) -> PageSource {
        PageSource::Job { job_id: id.to_string(), local_index: local }
    }

    #[test]
    fn runs_of_the_same_source_collapse_into_segments() {
        let plan = [job("a", 0), job("a", 1), PageSource::Original, job("b", 0), job("b", 1), job("a", 2)];
        assert_eq!(
            segments_of(&plan),
            vec![
                CoverageSegment { first: 1, last: 2, job_id: Some("a".into()) },
                CoverageSegment { first: 3, last: 3, job_id: None },
                CoverageSegment { first: 4, last: 5, job_id: Some("b".into()) },
                CoverageSegment { first: 6, last: 6, job_id: Some("a".into()) },
            ]
        );
        assert_eq!(segments_of(&[]), vec![]);
    }

    #[test]
    fn page_specs_parse_like_the_ocr_request() {
        assert_eq!(parse_spec("1-3, 7", 10), vec![1, 2, 3, 7]);
        assert_eq!(parse_spec("", 3), vec![1, 2, 3]);
        assert_eq!(parse_spec("all", 2), vec![1, 2]);
        assert_eq!(parse_spec("8-12", 10), vec![8, 9, 10], "超出页数的截掉");
        assert_eq!(parse_spec("5-3, x, 2", 10), vec![2], "颠倒的和认不出的跳过");
    }

    #[test]
    fn kept_origin_blocks_reads_the_same_numbers_as_the_completion_warning() {
        let root = std::env::temp_dir().join(format!("coverage-kept-{}", fastrand::u64(..)));
        let dir = root.join("jobs").join("j1").join("artifacts");
        std::fs::create_dir_all(&dir).expect("dir");
        std::fs::write(
            dir.join("translation_diagnostics.json"),
            r#"{"status_summary":{"kept_origin":16},"dead_letter_count":3,"unresolved_translation_count":5}"#,
        )
        .expect("write");
        assert_eq!(kept_origin_blocks(&root, "j1"), 5, "按设计保留原文的公式等不算");
        std::fs::write(
            dir.join("translation_diagnostics.json"),
            r#"{"status_summary":{"kept_origin":246},"dead_letter_count":0,"unresolved_translation_count":0}"#,
        )
        .expect("write");
        assert_eq!(kept_origin_blocks(&root, "j1"), 0, "246 块全是公式和模型保留，不提示");
        assert_eq!(kept_origin_blocks(&root, "missing"), 0, "没有诊断文件按 0");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn failure_text_only_for_failed_jobs_and_is_trimmed() {
        let mut job = JobSnapshot::new("j".to_string(), retainpdf_core::models::domain::CreateJobInput::default(), vec![]);
        job.status = JobStatusKind::Failed;
        assert_eq!(failed_text(&job, Some("  外部服务请求超时 ")), Some("外部服务请求超时".into()));
        assert_eq!(failed_text(&job, Some("   ")), None);
        assert_eq!(failed_text(&job, Some(&"长".repeat(300))).map(|t| t.chars().count()), Some(160));
        job.status = JobStatusKind::Succeeded;
        assert_eq!(failed_text(&job, Some("x")), None);
    }

    #[test]
    fn error_headline_takes_the_exception_line_of_a_python_traceback() {
        let traceback = "Traceback (most recent call last):\n  File \"x.py\", line 1, in <module>\n    run()\nRuntimeError: typst compile failed\n";
        assert_eq!(error_headline(traceback), Some("RuntimeError: typst compile failed"));
        assert_eq!(
            error_headline("failed to upload file /a.pdf\nCaused by:\n- timeout"),
            Some("failed to upload file /a.pdf")
        );
        assert_eq!(error_headline("  \n "), None);
    }

    #[test]
    fn kept_origin_counts_only_pages_this_job_still_supplies() {
        let root = std::env::temp_dir().join(format!("coverage-kept-pages-{}", fastrand::u64(..)));
        let dir = root.join("jobs").join("j1").join("artifacts");
        std::fs::create_dir_all(&dir).expect("dir");
        // OCR 覆盖文档第 6-10 页（本地 0-4）；没翻出来的块在本地 0、0、3 → 文档第 6、6、9 页。
        // b2 同时是死信和未解决，只算一次；本地 1 页的公式按设计保留原文，不在两张列表里。
        std::fs::write(
            dir.join("translation_diagnostics.json"),
            r#"{"status_summary":{"kept_origin":9},
                "dead_letter_count":2,"dead_letter_items":[
                    {"item_id":"p001-b1","page_idx":0},{"item_id":"p001-b2","page_idx":0}],
                "unresolved_translation_count":2,"unresolved_items":[
                    {"item_id":"p001-b2","page_idx":0},{"item_id":"p004-b0","page_idx":3}]}"#,
        )
        .expect("write");
        let by_page = kept_origin_by_document_page(&root, "j1", &[6, 7, 8, 9, 10]).expect("items");
        assert_eq!(by_page, BTreeMap::from([(6, 2), (9, 1)]));
        let only_nine: BTreeSet<u32> = [9, 10].into_iter().collect();
        assert_eq!(by_page.iter().filter(|(p, _)| only_nine.contains(p)).map(|(_, c)| *c).sum::<u32>(), 1);
        assert_eq!(kept_origin_by_document_page(&root, "missing", &[]), None);
        // 列表被截断（只留前 100 条）就按不出页，退回整任务的数。
        std::fs::write(
            dir.join("translation_diagnostics.json"),
            r#"{"dead_letter_count":150,"dead_letter_items":[{"item_id":"p001-b1","page_idx":0}]}"#,
        )
        .expect("write");
        assert_eq!(kept_origin_by_document_page(&root, "j1", &[6]), None);
        let _ = std::fs::remove_dir_all(&root);
    }
}
