use once_cell::sync::Lazy;
use regex::Regex;

use crate::models::JobSnapshot;
use crate::ocr_provider::mineru::map_task_status;

use super::{job_artifacts_mut, ocr_provider_diagnostics_mut};

#[derive(Clone, Copy)]
enum StagePrefixRule {
    UploadDone,
    LayoutReady,
    DomainInfer,
    ContinuationReview,
    PagePoliciesStart,
    RenderingPrepare,
    Saving,
}

const STAGE_PREFIX_RULES: &[(&str, StagePrefixRule)] = &[
    ("upload done: ", StagePrefixRule::UploadDone),
    ("layout json: ", StagePrefixRule::LayoutReady),
    ("domain-infer: ", StagePrefixRule::DomainInfer),
    ("continuation-review ", StagePrefixRule::ContinuationReview),
    (
        "book: page policies start",
        StagePrefixRule::PagePoliciesStart,
    ),
    ("render source pdf: ", StagePrefixRule::RenderingPrepare),
    (
        "typst background render selected",
        StagePrefixRule::RenderingPrepare,
    ),
    ("save optimized pdf:", StagePrefixRule::Saving),
    ("image-only compress:", StagePrefixRule::Saving),
];

static MINERU_BATCH_STATE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^batch ([^:]+): state=(.+)$").unwrap());
static MINERU_TASK_STATE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^task ([^:]+): state=(.+)$").unwrap());
static PAGE_POLICY_MODE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: page policies mode=([a-z_]+) total_pages=(\d+)$").unwrap());
static PAGE_POLICY_PAGE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: page policy page (\d+)/(\d+) -> source page (\d+)$").unwrap());
static BATCH_PROGRESS_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: completed batch (\d+)/(\d+)$").unwrap());
static TRANSLATE_ATTEMPT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^book: batch (\d+)/(\d+): translate attempt").unwrap());
static OVERLAY_MERGE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^overlay merge page (\d+)/(\d+) -> source page (\d+)$").unwrap());

pub(super) fn apply_stage_line(job: &mut JobSnapshot, line: &str) {
    if apply_stage_prefix_rule(job, line) {
        return;
    }
    if let Some(caps) = MINERU_BATCH_STATE_RE.captures(line) {
        sync_provider_status_to_job(job, caps[2].trim(), None, Some(caps[1].trim().to_string()));
        return;
    }
    if let Some(caps) = MINERU_TASK_STATE_RE.captures(line) {
        sync_provider_status_to_job(job, caps[2].trim(), Some(caps[1].trim().to_string()), None);
        return;
    }
    if let Some(caps) = PAGE_POLICY_MODE_RE.captures(line) {
        job.stage = Some("page_policies".to_string());
        job.stage_detail = Some("正在执行块规则、分类和局部拆分".to_string());
        job.progress_current = Some(0);
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if let Some(caps) = PAGE_POLICY_PAGE_RE.captures(line) {
        let current = caps[1].parse::<i64>().ok();
        let total = caps[2].parse::<i64>().ok();
        let source_page = caps[3].parse::<i64>().unwrap_or(0);
        job.stage = Some("page_policies".to_string());
        job.stage_detail = Some(format!(
            "正在处理第 {}/{} 页策略，对应源文第 {} 页",
            current.unwrap_or(0),
            total.unwrap_or(0),
            source_page
        ));
        job.progress_current = current.map(|v| v.saturating_sub(1));
        job.progress_total = total;
        return;
    }
    if let Some(caps) = TRANSLATE_ATTEMPT_RE.captures(line) {
        job.stage = Some("translating".to_string());
        job.stage_detail = Some(format!("正在翻译，第 {}/{} 批", &caps[1], &caps[2]));
        job.progress_current = caps[1].parse::<i64>().ok().map(|v| v.saturating_sub(1));
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if let Some(caps) = BATCH_PROGRESS_RE.captures(line) {
        job.stage = Some("translating".to_string());
        job.stage_detail = Some(format!("已完成第 {}/{} 批翻译", &caps[1], &caps[2]));
        job.progress_current = caps[1].parse::<i64>().ok();
        job.progress_total = caps[2].parse::<i64>().ok();
        return;
    }
    if let Some(caps) = OVERLAY_MERGE_RE.captures(line) {
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some(format!("正在渲染第 {}/{} 页", &caps[1], &caps[2]));
        job.progress_current = caps[1].parse::<i64>().ok().map(|v| v.saturating_sub(1));
        job.progress_total = caps[2].parse::<i64>().ok();
    }
}

fn apply_stage_prefix_rule(job: &mut JobSnapshot, line: &str) -> bool {
    for (prefix, rule) in STAGE_PREFIX_RULES {
        if line.starts_with(prefix) {
            apply_stage_prefix(job, *rule);
            return true;
        }
    }
    false
}

fn apply_stage_prefix(job: &mut JobSnapshot, rule: StagePrefixRule) {
    match rule {
        StagePrefixRule::UploadDone => {
            job.stage = Some("mineru_processing".to_string());
            job.stage_detail = Some("文件上传完成，等待 MinerU 处理".to_string());
        }
        StagePrefixRule::LayoutReady => {
            job.stage = Some("normalizing".to_string());
            job.stage_detail = Some("MinerU 结果已就绪，准备生成标准化 OCR 文档".to_string());
        }
        StagePrefixRule::DomainInfer => {
            job.stage = Some("domain_inference".to_string());
            job.stage_detail = Some("正在识别论文领域".to_string());
        }
        StagePrefixRule::ContinuationReview => {
            job.stage = Some("continuation_review".to_string());
            job.stage_detail = Some("正在判断跨栏/跨页连续段".to_string());
        }
        StagePrefixRule::PagePoliciesStart => {
            job.stage = Some("page_policies".to_string());
            job.stage_detail = Some("正在执行块规则、分类和局部拆分".to_string());
        }
        StagePrefixRule::RenderingPrepare => {
            job.stage = Some("rendering".to_string());
            job.stage_detail = Some("正在准备渲染".to_string());
        }
        StagePrefixRule::Saving => {
            job.stage = Some("saving".to_string());
            job.stage_detail = Some("正在保存最终结果".to_string());
        }
    }
}

fn sync_provider_status_to_job(
    job: &mut JobSnapshot,
    raw_state: &str,
    task_id: Option<String>,
    batch_id: Option<String>,
) {
    let handle = {
        let diagnostics = ocr_provider_diagnostics_mut(job);
        if let Some(task_id) = task_id {
            diagnostics.handle.task_id = Some(task_id);
        }
        if let Some(batch_id) = batch_id {
            diagnostics.handle.batch_id = Some(batch_id);
        }
        diagnostics.handle.clone()
    };
    let previous = ocr_provider_diagnostics_mut(job).last_error.clone();
    let mapped = map_task_status(
        raw_state,
        handle,
        previous
            .as_ref()
            .and_then(|item| item.provider_message.clone()),
        previous.as_ref().and_then(|item| item.trace_id.clone()),
    );
    if let Some(trace_id) = mapped.trace_id.clone() {
        job_artifacts_mut(job).provider_trace_id = Some(trace_id);
    }
    job.stage = mapped.stage.clone();
    job.stage_detail = mapped.detail.clone();
    ocr_provider_diagnostics_mut(job).last_status = Some(mapped);
}
