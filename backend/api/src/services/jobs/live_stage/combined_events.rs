use std::path::Path;

use serde_json::{json, Value};

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::JobEventRecord;
use crate::models::domain::JobSnapshot;

use super::canonical_events::canonicalize_job_event;
use super::records::load_pipeline_event_records;

pub(crate) fn list_combined_job_events(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<Vec<JobEventRecord>, AppError> {
    let mut items = db.list_job_events(&job.job_id, 10_000, 0)?;
    let base_seq = items.iter().map(|item| item.seq).max().unwrap_or(0);
    let durable_state_authority = db.has_pipeline_attempt(&job.job_id)?;
    let mut file_items =
        load_pipeline_event_records(job, data_root, base_seq, durable_state_authority);
    items.append(&mut file_items);
    append_ocr_child_events(db, data_root, job, &mut items)?;
    items.sort_by(|left, right| {
        left.ts
            .cmp(&right.ts)
            .then_with(|| left.seq.cmp(&right.seq))
            .then_with(|| left.event.cmp(&right.event))
    });
    for (index, item) in items.iter_mut().enumerate() {
        let source_kind = item
            .payload
            .as_ref()
            .and_then(|payload| payload.get("raw_source_kind"))
            .and_then(|value| value.as_str())
            .unwrap_or("db")
            .to_string();
        item.seq = (index + 1) as i64;
        canonicalize_job_event(item, &source_kind);
    }
    Ok(items)
}

fn append_ocr_child_events(
    db: &Db,
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
    let child_has_durable_authority = db.has_pipeline_attempt(ocr_job_id)?;
    let mut child_file_items = load_pipeline_event_records(
        &ocr_job,
        data_root,
        base_seq + child_items.len() as i64,
        child_has_durable_authority,
    );
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
        "raw_source_kind": "ocr_child",
        "source_job_id": source_job_id,
        "source_event": original_payload,
    }));
    item
}
