use serde_json::{json, Value};

use crate::models::domain::{
    event_progress_unit, job_user_stage, normalize_event_user_stage, JobSnapshot, JobStatusKind,
    OcrProviderKind, WorkflowKind,
};

#[derive(Clone)]
pub(super) struct PendingJobEvent {
    pub(super) level: String,
    pub(super) stage: Option<String>,
    pub(super) stage_detail: Option<String>,
    pub(super) provider: Option<String>,
    pub(super) provider_stage: Option<String>,
    pub(super) user_stage: Option<String>,
    pub(super) substage: Option<String>,
    pub(super) progress_unit: Option<String>,
    pub(super) event: String,
    pub(super) message: String,
    pub(super) progress_current: Option<i64>,
    pub(super) progress_total: Option<i64>,
    pub(super) retry_count: Option<u32>,
    pub(super) elapsed_ms: Option<i64>,
    pub(super) payload: Option<Value>,
}

pub(super) fn custom_event(
    job: &JobSnapshot,
    level: &str,
    event: &str,
    message: impl Into<String>,
    payload: Option<Value>,
) -> PendingJobEvent {
    PendingJobEvent {
        level: level.to_string(),
        stage: job.stage.clone(),
        stage_detail: job.stage_detail.clone(),
        provider: event_provider(job),
        provider_stage: event_provider_stage(job),
        user_stage: user_stage_for_event(job.stage.as_deref()),
        substage: event_provider_stage(job),
        progress_unit: progress_unit_for_event(job.stage.as_deref(), event),
        event: event.to_string(),
        message: message.into(),
        progress_current: job.progress_current,
        progress_total: job.progress_total,
        retry_count: event_retry_count(job),
        elapsed_ms: event_elapsed_ms(job),
        payload,
    }
}

pub(super) fn derive_events(
    previous: Option<&JobSnapshot>,
    current: &JobSnapshot,
) -> Vec<PendingJobEvent> {
    let mut events = Vec::new();
    if previous.is_none() {
        events.push(PendingJobEvent {
            level: "info".to_string(),
            stage: current.stage.clone(),
            stage_detail: current.stage_detail.clone(),
            provider: event_provider(current),
            provider_stage: event_provider_stage(current),
            user_stage: user_stage_for_event(current.stage.as_deref()),
            substage: event_provider_stage(current),
            progress_unit: progress_unit_for_event(current.stage.as_deref(), "job_created"),
            event: "job_created".to_string(),
            message: "任务已创建".to_string(),
            progress_current: current.progress_current,
            progress_total: current.progress_total,
            retry_count: event_retry_count(current),
            elapsed_ms: event_elapsed_ms(current),
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
            stage_detail: current.stage_detail.clone(),
            provider: event_provider(current),
            provider_stage: event_provider_stage(current),
            user_stage: user_stage_for_event(current.stage.as_deref()),
            substage: event_provider_stage(current),
            progress_unit: progress_unit_for_event(current.stage.as_deref(), "status_changed"),
            event: "status_changed".to_string(),
            message: format!("任务状态变更为 {}", status_name(&current.status)),
            progress_current: current.progress_current,
            progress_total: current.progress_total,
            retry_count: event_retry_count(current),
            elapsed_ms: event_elapsed_ms(current),
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
                stage_detail: current.stage_detail.clone(),
                provider: event_provider(current),
                provider_stage: event_provider_stage(current),
                user_stage: user_stage_for_event(current.stage.as_deref()),
                substage: event_provider_stage(current),
                progress_unit: progress_unit_for_event(current.stage.as_deref(), "job_terminal"),
                event: "job_terminal".to_string(),
                message: format!("任务进入终态 {}", status_name(&current.status)),
                progress_current: current.progress_current,
                progress_total: current.progress_total,
                retry_count: event_retry_count(current),
                elapsed_ms: event_elapsed_ms(current),
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
            stage_detail: current.stage_detail.clone(),
            provider: event_provider(current),
            provider_stage: event_provider_stage(current),
            user_stage: user_stage_for_event(current.stage.as_deref()),
            substage: event_provider_stage(current),
            progress_unit: progress_unit_for_event(current.stage.as_deref(), "stage_updated"),
            event: "stage_updated".to_string(),
            message: current
                .stage_detail
                .clone()
                .or_else(|| current.stage.clone())
                .unwrap_or_else(|| "任务进度更新".to_string()),
            progress_current: current.progress_current,
            progress_total: current.progress_total,
            retry_count: event_retry_count(current),
            elapsed_ms: event_elapsed_ms(current),
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
            stage_detail: current.stage_detail.clone(),
            provider: event_provider(current),
            provider_stage: event_provider_stage(current),
            user_stage: user_stage_for_event(current.stage.as_deref()),
            substage: event_provider_stage(current),
            progress_unit: progress_unit_for_event(
                current.stage.as_deref(),
                if stage_changed { "stage_transition" } else { "stage_progress" },
            ),
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
            progress_current: current.progress_current,
            progress_total: current.progress_total,
            retry_count: event_retry_count(current),
            elapsed_ms: event_elapsed_ms(current),
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
                stage_detail: current.stage_detail.clone(),
                provider: event_provider(current),
                provider_stage: event_provider_stage(current),
                user_stage: user_stage_for_event(current.stage.as_deref()),
                substage: event_provider_stage(current),
                progress_unit: progress_unit_for_event(current.stage.as_deref(), "job_error"),
                event: "job_error".to_string(),
                message: error.clone(),
                progress_current: current.progress_current,
                progress_total: current.progress_total,
                retry_count: event_retry_count(current),
                elapsed_ms: event_elapsed_ms(current),
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
                stage_detail: current.stage_detail.clone(),
                provider: failure.provider.clone().or_else(|| event_provider(current)),
                provider_stage: failure
                    .provider_stage
                    .clone()
                    .or_else(|| event_provider_stage(current)),
                user_stage: user_stage_for_event(current.stage.as_deref()),
                substage: failure
                    .provider_stage
                    .clone()
                    .or_else(|| event_provider_stage(current)),
                progress_unit: progress_unit_for_event(
                    current.stage.as_deref(),
                    "failure_classified",
                ),
                event: "failure_classified".to_string(),
                message: failure.summary.clone(),
                progress_current: current.progress_current,
                progress_total: current.progress_total,
                retry_count: event_retry_count(current),
                elapsed_ms: event_elapsed_ms(current),
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
        WorkflowKind::Book => "book",
        WorkflowKind::Ocr => "ocr",
        WorkflowKind::Translate => "translate",
        WorkflowKind::Render => "render",
    }
}

pub(super) fn event_provider(job: &JobSnapshot) -> Option<String> {
    job.failure
        .as_ref()
        .and_then(|failure| failure.provider.clone())
        .or_else(|| {
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                .map(|diagnostics| match diagnostics.provider {
                    OcrProviderKind::Mineru => Some("mineru".to_string()),
                    OcrProviderKind::Paddle => Some("paddle".to_string()),
                    OcrProviderKind::Local => Some("local".to_string()),
                    OcrProviderKind::Unknown => None,
                })
                .flatten()
        })
        .or_else(|| {
            let provider = job.request_payload.ocr.provider.trim();
            if provider.is_empty() {
                None
            } else {
                Some(provider.to_string())
            }
        })
}

pub(super) fn event_provider_stage(job: &JobSnapshot) -> Option<String> {
    job.failure
        .as_ref()
        .and_then(|failure| failure.provider_stage.clone())
        .or_else(|| {
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.ocr_provider_diagnostics.as_ref())
                .and_then(|diagnostics| diagnostics.last_status.as_ref())
                .and_then(|status| status.raw_state.clone().or_else(|| status.stage.clone()))
        })
}

pub(super) fn event_retry_count(job: &JobSnapshot) -> Option<u32> {
    job.runtime.as_ref().map(|runtime| runtime.retry_count)
}

pub(super) fn user_stage_for_event(stage: Option<&str>) -> Option<String> {
    job_user_stage(stage).map(str::to_string)
}

pub(super) fn normalize_user_stage(value: String) -> String {
    normalize_event_user_stage(&value)
        .unwrap_or_else(|| value.trim())
        .to_string()
}

pub(super) fn progress_unit_for_event(stage: Option<&str>, event: &str) -> Option<String> {
    Some(event_progress_unit(stage, event).to_string())
}

pub(super) fn event_elapsed_ms(job: &JobSnapshot) -> Option<i64> {
    job.runtime
        .as_ref()
        .and_then(|runtime| runtime.total_elapsed_ms.or(runtime.active_stage_elapsed_ms))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::{job_stage_str, JobFailureInfo, JobStage};
    use crate::models::request::CreateJobInput;

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
        current.stage = Some(job_stage_str(JobStage::Translating).to_string());
        current.stage_detail = Some("正在翻译".to_string());
        current.request_payload.ocr.provider = "paddle".to_string();
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
        assert_eq!(transition.stage_detail.as_deref(), Some("正在翻译"));
        assert_eq!(transition.provider.as_deref(), Some("paddle"));
        assert_eq!(transition.event, "stage_transition");
        assert_eq!(transition.user_stage.as_deref(), Some("translation"));
        assert_eq!(transition.progress_unit.as_deref(), Some("batch"));
    }

    #[test]
    fn derive_events_emits_failure_and_terminal_events() {
        let previous = job();
        let mut current = previous.clone();
        current.status = JobStatusKind::Failed;
        current.stage = Some(job_stage_str(JobStage::Failed).to_string());
        current.stage_detail = Some("provider timeout".to_string());
        current.error = Some("ReadTimeout".to_string());
        current.replace_failure_info(Some(JobFailureInfo {
            stage: "translation".to_string(),
            category: "upstream_timeout".to_string(),
            code: None,
            failed_stage: Some("translation".to_string()),
            failure_code: Some("upstream_timeout".to_string()),
            failure_category: Some("timeout".to_string()),
            provider_stage: None,
            provider_code: None,
            summary: "外部服务请求超时".to_string(),
            root_cause: Some("测试".to_string()),
            retryable: true,
            upstream_host: Some("api.deepseek.com".to_string()),
            provider: Some("deepseek".to_string()),
            suggestion: Some("重试".to_string()),
            last_log_line: Some("ReadTimeout".to_string()),
            raw_excerpt: Some("ReadTimeout".to_string()),
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
        let failure = events
            .iter()
            .find(|item| item.event == "failure_classified")
            .expect("failure event");
        assert_eq!(failure.provider.as_deref(), Some("deepseek"));
        assert_eq!(failure.event, "failure_classified");
    }
}
