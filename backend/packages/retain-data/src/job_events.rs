use std::path::Path;

use anyhow::Result;
use serde_json::Value;
use tracing::warn;

use crate::db::Db;
use crate::models::api::JobEventRecord;
use crate::models::domain::{JobRuntimeState, JobSnapshot};
mod derivation;
mod jsonl;

use derivation::{
    custom_event, derive_events, normalize_user_stage, progress_unit_for_event,
    user_stage_for_event, PendingJobEvent,
};
use jsonl::append_event_jsonl;

pub fn persist_job_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
) -> Result<()> {
    let previous = db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    db.save_job(&current)?;
    emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
    Ok(())
}

pub fn cas_persist_job_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    expected_statuses: &[&str],
) -> Result<bool> {
    let previous = db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    let updated = db.cas_save_job(&current, expected_statuses)?;
    if updated {
        emit_job_events_best_effort(db, data_root, output_root, previous.as_ref(), &current);
    }
    Ok(updated)
}

pub fn persist_runtime_job_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobRuntimeState,
) -> Result<()> {
    let snapshot = job.snapshot();
    persist_job_with_resources(db, data_root, output_root, &snapshot)
}

pub fn record_custom_job_event_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) {
    let pending = custom_event(job, level, event, message, payload);
    if let Err(err) = append_pending_event(db, data_root, output_root, job, pending) {
        warn!("failed to append job event for {}: {}", job.job_id, err);
    }
}

pub fn record_custom_runtime_event_with_resources(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) {
    record_custom_job_event_with_resources(
        db,
        data_root,
        output_root,
        job,
        level,
        event,
        message,
        payload,
    );
}

fn emit_job_events_best_effort(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    previous: Option<&JobSnapshot>,
    current: &JobSnapshot,
) {
    for pending in derive_events(previous, current) {
        if let Err(err) = append_pending_event(db, data_root, output_root, current, pending) {
            warn!("failed to append job event for {}: {}", current.job_id, err);
        }
    }
}

fn append_pending_event(
    db: &Db,
    data_root: &Path,
    output_root: &Path,
    job: &JobSnapshot,
    pending: PendingJobEvent,
) -> Result<JobEventRecord> {
    let event = db.append_event(
        &job.job_id,
        &pending.level,
        pending.stage.clone(),
        pending.stage_detail.clone(),
        pending.provider.clone(),
        pending.provider_stage.clone(),
        &pending.event,
        Some(pending.event.clone()),
        &pending.message,
        pending.progress_current,
        pending.progress_total,
        pending.payload.clone(),
        pending.retry_count,
        pending.elapsed_ms,
    )?;
    let event = JobEventRecord {
        user_stage: pending
            .user_stage
            .clone()
            .map(normalize_user_stage)
            .or_else(|| user_stage_for_event(event.stage.as_deref())),
        substage: pending
            .substage
            .clone()
            .or_else(|| event.provider_stage.clone()),
        progress_unit: pending
            .progress_unit
            .clone()
            .or_else(|| progress_unit_for_event(event.stage.as_deref(), &event.event)),
        ..event
    };
    append_event_jsonl(data_root, output_root, job, &event)?;
    Ok(event)
}
