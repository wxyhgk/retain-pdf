use crate::views::{
    JobProgressView, JobStageRuntimeView, JobStageSnapshotView, JobStageStateView, JobStagesView,
};
use retainpdf_core::models::domain::{public_stage_for_raw_stage, JobSnapshot, JobStatusKind, WorkflowKind};

use crate::progress::live_stage::LiveStageSnapshot;

#[derive(Debug)]
pub struct JobStageViewProjection {
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    pub stage_snapshot: Option<JobStageSnapshotView>,
    pub background_snapshots: Vec<JobStageSnapshotView>,
    pub stages: JobStagesView,
}

pub fn build_job_stage_view(
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
    if stage_name == "ocr" && job.source_job_id().is_some() {
        return JobStageStateView::Reused;
    }
    if !workflow_includes_stage(job, stage_name) {
        return JobStageStateView::Skipped;
    }
    if stage_name == "translation"
        && matches!(job.status, JobStatusKind::Queued)
        && job.source_job_id().is_some()
    {
        return JobStageStateView::Queued;
    }
    if matches!(
        stage_snapshot.and_then(|snapshot| snapshot.display_stage.as_deref()),
        Some(active) if active == stage_name
    ) {
        return JobStageStateView::InProgress;
    }
    if stage_name == "ocr" {
        if let Some(state) = ocr_child_state(job) {
            return state;
        }
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

/// OCR 交给子任务（`<任务>-ocr`）跑的任务：OCR 这一站照子任务的状态（父任务 artifacts 里的 `ocr_status` 是它的镜像），
/// 不按阶段先后推。OCR 和翻译并行时（GLM-OCR）翻译早早开始，按先后推出来的「OCR 已完成」是假的：子任务还在跑，
/// 或者已经失败、被取消。前端拿它挑可复用的 OCR，挑中了再被复用校验拒掉（OCR_JOB_NOT_SUCCEEDED，2026-11-02）。
/// 没有镜像（没有子任务，或者早年丢了镜像的任务）时返回 None，照旧按先后推。
fn ocr_child_state(job: &JobSnapshot) -> Option<JobStageStateView> {
    let artifacts = job.artifacts.as_ref()?;
    artifacts.ocr_job_id.as_ref()?;
    let child = artifacts.ocr_status.as_ref()?;
    if matches!(job.status, JobStatusKind::Succeeded) {
        return Some(JobStageStateView::Completed);
    }
    let parent_ended = is_terminal_status(&job.status);
    Some(match child {
        JobStatusKind::Succeeded => JobStageStateView::Completed,
        JobStatusKind::Failed | JobStatusKind::Canceled => JobStageStateView::Failed,
        // 父任务已经结束，子任务的镜像还停在没跑完：OCR 没有做完（重启、取消时子任务跟着停了）。
        _ if parent_ended => JobStageStateView::Failed,
        JobStatusKind::Queued => JobStageStateView::Queued,
        _ => JobStageStateView::InProgress,
    })
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
                || (stage_name == "render" && job.renders_after_translation())
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

/// 终态任务的完成说明。只在后端确实写了额外信息时返回 Some。
///
/// completion.rs 先无条件写「任务完成」，completion_pipeline.rs 只有在存在
/// 保留原文/死信块时才把它覆盖成带数量的警告；所以"等于任务完成"就等价于
/// "没有额外信息"，过滤掉可以让前端仅凭该字段是否存在来决定要不要提示。
pub fn terminal_completion_note(job: &JobSnapshot) -> Option<String> {
    if !is_terminal_status(&job.status) {
        return None;
    }
    let detail = job.stage_detail.as_deref()?.trim();
    if detail.is_empty() || detail == "任务完成" {
        return None;
    }
    Some(detail.to_string())
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
    use crate::views::JobStageStateView;
    use retainpdf_core::models::domain::{CreateJobInput, JobArtifacts, JobFailureInfo, JobSnapshot, JobStatusKind};

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

    fn book_with_ocr_child(status: JobStatusKind, child: JobStatusKind) -> JobSnapshot {
        let mut job = JobSnapshot::new("book-1".to_string(), CreateJobInput::default(), vec!["translate".to_string()]);
        let failed = matches!(status, JobStatusKind::Failed);
        job.status = status;
        job.artifacts = Some(JobArtifacts {
            ocr_job_id: Some("book-1-ocr".to_string()),
            ocr_status: Some(child),
            ..JobArtifacts::default()
        });
        if failed {
            job.stage = Some("failed".to_string());
            job.failure = Some(JobFailureInfo {
                stage: "translation".to_string(),
                failed_stage: Some("translation".to_string()),
                ..JobFailureInfo::default()
            });
        } else {
            job.stage = Some("translating".to_string());
        }
        job
    }

    /// OCR 和翻译并行：翻译阶段失败、OCR 子任务也没做完，OCR 这一站不能显示「已完成」（任务 20261101163329-a6d49e）。
    #[test]
    fn ocr_with_a_child_job_follows_the_child_not_the_stage_order() {
        let state = |status, child| build_job_stage_view(&book_with_ocr_child(status, child), None).stages.ocr.state;
        assert_eq!(state(JobStatusKind::Failed, JobStatusKind::Failed), JobStageStateView::Failed);
        assert_eq!(state(JobStatusKind::Failed, JobStatusKind::Canceled), JobStageStateView::Failed);
        // 镜像还停在「运行中」，父任务已经失败：OCR 没有做完。
        assert_eq!(state(JobStatusKind::Failed, JobStatusKind::Running), JobStageStateView::Failed);
        // OCR 子任务做完以后翻译才失败：OCR 照旧算完成，可以复用。
        assert_eq!(state(JobStatusKind::Failed, JobStatusKind::Succeeded), JobStageStateView::Completed);
        // 翻译跟着 OCR 跑，OCR 还没做完。
        assert_eq!(state(JobStatusKind::Running, JobStatusKind::Running), JobStageStateView::InProgress);
        assert_eq!(state(JobStatusKind::Running, JobStatusKind::Succeeded), JobStageStateView::Completed);
        assert_eq!(state(JobStatusKind::Succeeded, JobStatusKind::Running), JobStageStateView::Completed);
    }
}
