use crate::models::api::{
    JobProgressView, JobStageRuntimeView, JobStageSnapshotView, JobStageStateView, JobStagesView,
};
use crate::models::domain::{public_stage_for_raw_stage, JobSnapshot, JobStatusKind, WorkflowKind};

use super::live_stage::LiveStageSnapshot;

#[derive(Debug)]
pub(crate) struct JobStageViewProjection {
    pub(crate) stage: Option<String>,
    pub(crate) stage_detail: Option<String>,
    pub(crate) progress: JobProgressView,
    pub(crate) stage_snapshot: Option<JobStageSnapshotView>,
    pub(crate) background_snapshots: Vec<JobStageSnapshotView>,
    pub(crate) stages: JobStagesView,
}

pub(crate) fn build_job_stage_view(
    job: &JobSnapshot,
    live_stage: Option<&LiveStageSnapshot>,
) -> JobStageViewProjection {
    let stage = live_stage
        .and_then(|snapshot| snapshot.stage.clone())
        .or_else(|| job.stage.clone());
    let display_stage = live_stage
        .and_then(|snapshot| snapshot.display_stage.clone())
        .or_else(|| public_stage_for_raw_stage(stage.as_deref()).map(str::to_string));
    let substage = live_stage.and_then(|snapshot| snapshot.substage.clone());
    let lane = live_stage
        .and_then(|snapshot| snapshot.lane.clone())
        .or_else(|| Some("main".to_string()));
    let stage_detail = live_stage
        .and_then(|snapshot| snapshot.stage_detail.clone())
        .or_else(|| job.stage_detail.clone());
    let progress = build_progress_view(job, live_stage);
    let background_snapshots: Vec<JobStageSnapshotView> = live_stage
        .map(|snapshot| {
            snapshot
                .background_stages
                .iter()
                .filter(|snapshot| snapshot.display_stage.as_deref() != Some("done"))
                .map(stage_snapshot_view)
                .collect()
        })
        .unwrap_or_default();
    let public_snapshot = build_public_stage_snapshot(
        job,
        display_stage.clone(),
        stage.clone(),
        substage.clone(),
        lane.clone(),
        stage_detail.clone(),
        progress.clone(),
    );
    let stages = build_stages_view(
        job,
        public_snapshot.as_ref(),
        &background_snapshots,
        &progress,
    );
    JobStageViewProjection {
        stage,
        stage_detail,
        progress,
        stage_snapshot: public_snapshot,
        background_snapshots,
        stages,
    }
}

pub(crate) fn build_progress_view(
    job: &JobSnapshot,
    live_stage: Option<&LiveStageSnapshot>,
) -> JobProgressView {
    let current = live_stage
        .and_then(|snapshot| snapshot.progress_current)
        .or(job.progress_current);
    let total = live_stage
        .and_then(|snapshot| snapshot.progress_total)
        .or(job.progress_total);
    JobProgressView {
        current,
        total,
        percent: match (current, total) {
            (Some(current), Some(total)) if total > 0 => {
                Some((current as f64 / total as f64) * 100.0)
            }
            _ => None,
        },
        unit: live_stage.and_then(|snapshot| snapshot.progress_unit.clone()),
    }
}

fn stage_snapshot_view(snapshot: &LiveStageSnapshot) -> JobStageSnapshotView {
    JobStageSnapshotView {
        display_stage: snapshot.display_stage.clone(),
        stage: snapshot.stage.clone(),
        substage: snapshot.substage.clone(),
        lane: snapshot.lane.clone(),
        stage_detail: snapshot.stage_detail.clone(),
        progress: JobProgressView {
            current: snapshot.progress_current,
            total: snapshot.progress_total,
            percent: match (snapshot.progress_current, snapshot.progress_total) {
                (Some(current), Some(total)) if total > 0 => {
                    Some((current as f64 / total as f64) * 100.0)
                }
                _ => None,
            },
            unit: snapshot.progress_unit.clone(),
        },
    }
}

fn build_public_stage_snapshot(
    job: &JobSnapshot,
    display_stage: Option<String>,
    stage: Option<String>,
    substage: Option<String>,
    lane: Option<String>,
    stage_detail: Option<String>,
    progress: JobProgressView,
) -> Option<JobStageSnapshotView> {
    if is_terminal_status(&job.status) {
        return None;
    }
    let display_stage = display_stage.filter(|stage| stage.as_str() != "done")?;
    Some(JobStageSnapshotView {
        display_stage: Some(display_stage),
        stage,
        substage,
        lane,
        stage_detail,
        progress,
    })
}

fn build_stages_view(
    job: &JobSnapshot,
    stage_snapshot: Option<&JobStageSnapshotView>,
    background_snapshots: &[JobStageSnapshotView],
    fallback_progress: &JobProgressView,
) -> JobStagesView {
    JobStagesView {
        ocr: stage_runtime(
            "ocr",
            job,
            stage_snapshot,
            background_snapshots,
            fallback_progress,
        ),
        translation: stage_runtime(
            "translation",
            job,
            stage_snapshot,
            background_snapshots,
            fallback_progress,
        ),
        render: stage_runtime(
            "render",
            job,
            stage_snapshot,
            background_snapshots,
            fallback_progress,
        ),
    }
}

fn stage_runtime(
    stage_name: &str,
    job: &JobSnapshot,
    stage_snapshot: Option<&JobStageSnapshotView>,
    background_snapshots: &[JobStageSnapshotView],
    fallback_progress: &JobProgressView,
) -> JobStageRuntimeView {
    let progress = stage_progress(stage_name, stage_snapshot, background_snapshots)
        .unwrap_or_else(|| empty_progress_for_stage(stage_name, stage_snapshot, fallback_progress));
    JobStageRuntimeView {
        state: stage_state(stage_name, job, stage_snapshot),
        progress,
    }
}

fn stage_state(
    stage_name: &str,
    job: &JobSnapshot,
    stage_snapshot: Option<&JobStageSnapshotView>,
) -> JobStageStateView {
    if stage_name == "ocr" && !job.request_payload.source.artifact_job_id.trim().is_empty() {
        return JobStageStateView::Reused;
    }
    if !workflow_includes_stage(job, stage_name) {
        return JobStageStateView::Skipped;
    }
    if stage_name == "translation"
        && matches!(job.status, JobStatusKind::Queued)
        && !job.request_payload.source.artifact_job_id.trim().is_empty()
    {
        return JobStageStateView::Queued;
    }
    if matches!(
        stage_snapshot.and_then(|snapshot| snapshot.display_stage.as_deref()),
        Some(active) if active == stage_name
    ) {
        return JobStageStateView::InProgress;
    }
    if matches!(job.status, JobStatusKind::Failed) {
        let failed_stage = failed_public_stage(job).unwrap_or(stage_name);
        if failed_stage == stage_name {
            return JobStageStateView::Failed;
        }
    }
    if is_terminal_status(&job.status) {
        return match job.status {
            JobStatusKind::Succeeded => JobStageStateView::Completed,
            JobStatusKind::Canceled | JobStatusKind::Failed => {
                let failed_stage = failed_public_stage(job).unwrap_or(stage_name);
                if failed_stage == stage_name {
                    JobStageStateView::Failed
                } else if stage_precedes(stage_name, failed_stage) {
                    JobStageStateView::Completed
                } else {
                    JobStageStateView::Pending
                }
            }
            _ => JobStageStateView::Pending,
        };
    }
    if let Some(active_stage) =
        stage_snapshot.and_then(|snapshot| snapshot.display_stage.as_deref())
    {
        if stage_precedes(stage_name, active_stage) {
            JobStageStateView::Completed
        } else {
            JobStageStateView::Pending
        }
    } else {
        JobStageStateView::Pending
    }
}

fn stage_progress(
    stage_name: &str,
    stage_snapshot: Option<&JobStageSnapshotView>,
    background_snapshots: &[JobStageSnapshotView],
) -> Option<JobProgressView> {
    stage_snapshot
        .filter(|snapshot| snapshot.display_stage.as_deref() == Some(stage_name))
        .map(|snapshot| snapshot.progress.clone())
        .or_else(|| {
            background_snapshots
                .iter()
                .rev()
                .find(|snapshot| snapshot.display_stage.as_deref() == Some(stage_name))
                .map(|snapshot| snapshot.progress.clone())
        })
}

fn empty_progress_for_stage(
    stage_name: &str,
    stage_snapshot: Option<&JobStageSnapshotView>,
    fallback_progress: &JobProgressView,
) -> JobProgressView {
    if stage_snapshot
        .and_then(|snapshot| snapshot.display_stage.as_deref())
        .is_none()
        && fallback_progress.current.is_some()
        && public_stage_for_raw_stage(Some(stage_name)) == Some(stage_name)
    {
        return fallback_progress.clone();
    }
    JobProgressView {
        current: None,
        total: None,
        percent: None,
        unit: None,
    }
}

fn workflow_includes_stage(job: &JobSnapshot, stage_name: &str) -> bool {
    match &job.workflow {
        WorkflowKind::Book => matches!(stage_name, "ocr" | "translation" | "render"),
        WorkflowKind::Translate => {
            matches!(stage_name, "ocr" | "translation")
                || (stage_name == "render" && job.request_payload.runtime.render_after_translation)
        }
        WorkflowKind::Render => stage_name == "render",
        WorkflowKind::Ocr => stage_name == "ocr",
    }
}

fn failed_public_stage(job: &JobSnapshot) -> Option<&'static str> {
    job.failure
        .as_ref()
        .and_then(|failure| normalize_public_stage(failure.failed_stage_value()))
        .or_else(|| public_stage_for_raw_stage(job.stage.as_deref()))
}

fn normalize_public_stage(stage: &str) -> Option<&'static str> {
    match stage.trim() {
        "ocr" => Some("ocr"),
        "translation" => Some("translation"),
        "render" => Some("render"),
        raw_stage => public_stage_for_raw_stage(Some(raw_stage)),
    }
}

fn stage_precedes(left: &str, right: &str) -> bool {
    stage_order(left) < stage_order(right)
}

fn stage_order(stage_name: &str) -> i32 {
    match stage_name {
        "ocr" => 1,
        "translation" => 2,
        "render" => 3,
        _ => 0,
    }
}

fn is_terminal_status(status: &JobStatusKind) -> bool {
    matches!(
        status,
        JobStatusKind::Succeeded | JobStatusKind::Failed | JobStatusKind::Canceled
    )
}

#[cfg(test)]
mod tests {
    use super::build_job_stage_view;
    use crate::models::api::JobStageStateView;
    use crate::models::domain::{CreateJobInput, JobFailureInfo, JobSnapshot, JobStatusKind};

    #[test]
    fn canonical_translation_failure_keeps_completed_ocr_and_pending_render() {
        let mut job = JobSnapshot::new(
            "book-failed-after-ocr".to_string(),
            CreateJobInput::default(),
            vec!["translate".to_string()],
        );
        job.status = JobStatusKind::Failed;
        job.stage = Some("failed".to_string());
        job.failure = Some(JobFailureInfo {
            stage: "translation".to_string(),
            failed_stage: Some("translation".to_string()),
            ..JobFailureInfo::default()
        });

        let stages = build_job_stage_view(&job, None).stages;

        assert_eq!(stages.ocr.state, JobStageStateView::Completed);
        assert_eq!(stages.translation.state, JobStageStateView::Failed);
        assert_eq!(stages.render.state, JobStageStateView::Pending);
    }
}
