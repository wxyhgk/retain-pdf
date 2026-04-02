use std::fs::OpenOptions;
use std::io::Write;

use anyhow::Result;
use serde_json::{json, Value};
use tracing::warn;

use crate::models::{JobEventRecord, JobStatusKind, StoredJob, WorkflowKind};
use crate::storage_paths::resolve_data_path;
use crate::AppState;

const EVENTS_FILE_NAME: &str = "events.jsonl";

#[derive(Clone)]
struct PendingJobEvent {
    level: String,
    stage: Option<String>,
    event: String,
    message: String,
    payload: Option<Value>,
}

pub fn persist_job(state: &AppState, job: &StoredJob) -> Result<()> {
    let previous = state.db.get_job(&job.job_id).ok();
    state.db.save_job(job)?;
    emit_job_events_best_effort(state, previous.as_ref(), job);
    Ok(())
}

pub fn record_custom_job_event(
    state: &AppState,
    job: &StoredJob,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) {
    let pending = PendingJobEvent {
        level: level.to_string(),
        stage: job.stage.clone(),
        event: event.to_string(),
        message: message.into(),
        payload,
    };
    if let Err(err) = append_pending_event(state, job, pending) {
        warn!("failed to append job event for {}: {}", job.job_id, err);
    }
}

fn emit_job_events_best_effort(
    state: &AppState,
    previous: Option<&StoredJob>,
    current: &StoredJob,
) {
    for pending in derive_events(previous, current) {
        if let Err(err) = append_pending_event(state, current, pending) {
            warn!("failed to append job event for {}: {}", current.job_id, err);
        }
    }
}

fn append_pending_event(
    state: &AppState,
    job: &StoredJob,
    pending: PendingJobEvent,
) -> Result<JobEventRecord> {
    let event = state.db.append_event(
        &job.job_id,
        &pending.level,
        pending.stage.clone(),
        &pending.event,
        &pending.message,
        pending.payload.clone(),
    )?;
    append_event_jsonl(state, job, &event)?;
    Ok(event)
}

fn append_event_jsonl(state: &AppState, job: &StoredJob, event: &JobEventRecord) -> Result<()> {
    let logs_dir = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
        .and_then(|job_root| resolve_data_path(&state.config.data_root, job_root).ok())
        .map(|root| root.join("logs"))
        .unwrap_or_else(|| state.config.output_root.join(&job.job_id).join("logs"));
    std::fs::create_dir_all(&logs_dir)?;
    let path = logs_dir.join(EVENTS_FILE_NAME);
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    serde_json::to_writer(&mut file, event)?;
    file.write_all(b"\n")?;
    Ok(())
}

fn derive_events(previous: Option<&StoredJob>, current: &StoredJob) -> Vec<PendingJobEvent> {
    let mut events = Vec::new();
    if previous.is_none() {
        events.push(PendingJobEvent {
            level: "info".to_string(),
            stage: current.stage.clone(),
            event: "job_created".to_string(),
            message: "任务已创建".to_string(),
            payload: Some(json!({
                "workflow": workflow_name(&current.workflow),
                "status": status_name(&current.status),
                "stage": current.stage.clone(),
            })),
        });
        return events;
    }

    let previous = previous.expect("checked above");
    if previous.status != current.status {
        let level = if matches!(current.status, JobStatusKind::Failed) {
            "error"
        } else {
            "info"
        };
        events.push(PendingJobEvent {
            level: level.to_string(),
            stage: current.stage.clone(),
            event: "status_changed".to_string(),
            message: format!("任务状态变更为 {}", status_name(&current.status)),
            payload: Some(json!({
                "from": status_name(&previous.status),
                "to": status_name(&current.status),
            })),
        });
    }

    if previous.stage != current.stage
        || previous.stage_detail != current.stage_detail
        || previous.progress_current != current.progress_current
        || previous.progress_total != current.progress_total
    {
        events.push(PendingJobEvent {
            level: "info".to_string(),
            stage: current.stage.clone(),
            event: "stage_updated".to_string(),
            message: current
                .stage_detail
                .clone()
                .or_else(|| current.stage.clone())
                .unwrap_or_else(|| "任务进度更新".to_string()),
            payload: Some(json!({
                "from_stage": previous.stage.clone(),
                "to_stage": current.stage.clone(),
                "progress_current": current.progress_current,
                "progress_total": current.progress_total,
            })),
        });
    }

    if previous.error != current.error {
        if let Some(error) = current
            .error
            .clone()
            .filter(|value| !value.trim().is_empty())
        {
            events.push(PendingJobEvent {
                level: "error".to_string(),
                stage: current.stage.clone(),
                event: "job_error".to_string(),
                message: error.clone(),
                payload: Some(json!({
                    "error": error,
                })),
            });
        }
    }

    events
}

fn status_name(status: &JobStatusKind) -> &'static str {
    match status {
        JobStatusKind::Queued => "queued",
        JobStatusKind::Running => "running",
        JobStatusKind::Succeeded => "succeeded",
        JobStatusKind::Failed => "failed",
        JobStatusKind::Canceled => "canceled",
    }
}

fn workflow_name(workflow: &WorkflowKind) -> &'static str {
    match workflow {
        WorkflowKind::Mineru => "mineru",
        WorkflowKind::Ocr => "ocr",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobRequest;

    fn job() -> StoredJob {
        StoredJob::new(
            "job-1".to_string(),
            CreateJobRequest::default(),
            vec!["python".to_string()],
        )
    }

    #[test]
    fn derive_events_emits_created_for_new_job() {
        let current = job();
        let events = derive_events(None, &current);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event, "job_created");
    }

    #[test]
    fn derive_events_emits_status_and_stage_updates() {
        let previous = job();
        let mut current = previous.clone();
        current.status = JobStatusKind::Running;
        current.stage = Some("translating".to_string());
        current.stage_detail = Some("正在翻译".to_string());
        let events = derive_events(Some(&previous), &current);
        assert!(events.iter().any(|item| item.event == "status_changed"));
        assert!(events.iter().any(|item| item.event == "stage_updated"));
    }
}
