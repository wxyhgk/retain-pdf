use anyhow::Result;
use tracing::warn;

use crate::config::AppConfig;
use crate::db::Db;
use crate::job_events::persist_job_with_resources;
use crate::job_runner::{terminate_job_process_tree_blocking, worker_process_exists};
use crate::models::domain::{now_iso, JobFailureInfo, JobStatusKind};

/// Why a `Running`-status job found at startup is being reconciled.
///
/// The pid recorded for a `Running` job is only ever written by us right
/// before spawning that job's worker (and cleared once it finishes), and the
/// worker is placed in its own process group via `setpgid` at spawn time
/// (see `configure_child_process`), so terminating `-pid` only reaches the
/// process(es) that job itself spawned. There's still a theoretical
/// PID-reuse race (the recorded pid could have exited and been recycled by
/// an unrelated process before we get here), but the process-group scoping
/// keeps the blast radius of a false-positive kill limited to that reused
/// pid's own group rather than anything else on the system, and this only
/// runs once at startup against jobs the DB itself says were left running.
enum StaleReason {
    /// No pid was ever recorded for this job.
    NoPid,
    /// The recorded pid is no longer alive.
    Dead(u32),
    /// The recorded pid is still alive: the worker was orphaned by an
    /// unclean shutdown/restart and is left running detached, with nothing
    /// left to consume its stdout or ever mark the job finished.
    Orphaned(u32),
}

pub(super) fn reconcile_stale_running_jobs(config: &AppConfig, db: &Db) -> Result<usize> {
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
                "startup found live orphaned worker process pid={pid} for job {} still running; terminating its process tree before recovering job state",
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
                    "Khi khởi động backend phát hiện tác vụ running còn sót lại, worker process {pid} vẫn đang chạy (tiến trình mồ côi), đã kết thúc tiến trình này"
                ),
                "worker_orphaned_after_restart",
                "worker_orphaned_after_restart",
            ),
            StaleReason::Dead(pid) => (
                format!("Khi khởi động backend phát hiện tác vụ running còn sót lại, nhưng worker process {pid} đã không còn tồn tại"),
                "worker_process_missing",
                "worker_process_missing",
            ),
            StaleReason::NoPid => (
                "Khi khởi động backend phát hiện tác vụ running còn sót lại, nhưng không ghi lại worker pid".to_string(),
                "worker_process_missing",
                "worker_process_missing",
            ),
        };
        let timestamp = now_iso();
        match db.get_job(&job_record.job_id) {
            Ok(mut job) => {
                job.append_log(&format!("ERROR: {detail}"));
                job.status = JobStatusKind::Failed;
                job.stage = Some("failed".to_string());
                job.stage_detail = Some("startup stale running job recovered".to_string());
                job.error = Some(detail.clone());
                job.updated_at = timestamp.clone();
                job.finished_at = Some(timestamp.clone());
                job.pid = None;
                job.sync_runtime_state();
                job.replace_failure_info(Some(JobFailureInfo {
                    stage: "startup_recovery".to_string(),
                    category: failure_category.to_string(),
                    code: None,
                    failed_stage: Some("startup_recovery".to_string()),
                    failure_code: Some(failure_code.to_string()),
                    failure_category: Some("internal".to_string()),
                    provider_stage: None,
                    provider_code: None,
                    summary: "Đã thu hồi tác vụ running còn sót lại khi khởi động backend".to_string(),
                    root_cause: Some(detail.clone()),
                    retryable: true,
                    upstream_host: None,
                    provider: None,
                    suggestion: Some(
                        "Worker tương ứng với tác vụ này đã không còn chạy; vui lòng gửi lại hoặc thử lại thủ công".to_string(),
                    ),
                    last_log_line: Some(detail.clone()),
                    raw_excerpt: Some(detail.clone()),
                    raw_error_excerpt: Some(detail.clone()),
                    raw_diagnostic: None,
                    ai_diagnostic: None,
                }));
                persist_job_with_resources(db, &config.data_root, &config.output_root, &job)?;
            }
            Err(error) => {
                warn!(
                    "startup reconciliation fell back to raw DB recovery for {}: {}",
                    job_record.job_id, error
                );
                db.recover_stale_running_job(&job_record.job_id, &detail, &timestamp)?;
            }
        }
        reconciled += 1;
        warn!(
            "recovered stale running job during startup: {}",
            job_record.job_id
        );
    }
    if reconciled > 0 {
        warn!("startup reconciliation recovered {reconciled} stale running job(s)");
    }
    Ok(reconciled)
}
