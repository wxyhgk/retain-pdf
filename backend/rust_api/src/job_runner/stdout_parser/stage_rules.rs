use crate::models::{job_stage_str, JobSnapshot, JobStage};
use crate::ocr_provider::mineru::map_task_status;

use super::{job_artifacts_mut, ocr_provider_diagnostics_mut};

#[derive(Clone, Copy)]
enum ProviderStagePrefixRule {
    UploadDone,
}

const PROVIDER_STAGE_PREFIX_RULES: &[(&str, ProviderStagePrefixRule)] =
    &[("upload done: ", ProviderStagePrefixRule::UploadDone)];

pub(super) fn apply_stage_line(job: &mut JobSnapshot, line: &str) {
    if apply_provider_stage_prefix_rule(job, line) {
        return;
    }
    if let Some((batch_id, raw_state)) = parse_provider_state_line(line, "batch ") {
        sync_provider_status_to_job(job, raw_state, None, Some(batch_id));
        return;
    }
    if let Some((task_id, raw_state)) = parse_provider_state_line(line, "task ") {
        sync_provider_status_to_job(job, raw_state, Some(task_id), None);
    }
}

fn apply_provider_stage_prefix_rule(job: &mut JobSnapshot, line: &str) -> bool {
    for (prefix, rule) in PROVIDER_STAGE_PREFIX_RULES {
        if line.starts_with(prefix) {
            apply_provider_stage_prefix(job, *rule);
            return true;
        }
    }
    false
}

fn apply_provider_stage_prefix(job: &mut JobSnapshot, rule: ProviderStagePrefixRule) {
    match rule {
        ProviderStagePrefixRule::UploadDone => {
            job.stage = Some(job_stage_str(JobStage::MineruProcessing).to_string());
            job.stage_detail = Some("文件上传完成，等待 MinerU 处理".to_string());
        }
    }
}

fn parse_provider_state_line<'a>(line: &'a str, prefix: &str) -> Option<(String, &'a str)> {
    let rest = line.strip_prefix(prefix)?;
    let (id, raw_state) = rest.split_once(": state=")?;
    let id = id.trim();
    let raw_state = raw_state.trim();
    if id.is_empty() || raw_state.is_empty() {
        return None;
    }
    Some((id.to_string(), raw_state))
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
