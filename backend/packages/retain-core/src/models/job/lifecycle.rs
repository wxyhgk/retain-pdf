use chrono::{DateTime, Utc};

use crate::models::{
    JobFailureInfo, JobRecord, JobRuntimeInfo, JobRuntimeState, JobSnapshot, JobStageTiming,
    JobStatusKind, LOG_TAIL_LIMIT,
};

fn append_log_line(log_tail: &mut Vec<String>, line: &str) {
    let text = line.trim();
    if text.is_empty() {
        return;
    }
    log_tail.push(text.to_string());
    if log_tail.len() > LOG_TAIL_LIMIT {
        let drain = log_tail.len() - LOG_TAIL_LIMIT;
        log_tail.drain(0..drain);
    }
}

fn terminal_reason_for_status(status: &JobStatusKind) -> Option<String> {
    match status {
        JobStatusKind::Succeeded => Some("succeeded".to_string()),
        JobStatusKind::Failed => Some("failed".to_string()),
        JobStatusKind::Canceled => Some("canceled".to_string()),
        JobStatusKind::Queued | JobStatusKind::Running => None,
    }
}

fn parse_iso_timestamp(value: &str) -> Option<DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn duration_ms_between(start: &str, end: &str) -> Option<i64> {
    let start = parse_iso_timestamp(start)?;
    let end = parse_iso_timestamp(end)?;
    Some((end - start).num_milliseconds().max(0))
}

impl JobRecord {
    fn ensure_runtime_info(&mut self) -> &mut JobRuntimeInfo {
        if self.runtime.is_none() {
            self.runtime = Some(JobRuntimeInfo::default());
        }
        self.runtime.as_mut().unwrap()
    }

    fn sync_runtime_info(&mut self) {
        let updated_at = self.updated_at.clone();
        let stage = self.stage.clone();
        let stage_detail = self.stage_detail.clone();
        let terminal_reason = terminal_reason_for_status(&self.status);
        let started_at = self.started_at.clone();
        let finished_at = self
            .finished_at
            .clone()
            .unwrap_or_else(|| updated_at.clone());
        let failure = self.failure.clone();

        let runtime = self.ensure_runtime_info();
        let previous_stage = runtime.current_stage.clone();
        let previous_stage_started_at = runtime.stage_started_at.clone();

        if previous_stage != stage {
            close_active_stage_entry(
                runtime,
                previous_stage.as_deref(),
                previous_stage_started_at.as_deref(),
                &updated_at,
                terminal_reason.as_ref(),
            );

            runtime.current_stage = stage.clone();
            runtime.stage_started_at = Some(updated_at.clone());
            runtime.last_stage_transition_at = Some(updated_at.clone());

            if let Some(stage_name) = stage.as_ref() {
                runtime.stage_history.push(JobStageTiming {
                    stage: stage_name.clone(),
                    detail: stage_detail.clone(),
                    enter_at: updated_at.clone(),
                    exit_at: None,
                    duration_ms: None,
                    terminal_status: None,
                });
            }
        } else if let Some(active) = runtime
            .stage_history
            .last_mut()
            .filter(|entry| entry.exit_at.is_none())
        {
            active.detail = stage_detail.clone();
        }

        if terminal_reason.is_some() {
            let current_stage_started_at = runtime.stage_started_at.clone();
            close_active_stage_entry(
                runtime,
                stage.as_deref(),
                current_stage_started_at.as_deref(),
                &finished_at,
                terminal_reason.as_ref(),
            );
        }

        runtime.terminal_reason = terminal_reason;
        runtime.active_stage_elapsed_ms = runtime
            .stage_started_at
            .as_deref()
            .and_then(|start| duration_ms_between(start, &updated_at));
        runtime.total_elapsed_ms = started_at
            .as_deref()
            .and_then(|start| duration_ms_between(start, &finished_at));
        runtime.final_failure_category = failure.as_ref().map(|item| item.category.clone());
        runtime.final_failure_summary = failure.as_ref().map(|item| item.summary.clone());
    }

    fn replace_failure_info(&mut self, failure: Option<JobFailureInfo>) {
        let updated_at = self.updated_at.clone();
        self.failure = failure;
        let has_failure = self.failure.is_some();
        let status_is_failed = matches!(self.status, JobStatusKind::Failed);
        let final_failure_category = self.failure.as_ref().map(|item| item.category.clone());
        let final_failure_summary = self.failure.as_ref().map(|item| item.summary.clone());
        let runtime = self.ensure_runtime_info();
        if has_failure {
            runtime.last_error_at = Some(updated_at);
            runtime.terminal_reason = Some("failed".to_string());
        } else if !status_is_failed {
            runtime.last_error_at = None;
        }
        runtime.final_failure_category = final_failure_category;
        runtime.final_failure_summary = final_failure_summary;
    }

    fn register_retry(&mut self) {
        let updated_at = self.updated_at.clone();
        let runtime = self.ensure_runtime_info();
        runtime.retry_count = runtime.retry_count.saturating_add(1);
        runtime.last_retry_at = Some(updated_at);
    }
}

fn close_active_stage_entry(
    runtime: &mut JobRuntimeInfo,
    stage: Option<&str>,
    stage_started_at: Option<&str>,
    exit_at: &str,
    terminal_reason: Option<&String>,
) {
    let Some(stage_name) = stage.filter(|value| !value.trim().is_empty()) else {
        return;
    };
    let Some(active) = runtime
        .stage_history
        .iter_mut()
        .rev()
        .find(|entry| entry.stage == stage_name && entry.exit_at.is_none())
    else {
        return;
    };
    let enter_at = stage_started_at.unwrap_or(active.enter_at.as_str());
    active.exit_at = Some(exit_at.to_string());
    active.duration_ms = duration_ms_between(enter_at, exit_at);
    active.terminal_status = terminal_reason.and_then(|reason| match reason.as_str() {
        "succeeded" => Some(JobStatusKind::Succeeded),
        "failed" => Some(JobStatusKind::Failed),
        "canceled" => Some(JobStatusKind::Canceled),
        _ => None,
    });
}

impl JobSnapshot {
    pub fn append_log(&mut self, line: &str) {
        append_log_line(&mut self.record.log_tail, line);
    }

    pub fn sync_runtime_state(&mut self) {
        self.record.sync_runtime_info();
    }

    pub fn replace_failure_info(&mut self, failure: Option<JobFailureInfo>) {
        self.record.replace_failure_info(failure);
    }

    pub fn register_retry(&mut self) {
        self.record.register_retry();
    }

    pub(crate) fn with_synced_runtime(mut self) -> Self {
        self.sync_runtime_state();
        self
    }
}

impl JobRuntimeState {
    pub fn append_log(&mut self, line: &str) {
        append_log_line(&mut self.record.log_tail, line);
    }

    pub fn sync_runtime_state(&mut self) {
        self.record.sync_runtime_info();
    }

    pub fn replace_failure_info(&mut self, failure: Option<JobFailureInfo>) {
        self.record.replace_failure_info(failure);
    }

    pub fn register_retry(&mut self) {
        self.record.register_retry();
    }
}
