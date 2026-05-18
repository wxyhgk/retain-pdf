use anyhow::Result;

#[cfg(test)]
use crate::models::JobSnapshot;
use crate::models::{job_stage_detail, job_stage_str, JobRuntimeState, JobStage, JobStatusKind};

use crate::job_runner::{clear_job_failure, refresh_job_failure, sync_runtime_state};

pub(super) fn finalize_parent_after_ocr(
    parent_job: &mut JobRuntimeState,
    ocr_finished: &JobRuntimeState,
    timestamp: String,
) -> Result<bool> {
    match ocr_finished.status {
        JobStatusKind::Succeeded => Ok(false),
        JobStatusKind::Canceled => {
            parent_job.status = JobStatusKind::Canceled;
            parent_job.stage = Some(job_stage_str(JobStage::Canceled).to_string());
            parent_job.stage_detail = Some(job_stage_detail(JobStage::Canceled).to_string());
            parent_job.finished_at = Some(timestamp.clone());
            parent_job.updated_at = timestamp;
            clear_job_failure(parent_job);
            sync_runtime_state(parent_job);
            Ok(true)
        }
        _ => {
            parent_job.status = JobStatusKind::Failed;
            parent_job.stage = Some(job_stage_str(JobStage::Failed).to_string());
            parent_job.stage_detail = Some(job_stage_detail(JobStage::Failed).to_string());
            parent_job.error = ocr_finished
                .error
                .clone()
                .or(ocr_finished.stage_detail.clone());
            parent_job.finished_at = Some(timestamp.clone());
            parent_job.updated_at = timestamp;
            refresh_job_failure(parent_job);
            sync_runtime_state(parent_job);
            Ok(true)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateJobInput;

    fn build_job() -> JobRuntimeState {
        JobSnapshot::new(
            "job-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
        .into_runtime()
    }

    #[test]
    fn finalize_parent_after_ocr_keeps_success_running_path() {
        let mut parent = build_job();
        let mut ocr = build_job();
        ocr.status = JobStatusKind::Succeeded;
        let done = finalize_parent_after_ocr(&mut parent, &ocr, "2026-04-04T00:00:00Z".to_string())
            .expect("finalize");
        assert!(!done);
    }

    #[test]
    fn finalize_parent_after_ocr_marks_canceled() {
        let mut parent = build_job();
        let mut ocr = build_job();
        ocr.status = JobStatusKind::Canceled;
        let done = finalize_parent_after_ocr(&mut parent, &ocr, "2026-04-04T00:00:00Z".to_string())
            .expect("finalize");
        assert!(done);
        assert_eq!(parent.status, JobStatusKind::Canceled);
        assert_eq!(parent.stage.as_deref(), Some("canceled"));
    }

    #[test]
    fn finalize_parent_after_ocr_marks_failed_and_copies_error() {
        let mut parent = build_job();
        let mut ocr = build_job();
        ocr.status = JobStatusKind::Failed;
        ocr.error = Some("ocr failed".to_string());
        let done = finalize_parent_after_ocr(&mut parent, &ocr, "2026-04-04T00:00:00Z".to_string())
            .expect("finalize");
        assert!(done);
        assert_eq!(parent.status, JobStatusKind::Failed);
        assert_eq!(parent.error.as_deref(), Some("ocr failed"));
    }
}
