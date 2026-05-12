#[path = "job/artifacts.rs"]
mod artifacts;
#[path = "job/failure.rs"]
mod failure;
#[path = "job/lifecycle.rs"]
mod lifecycle;
#[path = "job/process.rs"]
mod process;
#[path = "job/record.rs"]
mod record;
#[path = "job/stage.rs"]
mod stage;
#[path = "job/runtime.rs"]
mod runtime;

pub use artifacts::{
    JobArtifactRecord, JobArtifacts, OcrCheckpointArtifacts, RenderArtifacts, TranslationArtifacts,
};
pub use failure::{JobAiDiagnostic, JobFailureInfo, JobRawDiagnostic};
pub use process::ProcessResult;
pub use record::{JobRecord, JobRuntimeState, JobSnapshot};
pub use stage::{job_stage_detail, job_stage_str, normalize_job_stage, JobStage};
pub use runtime::{JobRuntimeInfo, JobStageTiming};

#[cfg(test)]
mod tests {
    use crate::models::{CreateJobInput, JobSnapshot, JobStatusKind};

    #[test]
    fn sync_runtime_state_tracks_stage_history_and_elapsed() {
        let mut job = JobSnapshot::new(
            "job-runtime-metrics".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.started_at = Some("2026-04-04T00:00:00Z".to_string());
        job.updated_at = "2026-04-04T00:00:05Z".to_string();
        job.stage = Some("running".to_string());
        job.stage_detail = Some("正在运行".to_string());
        job.sync_runtime_state();

        job.updated_at = "2026-04-04T00:00:12Z".to_string();
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some("正在渲染".to_string());
        job.sync_runtime_state();

        job.updated_at = "2026-04-04T00:00:20Z".to_string();
        job.finished_at = Some("2026-04-04T00:00:20Z".to_string());
        job.status = JobStatusKind::Succeeded;
        job.sync_runtime_state();

        let runtime = job.runtime.as_ref().expect("runtime");
        assert_eq!(runtime.stage_history.len(), 3);
        assert_eq!(runtime.total_elapsed_ms, Some(20_000));
        assert_eq!(runtime.retry_count, 0);
        assert_eq!(runtime.stage_history[0].stage, "queued");
        assert_eq!(runtime.stage_history[1].duration_ms, Some(7_000));
        assert_eq!(
            runtime
                .stage_history
                .last()
                .and_then(|item| item.duration_ms),
            Some(8_000)
        );
    }

    #[test]
    fn register_retry_updates_runtime_retry_counters() {
        let mut job = JobSnapshot::new(
            "job-runtime-retry".to_string(),
            CreateJobInput::default(),
            vec!["python".to_string()],
        );
        job.updated_at = "2026-04-04T00:00:10Z".to_string();
        job.register_retry();
        job.register_retry();

        let runtime = job.runtime.as_ref().expect("runtime");
        assert_eq!(runtime.retry_count, 2);
        assert_eq!(
            runtime.last_retry_at.as_deref(),
            Some("2026-04-04T00:00:10Z")
        );
    }
}
