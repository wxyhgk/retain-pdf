use serde_json::json;

use crate::models::api::{
    build_job_actions, build_job_links_with_workflow, AmbiguousRequestPolicy, RetryStageKind,
    RetryStageSubmissionView, StageActionsView, StageRetryActionLinkView, StageRetryActionView,
};
use crate::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use crate::services::jobs::stage_plan::{stage_name, stage_plans, JobStagePlan};

pub(super) fn build_stage_actions_view(
    base_url: &str,
    job: &JobSnapshot,
    data_root: &Path,
) -> StageActionsView {
    StageActionsView {
        job_id: job.job_id.clone(),
        stages: stage_plans(job, data_root)
            .into_iter()
            .map(|plan| build_stage_action(base_url, job, plan))
            .collect(),
    }
}

pub(super) fn build_retry_stage_submission_view(
    base_url: &str,
    source_job_id: &str,
    job: &JobSnapshot,
    stage: RetryStageKind,
    reused_artifacts: Vec<String>,
    rerun_stages: Vec<String>,
    workflow: WorkflowKind,
    ambiguous_request_policy: AmbiguousRequestPolicy,
) -> RetryStageSubmissionView {
    let mut view_job = job.clone();
    view_job.workflow = workflow.clone();
    RetryStageSubmissionView {
        job_id: job.job_id.clone(),
        source_job_id: source_job_id.to_string(),
        status: JobStatusKind::Queued,
        workflow: workflow.clone(),
        rerun_from_stage: stage,
        reused_artifacts,
        rerun_stages,
        ambiguous_request_policy,
        links: build_job_links_with_workflow(&job.job_id, &workflow, base_url),
        actions: build_job_actions(&view_job, base_url, false, false, false),
    }
}

fn build_stage_action(
    base_url: &str,
    job: &JobSnapshot,
    plan: JobStagePlan,
) -> StageRetryActionView {
    let action = plan.can_retry.then(|| StageRetryActionLinkView {
        method: "POST".to_string(),
        url: absolute_url(
            base_url,
            &format!("/api/v1/jobs/{}/retry-stage", job.job_id),
        ),
        body: json!({
            "stage": stage_name(&plan.stage),
            "ambiguous_request_policy": "block"
        }),
    });
    StageRetryActionView {
        stage: plan.stage,
        label: plan.label,
        can_retry: plan.can_retry,
        reason: plan.disabled_reason.clone(),
        disabled_reason: plan.disabled_reason,
        action,
        will_reuse: plan.will_reuse,
        will_rerun: plan.will_rerun,
        danger: plan.danger,
    }
}

fn absolute_url(base_url: &str, path: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), path)
}
use std::path::Path;
