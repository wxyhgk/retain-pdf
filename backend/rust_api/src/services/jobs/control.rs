use std::time::{Duration, Instant};

use crate::db::Db;
use crate::error::AppError;
use crate::job_events::persist_job_with_resources;
use crate::models::domain::{now_iso, JobSnapshot, JobStatusKind, WorkflowKind};
use crate::services::runtime_gateway::terminate_runtime_process;

use super::creation::context::ControlDeps;
use super::query::load_job_or_404;

pub async fn wait_for_terminal_job(
    db: &Db,
    job_id: &str,
    timeout_seconds: i64,
    wait_interval_ms: u64,
) -> Result<JobSnapshot, AppError> {
    let timeout_seconds = if timeout_seconds > 0 {
        timeout_seconds as u64
    } else {
        1800
    };
    let started = Instant::now();
    loop {
        let job = load_job_or_404(db, job_id)?;
        match job.status {
            JobStatusKind::Succeeded => return Ok(job),
            JobStatusKind::Failed => {
                let detail = job
                    .error
                    .clone()
                    .or(job.stage_detail.clone())
                    .unwrap_or_else(|| "job failed".to_string());
                return Err(AppError::internal(format!("job failed: {detail}")));
            }
            JobStatusKind::Canceled => {
                let detail = job
                    .stage_detail
                    .clone()
                    .unwrap_or_else(|| "job was canceled".to_string());
                return Err(AppError::conflict(detail));
            }
            JobStatusKind::Queued | JobStatusKind::Running => {}
        }
        if started.elapsed() >= Duration::from_secs(timeout_seconds) {
            return Err(AppError::conflict(format!(
                "job did not finish within timeout: {}s (job_id={job_id})",
                timeout_seconds
            )));
        }
        tokio::time::sleep(Duration::from_millis(wait_interval_ms)).await;
    }
}

pub(crate) async fn cancel_job(
    deps: &ControlDeps<'_>,
    job_id: &str,
    ocr_only: bool,
) -> Result<JobSnapshot, AppError> {
    let mut job = load_job_or_404(deps.db, job_id)?;
    if ocr_only && !matches!(job.workflow, WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    deps.runtime.request_cancel(job_id).await;

    // The job may have raced to a terminal state between the status check
    // above and the cancel-registry insert (e.g. its runner already finished
    // and exited on its own). No runner will ever consume the cancel flag we
    // just inserted in that case, so clear it immediately instead of leaving
    // an orphaned entry in the in-memory registry.
    job = load_job_or_404(deps.db, job_id)?;
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        deps.runtime.clear_cancel(job_id).await;
        return Ok(job);
    }

    if !ocr_only || !matches!(job.stage.as_deref(), Some("normalizing")) {
        if let Some(pid) = job.pid {
            terminate_runtime_process(pid, deps.job_runner).await?;
        }
    }
    if ocr_only {
        if matches!(job.stage.as_deref(), Some("queued")) {
            job.status = JobStatusKind::Canceled;
            job.stage = Some("canceled".to_string());
            job.stage_detail = Some("Tác vụ OCR đã hủy".to_string());
            job.updated_at = now_iso();
            job.finished_at = Some(now_iso());
            job.pid = None;
            job.sync_runtime_state();
            job.replace_failure_info(None);
            persist_job_with_resources(deps.db, deps.data_root, deps.output_root, &job)?;
        }
        return Ok(job);
    }
    job.status = JobStatusKind::Canceled;
    job.stage = Some("canceled".to_string());
    job.stage_detail = Some("Tác vụ đã hủy".to_string());
    job.updated_at = now_iso();
    job.finished_at = Some(now_iso());
    job.pid = None;
    job.sync_runtime_state();
    job.replace_failure_info(None);
    persist_job_with_resources(deps.db, deps.data_root, deps.output_root, &job)?;
    Ok(job)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use tokio::sync::RwLock;

    use crate::models::domain::{CreateJobInput, WorkflowKind};

    use super::*;

    fn test_db(test_name: &str) -> (Db, std::path::PathBuf) {
        let root = std::env::temp_dir().join(format!(
            "rust-api-control-{test_name}-{}",
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        std::fs::create_dir_all(&data_root).expect("create data root");
        let db = Db::new(data_root.join("db").join("jobs.db"), data_root.clone());
        (db, data_root)
    }

    fn seed_job(db: &Db, job_id: &str, status: JobStatusKind) {
        let mut input = CreateJobInput::default();
        input.workflow = WorkflowKind::Ocr;
        input.runtime.job_id = job_id.to_string();
        let mut job = JobSnapshot::new(job_id.to_string(), input, vec!["noop".to_string()]);
        job.status = status;
        db.save_job(&job).expect("seed job");
    }

    // Regression test for the cancel-registry leak: if the job races to a
    // terminal state (its runner finishes and exits on its own) between the
    // initial "is this job cancelable" check and the moment the cancel flag
    // is recorded, no runner is left alive to ever consume/clear that flag.
    // cancel_job must detect this and clear the entry itself instead of
    // leaving it to accumulate in the in-memory registry forever.
    #[tokio::test]
    async fn cancel_job_clears_registry_entry_when_job_finishes_during_the_race() {
        let job_id = "race-job";
        let (db, data_root) = test_db("cancel-race");
        seed_job(&db, job_id, JobStatusKind::Running);

        let output_root = data_root.join("jobs");
        let job_runner = crate::config::JobRunnerConfig::default();
        let canceled_jobs: RwLock<HashSet<String>> = RwLock::new(HashSet::new());

        let deps = ControlDeps::new(
            &db,
            &job_runner,
            &data_root,
            &output_root,
            &canceled_jobs,
        );

        // Hold the registry write lock so that cancel_job's
        // `deps.runtime.request_cancel(job_id).await` call is forced to
        // genuinely suspend right where the real race window is: after the
        // initial Queued/Running check has passed but before the cancel flag
        // is actually recorded.
        let guard = canceled_jobs.write().await;

        let cancel_fut = cancel_job(&deps, job_id, false);
        let racer_fut = async {
            // Simulate the job's runner completing and persisting a terminal
            // status while cancel_job is stuck waiting for the lock we hold.
            let mut finished = db.get_job(job_id).expect("load job");
            finished.status = JobStatusKind::Succeeded;
            finished.finished_at = Some(now_iso());
            db.save_job(&finished).expect("persist finished job");
            drop(guard);
        };

        let (result, _) = tokio::join!(cancel_fut, racer_fut);
        let job = result.expect("cancel_job should not error on a raced-to-terminal job");

        assert_eq!(
            job.status,
            JobStatusKind::Succeeded,
            "a job that already finished must not be clobbered back to Canceled"
        );
        assert!(
            !canceled_jobs.read().await.contains(job_id),
            "the cancel-registry entry must not leak once the job is known to be terminal"
        );
    }
}
