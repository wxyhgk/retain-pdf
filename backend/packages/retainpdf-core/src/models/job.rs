#[path = "job/artifacts.rs"]
mod artifacts;
#[path = "job/failure.rs"]
mod failure;
#[path = "job/lifecycle.rs"]
mod lifecycle;
#[path = "job/process.rs"]
mod process;
#[path = "job/questions.rs"]
mod questions;
#[path = "job/record.rs"]
mod record;
#[path = "job/runtime.rs"]
mod runtime;
#[path = "job/stage.rs"]
mod stage;

pub use artifacts::{
    JobArtifactRecord, JobArtifacts, OcrCheckpointArtifacts, RenderArtifacts, TranslationArtifacts,
};
pub use failure::{JobAiDiagnostic, JobFailureInfo, JobFailureUpstream, JobRawDiagnostic};
pub use process::{stored_output_tail, ProcessResult, STORED_OUTPUT_TAIL_BYTES};
pub use record::{JobRecord, JobRuntimeState, JobSnapshot};
pub use runtime::{JobRuntimeInfo, JobStageTiming};
pub use stage::{
    event_progress_unit, job_progress_unit, job_stage_detail, job_stage_rank, job_stage_str,
    job_user_stage, normalize_event_substage, normalize_event_user_stage, normalize_job_stage,
    public_stage_for_raw_stage, public_stage_for_substage, JobStage,
};

#[cfg(test)]
#[path = "job/tests.rs"]
mod tests;
