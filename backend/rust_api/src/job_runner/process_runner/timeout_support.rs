use anyhow::Result;
use std::path::Path;
use std::time::Instant;

use crate::job_events::persist_job_with_resources;
use crate::models::{JobStatusKind, ProcessResult};

use super::super::JobPersistDeps;

pub(super) fn timeout_detail_for_stage(stage: Option<&str>) -> &'static str {
    match stage {
        Some("normalizing") => "normalization timeout",
        _ => "provider timeout",
    }
}

pub(super) fn apply_timeout_failure(job: &mut crate::models::JobSnapshot, timestamp: String) {
    let timeout_detail = timeout_detail_for_stage(job.stage.as_deref()).to_string();
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
    job: &mut crate::models::JobSnapshot,
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

fn append_timeout_stderr_tail(job: &mut crate::models::JobSnapshot, stderr_text: &str) {
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
    stdout_job: crate::models::JobRuntimeState,
    started: Instant,
    stdout_text: String,
    stderr_text: String,
) -> Result<crate::models::JobRuntimeState> {
    let mut timed_out_job = persist.db.get_job(&stdout_job.job_id)?;
    append_timeout_stderr_tail(&mut timed_out_job, &stderr_text);
    attach_timeout_process_result(
        &mut timed_out_job,
        started,
        stdout_text,
        stderr_text,
        project_root,
    );
    apply_timeout_failure(&mut timed_out_job, crate::models::now_iso());
    persist_job_with_resources(
        persist.db.as_ref(),
        &persist.data_root,
        &persist.output_root,
        &timed_out_job,
    )?;
    Ok(timed_out_job.into_runtime())
}
