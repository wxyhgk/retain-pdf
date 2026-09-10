use super::stage_view::build_job_stage_view;
use crate::error::AppError;
use crate::models::api::{build_job_actions, build_job_links_with_workflow, JobSubmissionView};
use crate::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
pub(crate) fn build_submission_view(
    job: &JobSnapshot,
    status: JobStatusKind,
    workflow: WorkflowKind,
    base_url: &str,
) -> JobSubmissionView {
    let mut view_job = job.clone();
    view_job.workflow = workflow.clone();
    let source_artifact_job_id = job
        .request_payload
        .source
        .artifact_job_id
        .trim()
        .to_string();
    let ocr_reused = !source_artifact_job_id.is_empty();
    JobSubmissionView {
        job_id: job.job_id.clone(),
        status,
        workflow: workflow.clone(),
        ocr_reused,
        source_artifact_job_id: ocr_reused.then_some(source_artifact_job_id),
        stages: build_job_stage_view(&view_job, None).stages,
        links: build_job_links_with_workflow(&job.job_id, &workflow, base_url),
        actions: build_job_actions(&view_job, base_url, false, false, false),
    }
}

pub(crate) fn ensure_cancelable(job: &JobSnapshot) -> Result<(), AppError> {
    if !matches!(job.status, JobStatusKind::Queued | JobStatusKind::Running) {
        return Err(AppError::conflict(format!(
            "job is not cancelable in status {:?}",
            job.status
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::domain::JobSnapshot;
    use crate::models::request::CreateJobInput;

    fn build_job() -> JobSnapshot {
        JobSnapshot::new(
            "jobs-support-test".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        )
    }

    #[test]
    fn ensure_cancelable_rejects_succeeded_jobs() {
        let mut job = build_job();
        job.status = JobStatusKind::Succeeded;

        let err = ensure_cancelable(&job).expect_err("should reject succeeded job");
        assert!(err.to_string().contains("not cancelable"));
    }

    #[test]
    fn submission_view_uses_declared_workflow_for_contract_links() {
        let job = build_job();

        let view = build_submission_view(
            &job,
            JobStatusKind::Queued,
            WorkflowKind::Ocr,
            "https://api.example",
        );

        assert_eq!(view.workflow, WorkflowKind::Ocr);
        assert_eq!(view.links.self_path, "/api/v1/ocr/jobs/jobs-support-test");
        assert_eq!(
            view.actions.open_job.path,
            "/api/v1/ocr/jobs/jobs-support-test"
        );
        assert!(view.actions.cancel.enabled);
    }
}
