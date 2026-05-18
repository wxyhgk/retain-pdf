use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

use crate::error::AppError;
use crate::models::{JobEventRecord, JobSnapshot, JobStage};
use crate::storage_paths::resolve_events_jsonl;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub struct LiveStageSnapshot {
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress_current: Option<i64>,
    pub progress_total: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct PipelineEventJsonlRecord {
    #[serde(default)]
    job_id: Option<String>,
    #[serde(default)]
    ts: Option<String>,
    #[serde(default)]
    level: Option<String>,
    #[serde(default)]
    user_stage: Option<String>,
    #[serde(default)]
    stage: Option<String>,
    #[serde(default)]
    substage: Option<String>,
    #[serde(default)]
    stage_detail: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    provider_stage: Option<String>,
    #[serde(default)]
    event: Option<String>,
    #[serde(default)]
    event_type: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    progress_current: Option<i64>,
    #[serde(default)]
    progress_total: Option<i64>,
    #[serde(default)]
    progress_unit: Option<String>,
    #[serde(default)]
    retry_count: Option<u32>,
    #[serde(default)]
    elapsed_ms: Option<i64>,
    #[serde(default)]
    payload: Option<Value>,
}

pub fn load_live_stage_snapshot(job: &JobSnapshot, data_root: &Path) -> Option<LiveStageSnapshot> {
    let items = load_pipeline_event_records(job, data_root, 0);
    select_live_stage_snapshot(&items)
}

pub fn load_pipeline_event_records(
    job: &JobSnapshot,
    data_root: &Path,
    base_seq: i64,
) -> Vec<JobEventRecord> {
    let Some(path) = resolve_events_jsonl(job, data_root) else {
        return Vec::new();
    };
    load_pipeline_events_jsonl(&job.job_id, &path, base_seq)
}

pub fn list_combined_job_events(
    db: &crate::db::Db,
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<Vec<JobEventRecord>, AppError> {
    let mut items = db.list_job_events(&job.job_id, 10_000, 0)?;
    let base_seq = items.iter().map(|item| item.seq).max().unwrap_or(0);
    let mut file_items = load_pipeline_event_records(job, data_root, base_seq);
    items.append(&mut file_items);
    append_ocr_child_events(db, data_root, job, &mut items)?;
    items.sort_by(|left, right| {
        left.ts
            .cmp(&right.ts)
            .then_with(|| left.seq.cmp(&right.seq))
            .then_with(|| left.event.cmp(&right.event))
    });
    for (index, item) in items.iter_mut().enumerate() {
        item.seq = (index + 1) as i64;
    }
    Ok(items)
}

fn append_ocr_child_events(
    db: &crate::db::Db,
    data_root: &Path,
    parent_job: &JobSnapshot,
    items: &mut Vec<JobEventRecord>,
) -> Result<(), AppError> {
    let Some(ocr_job_id) = parent_job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.ocr_job_id.as_ref())
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty() && *value != parent_job.job_id)
    else {
        return Ok(());
    };
    let Ok(ocr_job) = db.get_job(ocr_job_id) else {
        return Ok(());
    };
    let base_seq = items.iter().map(|item| item.seq).max().unwrap_or(0);
    let mut child_items = db.list_job_events(ocr_job_id, 10_000, 0)?;
    let mut child_file_items =
        load_pipeline_event_records(&ocr_job, data_root, base_seq + child_items.len() as i64);
    child_items.append(&mut child_file_items);
    items.extend(
        child_items
            .into_iter()
            .map(|item| mirror_child_event(parent_job, ocr_job_id, item)),
    );
    Ok(())
}

fn mirror_child_event(
    parent_job: &JobSnapshot,
    source_job_id: &str,
    mut item: JobEventRecord,
) -> JobEventRecord {
    let original_payload = item
        .payload
        .take()
        .unwrap_or(Value::Object(Default::default()));
    item.job_id = parent_job.job_id.clone();
    item.user_stage = item.user_stage.or_else(|| Some("ocr".to_string()));
    item.payload = Some(json!({
        "source_job_id": source_job_id,
        "source_event": original_payload,
    }));
    item
}

fn load_pipeline_events_jsonl(job_id: &str, path: &Path, base_seq: i64) -> Vec<JobEventRecord> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let reader = BufReader::new(file);
    reader
        .lines()
        .enumerate()
        .filter_map(|(index, line)| {
            let line = line.ok()?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            let parsed = serde_json::from_str::<PipelineEventJsonlRecord>(trimmed).ok()?;
            if parsed
                .job_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty() && *value != job_id)
                .is_some()
            {
                return None;
            }
            let event = normalized_event_name(&parsed);
            Some(JobEventRecord {
                job_id: job_id.to_string(),
                seq: base_seq + index as i64 + 1,
                ts: parsed.ts.unwrap_or_default(),
                level: parsed.level.unwrap_or_else(|| "info".to_string()),
                user_stage: parsed
                    .user_stage
                    .or_else(|| user_stage_for_event(parsed.stage.as_deref())),
                substage: parsed
                    .substage
                    .clone()
                    .or_else(|| parsed.provider_stage.clone()),
                progress_unit: parsed
                    .progress_unit
                    .or_else(|| progress_unit_for_event(parsed.stage.as_deref(), &event)),
                stage: parsed.stage,
                stage_detail: parsed.stage_detail,
                provider: parsed.provider,
                provider_stage: parsed.provider_stage,
                event_type: Some(parsed.event_type.unwrap_or_else(|| event.clone())),
                event,
                message: parsed.message.unwrap_or_default(),
                progress_current: parsed.progress_current,
                progress_total: parsed.progress_total,
                retry_count: parsed.retry_count,
                elapsed_ms: parsed.elapsed_ms,
                payload: Some(parsed.payload.unwrap_or(Value::Object(Default::default()))),
            })
        })
        .collect()
}

fn user_stage_for_event(stage: Option<&str>) -> Option<String> {
    match stage.map(str::trim).unwrap_or_default() {
        "ocr_upload" | "ocr_processing" | "ocr_result_ready" | "normalizing" => {
            Some("ocr".to_string())
        }
        "translation_prepare"
        | "translating"
        | "translation_batches"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair" => Some("translate".to_string()),
        "render_prepare" | "rendering" | "compile" | "overlay" | "saving" => {
            Some("render".to_string())
        }
        "finished" | "done" => Some("done".to_string()),
        _ => None,
    }
}

fn progress_unit_for_event(stage: Option<&str>, event: &str) -> Option<String> {
    let unit = match stage.map(str::trim).unwrap_or_default() {
        "translating" | "translation_batches" => "batch",
        "ocr_processing"
        | "continuation_review"
        | "page_policies"
        | "domain_inference"
        | "garbled_repair"
        | "rendering" => "page",
        "compile"
        | "overlay"
        | "saving"
        | "render_prepare"
        | "translation_prepare"
        | "normalizing" => "step",
        _ if event == "stage_progress" => "step",
        _ => "none",
    };
    Some(unit.to_string())
}

fn select_live_stage_snapshot(items: &[JobEventRecord]) -> Option<LiveStageSnapshot> {
    items
        .iter()
        .filter(|item| {
            let event_type = item.event_type.as_deref().map(str::trim).unwrap_or("");
            let stage = item.stage.as_deref().map(str::trim).unwrap_or("");
            event_type != "artifact_published" && !stage.is_empty()
        })
        .max_by(|left, right| {
            user_stage_rank(left.stage.as_deref())
                .cmp(&user_stage_rank(right.stage.as_deref()))
                .then_with(|| left.ts.cmp(&right.ts))
                .then_with(|| left.seq.cmp(&right.seq))
        })
        .map(|item| LiveStageSnapshot {
            stage: item.stage.clone(),
            stage_detail: item.stage_detail.clone(),
            progress_current: item.progress_current,
            progress_total: item.progress_total,
        })
}

fn user_stage_rank(stage: Option<&str>) -> i32 {
    match stage.and_then(JobStage::from_str) {
        Some(JobStage::Queued) => 0,
        Some(JobStage::Rendering | JobStage::Finished) => 3,
        Some(JobStage::Translating) => 2,
        Some(
            JobStage::OcrSubmitting
            | JobStage::OcrUpload
            | JobStage::MineruUpload
            | JobStage::OcrProcessing
            | JobStage::MineruProcessing
            | JobStage::OcrResultReady
            | JobStage::Normalizing,
        ) => 1,
        Some(JobStage::Running) => 0,
        Some(JobStage::Canceled | JobStage::Failed) => 0,
        None => {
            let normalized = stage.unwrap_or_default().trim();
            if normalized.contains("render") {
                return 3;
            }
            if normalized == "succeeded" {
                return 3;
            }
            if normalized.contains("translat")
                || normalized == "domain_inference"
                || normalized == "continuation_review"
                || normalized == "page_policies"
            {
                return 2;
            }
            if normalized.contains("ocr")
                || normalized.contains("mineru")
                || normalized.contains("paddle")
                || normalized.contains("normaliz")
            {
                return 1;
            }
            0
        }
    }
}

fn normalized_event_name(parsed: &PipelineEventJsonlRecord) -> String {
    parsed
        .event
        .clone()
        .or_else(|| parsed.event_type.clone())
        .unwrap_or_else(|| "diagnostic".to_string())
}
