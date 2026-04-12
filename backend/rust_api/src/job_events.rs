use std::fs::OpenOptions;
use std::io::Write;

use anyhow::Result;
use serde_json::{json, Value};
use tracing::warn;

use crate::models::{JobEventRecord, JobRuntimeState, JobSnapshot, JobStatusKind, WorkflowKind};
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

pub fn persist_job(state: &AppState, job: &JobSnapshot) -> Result<()> {
    let previous = state.db.get_job(&job.job_id).ok();
    let mut current = job.clone();
    current.sync_runtime_state();
    state.db.save_job(&current)?;
    emit_job_events_best_effort(state, previous.as_ref(), &current);
    Ok(())
}

pub fn persist_runtime_job(state: &AppState, job: &JobRuntimeState) -> Result<()> {
    let snapshot = job.snapshot();
    persist_job(state, &snapshot)
}

pub fn record_custom_job_event(
    state: &AppState,
    job: &JobSnapshot,
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

pub fn record_custom_runtime_event(
    state: &AppState,
    job: &JobRuntimeState,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) {
    let snapshot = job.snapshot();
    record_custom_job_event(state, &snapshot, level, event, message, payload);
}

fn emit_job_events_best_effort(
    state: &AppState,
    previous: Option<&JobSnapshot>,
    current: &JobSnapshot,
) {
    for pending in derive_events(previous, current) {
        if let Err(err) = append_pending_event(state, current, pending) {
            warn!("failed to append job event for {}: {}", current.job_id, err);
        }
    }
}

fn append_pending_event(
    state: &AppState,
    job: &JobSnapshot,
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

fn append_event_jsonl(state: &AppState, job: &JobSnapshot, event: &JobEventRecord) -> Result<()> {
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

fn derive_events(previous: Option<&JobSnapshot>, current: &JobSnapshot) -> Vec<PendingJobEvent> {
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
        if matches!(
            current.status,
            JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
        ) {
            events.push(PendingJobEvent {
                level: level.to_string(),
                stage: current.stage.clone(),
                event: "job_terminal".to_string(),
                message: format!("任务进入终态 {}", status_name(&current.status)),
                payload: Some(json!({
                    "status": status_name(&current.status),
                    "terminal_reason": current.runtime.as_ref().and_then(|runtime| runtime.terminal_reason.clone()),
                    "total_elapsed_ms": current.runtime.as_ref().and_then(|runtime| runtime.total_elapsed_ms),
                    "retry_count": current.runtime.as_ref().map(|runtime| runtime.retry_count),
                    "failure_category": current.failure.as_ref().map(|failure| failure.category.clone()),
                    "failure_summary": current.failure.as_ref().map(|failure| failure.summary.clone()),
                    "failure_root_cause": current.failure.as_ref().and_then(|failure| failure.root_cause.clone()),
                })),
            });
        }
    }

    let stage_changed = previous.stage != current.stage;
    let progress_changed = previous.progress_current != current.progress_current
        || previous.progress_total != current.progress_total;
    let detail_changed = previous.stage_detail != current.stage_detail;

    if stage_changed || detail_changed || progress_changed {
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
        events.push(PendingJobEvent {
            level: "info".to_string(),
            stage: current.stage.clone(),
            event: if stage_changed {
                "stage_transition".to_string()
            } else {
                "stage_progress".to_string()
            },
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
                "active_stage_elapsed_ms": current.runtime.as_ref().and_then(|runtime| runtime.active_stage_elapsed_ms),
                "total_elapsed_ms": current.runtime.as_ref().and_then(|runtime| runtime.total_elapsed_ms),
                "retry_count": current.runtime.as_ref().map(|runtime| runtime.retry_count),
                "stage_history": current.runtime.as_ref().map(|runtime| runtime.stage_history.clone()),
                "runtime": current.runtime,
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

    if previous.failure != current.failure {
        if let Some(failure) = current.failure.as_ref() {
            events.push(PendingJobEvent {
                level: "error".to_string(),
                stage: current.stage.clone(),
                event: "failure_classified".to_string(),
                message: failure.summary.clone(),
                payload: serde_json::to_value(failure).ok(),
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
        WorkflowKind::Translate => "translate",
        WorkflowKind::Render => "render",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobInput;

    fn job() -> JobSnapshot {
        JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
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
        current.started_at = Some("2026-04-11T00:00:00Z".to_string());
        current.updated_at = "2026-04-11T00:00:05Z".to_string();
        current.sync_runtime_state();
        let events = derive_events(Some(&previous), &current);
        assert!(events.iter().any(|item| item.event == "status_changed"));
        assert!(events.iter().any(|item| item.event == "stage_updated"));
        assert!(events.iter().any(|item| item.event == "stage_transition"));

        let transition = events
            .iter()
            .find(|item| item.event == "stage_transition")
            .expect("stage transition event");
        let payload = transition
            .payload
            .as_ref()
            .expect("stage transition payload");
        assert_eq!(
            payload.get("from_stage").and_then(Value::as_str),
            Some("queued")
        );
        assert_eq!(
            payload.get("to_stage").and_then(Value::as_str),
            Some("translating")
        );
        assert!(payload.get("runtime").is_some());
        assert!(payload.get("stage_history").is_some());
    }

    #[test]
    fn derive_events_emits_failure_and_terminal_events() {
        let previous = job();
        let mut current = previous.clone();
        current.status = JobStatusKind::Failed;
        current.stage = Some("failed".to_string());
        current.stage_detail = Some("provider timeout".to_string());
        current.error = Some("ReadTimeout".to_string());
        current.replace_failure_info(Some(crate::models::JobFailureInfo {
            stage: "translation".to_string(),
            category: "upstream_timeout".to_string(),
            code: None,
            summary: "外部服务请求超时".to_string(),
            root_cause: Some("测试".to_string()),
            retryable: true,
            upstream_host: Some("api.deepseek.com".to_string()),
            provider: Some("deepseek".to_string()),
            suggestion: Some("重试".to_string()),
            last_log_line: Some("ReadTimeout".to_string()),
            raw_error_excerpt: Some("ReadTimeout".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        }));
        current.sync_runtime_state();

        let events = derive_events(Some(&previous), &current);
        assert!(events.iter().any(|item| item.event == "job_terminal"));
        assert!(events.iter().any(|item| item.event == "failure_classified"));

        let terminal = events
            .iter()
            .find(|item| item.event == "job_terminal")
            .expect("terminal event");
        let payload = terminal.payload.as_ref().expect("terminal payload");
        assert_eq!(
            payload.get("status").and_then(Value::as_str),
            Some("failed")
        );
        assert_eq!(
            payload.get("failure_category").and_then(Value::as_str),
            Some("upstream_timeout")
        );
        assert_eq!(
            payload.get("failure_summary").and_then(Value::as_str),
            Some("外部服务请求超时")
        );
    }
}
