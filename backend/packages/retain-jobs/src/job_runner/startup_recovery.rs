use anyhow::Result;
use std::path::Path;
use tracing::warn;

use crate::config::AppConfig;
use crate::db::Db;
use crate::job_events::persist_job_with_resources;
use crate::models::domain::{now_iso, JobFailureInfo, JobStatusKind};

use super::worker_process::{terminate_job_process_tree_blocking, worker_process_exists};

/// Why a `Running`-status job found when its owning runtime starts is being reconciled.
enum StaleReason {
    /// No pid was ever recorded for this job.
    NoPid,
    /// The recorded pid is no longer alive.
    Dead(u32),
    /// The recorded pid is still alive, but the owning runtime restarted and
    /// can no longer consume its stdout or mark it finished.
    Orphaned(u32),
}

/// Reconcile workers only when the process that owns the runtime starts.
///
/// InProcess mode calls this from the HTTP shell. Remote mode calls it from
/// retain-jobsd. The shell must never call it for jobsd-owned workers.
pub fn reconcile_stale_running_jobs(config: &AppConfig, db: &Db) -> Result<usize> {
    let running_jobs = db.list_job_process_records_with_status(&JobStatusKind::Running)?;
    let mut reconciled = 0usize;
    for job_record in running_jobs {
        let reason = match job_record.pid {
            Some(pid) if worker_process_exists(pid) => StaleReason::Orphaned(pid),
            Some(pid) => StaleReason::Dead(pid),
            None => StaleReason::NoPid,
        };

        if let StaleReason::Orphaned(pid) = reason {
            warn!(
                "runtime startup found live orphaned worker process pid={pid} for job {} still running; terminating its process tree before recovering job state",
                job_record.job_id
            );
            if let Err(error) = terminate_job_process_tree_blocking(
                pid,
                config.job_runner.worker_terminate_grace_secs,
                config.job_runner.worker_terminate_poll_ms,
            ) {
                warn!(
                    "failed to terminate orphaned worker process pid={pid} for job {}: {error:#}",
                    job_record.job_id
                );
            }
        }

        let (detail, failure_category, failure_code) = match reason {
            StaleReason::Orphaned(pid) => (
                format!(
                    "任务运行时启动时发现遗留 running 任务，worker 进程 {pid} 仍在运行（孤儿进程），已终止该进程"
                ),
                "worker_orphaned_after_restart",
                "worker_orphaned_after_restart",
            ),
            StaleReason::Dead(pid) => (
                format!("任务运行时启动时发现遗留 running 任务，但 worker 进程 {pid} 已不存在"),
                "worker_process_missing",
                "worker_process_missing",
            ),
            StaleReason::NoPid => (
                "任务运行时启动时发现遗留 running 任务，但未记录 worker pid".to_string(),
                "worker_process_missing",
                "worker_process_missing",
            ),
        };
        let timestamp = now_iso();
        let resumable = db.has_running_pipeline_attempt(&job_record.job_id)?;
        match db.get_job(&job_record.job_id) {
            Ok(mut job) => {
                job.updated_at = timestamp.clone();
                job.pid = None;
                let committed_render_output = restore_committed_render_output(
                    &mut job,
                    committed_render_output_path(db, &job_record.job_id)?,
                );
                if committed_render_output {
                    job.append_log(&format!("WARN: {detail}"));
                    job.append_log(
                        "INFO: committed render output recovered; task completed without rerender",
                    );
                    job.status = JobStatusKind::Succeeded;
                    job.stage = Some("finished".to_string());
                    job.stage_detail =
                        Some("runtime restart recovered committed render output".to_string());
                    job.error = None;
                    job.finished_at = Some(timestamp.clone());
                    job.replace_failure_info(None);
                } else if resumable {
                    job.append_log(&format!("WARN: {detail}"));
                    job.append_log(
                        "INFO: durable pipeline checkpoint found; job requeued for automatic resume",
                    );
                    job.status = JobStatusKind::Queued;
                    job.stage_detail = Some(
                        "runtime restart recovered durable checkpoint; waiting to resume"
                            .to_string(),
                    );
                    job.error = None;
                    job.finished_at = None;
                    job.replace_failure_info(None);
                } else {
                    job.append_log(&format!("ERROR: {detail}"));
                    job.status = JobStatusKind::Failed;
                    job.stage = Some("failed".to_string());
                    job.stage_detail =
                        Some("runtime startup stale running job recovered".to_string());
                    job.error = Some(detail.clone());
                    job.finished_at = Some(timestamp.clone());
                    job.replace_failure_info(Some(JobFailureInfo {
                        stage: "startup_recovery".to_string(),
                        category: failure_category.to_string(),
                        code: None,
                        failed_stage: Some("startup_recovery".to_string()),
                        failure_code: Some(failure_code.to_string()),
                        failure_category: Some("internal".to_string()),
                        provider_stage: None,
                        provider_code: None,
                        summary: "任务运行时启动时回收了遗留 running 任务".to_string(),
                        root_cause: Some(detail.clone()),
                        retryable: true,
                        upstream_host: None,
                        provider: None,
                        suggestion: Some(
                            "该任务对应的 worker 已不在运行；请重新提交或手动重试".to_string(),
                        ),
                        last_log_line: Some(detail.clone()),
                        raw_excerpt: Some(detail.clone()),
                        raw_error_excerpt: Some(detail.clone()),
                        raw_diagnostic: None,
                        ai_diagnostic: None,
                    }));
                }
                job.sync_runtime_state();
                persist_job_with_resources(db, &config.data_root, &config.output_root, &job)?;
                if committed_render_output {
                    db.finish_latest_pipeline_attempt(&job_record.job_id, "succeeded")?;
                }
            }
            Err(error) => {
                warn!(
                    "runtime startup reconciliation fell back to raw DB recovery for {}: {}",
                    job_record.job_id, error
                );
                db.recover_stale_running_job(&job_record.job_id, &detail, &timestamp)?;
            }
        }
        reconciled += 1;
        warn!(
            "recovered stale running job during runtime startup: {} resumable={resumable}",
            job_record.job_id
        );
    }
    if reconciled > 0 {
        warn!("runtime startup reconciliation recovered {reconciled} stale running job(s)");
    }
    Ok(reconciled)
}

/// Re-drive queued jobs that never started a durable attempt.
///
/// Startup-only contract (see `Db::list_stuck_queued_job_ids`): right after
/// a runtime (re)start no driver task owns any queued job, so re-driving is
/// safe. Jobs with a running attempt are excluded here; they resume through
/// `list_resumable_pipeline_job_ids` instead, so the two paths never
/// double-drive the same job.
pub fn requeue_stuck_queued_jobs(config: &AppConfig, db: &Db) -> Result<Vec<String>> {
    let stuck = db.list_stuck_queued_job_ids()?;
    let timestamp = now_iso();
    for job_id in &stuck {
        match db.get_job(job_id) {
            Ok(mut job) => {
                job.updated_at = timestamp.clone();
                job.stage_detail = Some(
                    "runtime startup requeued stuck queued job for automatic resume".to_string(),
                );
                job.append_log(
                    "WARN: runtime startup found queued job with no driver; requeued for automatic resume",
                );
                job.sync_runtime_state();
                if let Err(error) =
                    persist_job_with_resources(db, &config.data_root, &config.output_root, &job)
                {
                    warn!("runtime startup failed to mark requeued job {job_id}: {error:#}");
                }
            }
            Err(error) => {
                warn!("runtime startup found stuck queued job {job_id} but failed to load it: {error:#}");
            }
        }
        warn!("runtime startup requeued stuck queued job {job_id}");
    }
    if !stuck.is_empty() {
        warn!(
            "runtime startup reconciliation requeued {} stuck queued job(s)",
            stuck.len()
        );
    }
    Ok(stuck)
}

fn committed_render_output_path(db: &Db, job_id: &str) -> Result<Option<String>> {
    let Some(stage) = db.running_pipeline_stage_state(job_id)? else {
        return Ok(None);
    };
    if stage.stage_key != "render" || stage.status != "completed" {
        return Ok(None);
    }
    let units = db.list_pipeline_units(job_id, stage.attempt, "render")?;
    Ok(units.into_iter().rev().find_map(|unit| {
        (unit.unit_key == "output-pdf"
            && unit
                .payload
                .get("unit_kind")
                .and_then(serde_json::Value::as_str)
                == Some("render_output"))
        .then(|| {
            unit.payload
                .get("path")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .flatten()
    }))
}

fn restore_committed_render_output(
    job: &mut crate::models::domain::JobSnapshot,
    committed_output_path: Option<String>,
) -> bool {
    let Some(output_path) = committed_output_path else {
        return false;
    };
    job.artifacts
        .get_or_insert_with(Default::default)
        .output_pdf = Some(output_path);
    render_artifacts_are_ready(job)
}

fn render_artifacts_are_ready(job: &crate::models::domain::JobSnapshot) -> bool {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let outputs = artifacts.render_outputs();
    outputs
        .output_pdf
        .as_deref()
        .map(Path::new)
        .is_some_and(Path::is_file)
        && outputs
            .summary
            .as_deref()
            .map(Path::new)
            .is_some_and(Path::is_file)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{render_artifacts_are_ready, restore_committed_render_output};
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    #[test]
    fn committed_render_recovery_requires_output_and_summary_files() {
        let root = std::env::temp_dir().join(format!(
            "retain-render-recovery-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        fs::create_dir_all(&root).expect("fixture root");
        let output = root.join("output.pdf");
        let summary = root.join("pipeline_summary.json");
        let mut job = JobSnapshot::new(
            "job-1".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        let artifacts = job.artifacts.get_or_insert_with(Default::default);
        artifacts.output_pdf = Some(output.to_string_lossy().into_owned());
        artifacts.summary = Some(summary.to_string_lossy().into_owned());

        fs::write(&output, b"pdf").expect("output");
        assert!(!render_artifacts_are_ready(&job));
        fs::write(&summary, b"{}").expect("summary");
        assert!(render_artifacts_are_ready(&job));

        job.artifacts.as_mut().expect("artifacts").output_pdf = None;
        assert!(restore_committed_render_output(
            &mut job,
            Some(output.to_string_lossy().into_owned())
        ));
        assert_eq!(
            job.artifacts
                .as_ref()
                .and_then(|artifacts| artifacts.output_pdf.as_deref()),
            Some(output.to_string_lossy().as_ref())
        );

        let _ = fs::remove_dir_all(root);
    }
}
