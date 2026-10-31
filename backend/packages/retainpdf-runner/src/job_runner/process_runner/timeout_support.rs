use anyhow::Result;
use std::path::Path;
use std::time::Instant;

use crate::job_events::cas_persist_job_with_resources;
use crate::models::domain::{now_iso, JobRuntimeState, JobSnapshot, JobStatusKind, ProcessResult};

use super::super::JobPersistDeps;

/// 三种超时最后都落成 `return_code == -1`,`classify_job_failure` 也都归到 `process_timeout`——处置方式
/// 确实一样。给用户看的那句话(`detail`,见 `execution::TimeoutLimits::detail`)分开说:没有进展、跑满了
/// 绝对上限、没有任何输出,排查方向不同。
pub(super) fn apply_timeout_failure_with_detail(
    job: &mut JobSnapshot,
    timestamp: String,
    timeout_detail: String,
) {
    job.pid = None;
    job.updated_at = timestamp.clone();
    job.finished_at = Some(timestamp);
    job.status = JobStatusKind::Failed;
    job.stage = Some("failed".to_string());
    job.stage_detail = Some(timeout_detail.clone());
    job.error = Some(timeout_detail);
    job.sync_runtime_state();
    job.replace_failure_info(crate::job_failure::classify_job_failure(job));
}

fn attach_timeout_process_result(
    job: &mut JobSnapshot,
    started: Instant,
    stdout_text: String,
    stderr_text: String,
    project_root: &Path,
) {
    job.result = Some(ProcessResult {
        success: false,
        return_code: -1,
        duration_seconds: started.elapsed().as_secs_f64(),
        command: job.command.clone(),
        cwd: project_root.to_string_lossy().to_string(),
        stdout: stdout_text,
        stderr: stderr_text,
    });
}

fn append_timeout_stderr_tail(job: &mut JobSnapshot, stderr_text: &str) {
    let lines: Vec<&str> = stderr_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    if lines.is_empty() {
        return;
    }
    job.append_log("stderr before timeout:");
    for line in lines.iter().rev().take(8).rev() {
        job.append_log(line);
    }
}

pub(super) fn persist_timeout_failure(
    persist: &JobPersistDeps,
    project_root: &Path,
    stdout_job: JobRuntimeState,
    started: Instant,
    stdout_text: String,
    stderr_text: String,
    detail: String,
) -> Result<JobRuntimeState> {
    let mut timed_out_job = persist.db.get_job(&stdout_job.job_id)?;
    // If already canceled, do not overwrite with timeout failure
    if matches!(
        timed_out_job.status,
        crate::models::domain::JobStatusKind::Canceled
    ) {
        return Ok(timed_out_job.into_runtime());
    }
    append_timeout_stderr_tail(&mut timed_out_job, &stderr_text);
    attach_timeout_process_result(
        &mut timed_out_job,
        started,
        stdout_text,
        stderr_text,
        project_root,
    );
    apply_timeout_failure_with_detail(&mut timed_out_job, now_iso(), detail);
    let updated = cas_persist_job_with_resources(
        persist.db.as_ref(),
        &persist.data_root,
        &persist.output_root,
        &timed_out_job,
        &["queued", "running"],
    )?;
    if !updated {
        // Already terminal (e.g., canceled), do not overwrite
        if let Ok(current) = persist.db.get_job(&stdout_job.job_id) {
            return Ok(current.into_runtime());
        }
    }
    Ok(timed_out_job.into_runtime())
}
