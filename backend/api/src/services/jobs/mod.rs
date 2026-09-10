mod control;
mod creation;
mod debug;
mod downloads;
mod deps;
mod facade;
pub(super) mod live_stage;
mod live_translation;
mod presentation;
mod query;
mod reader_ai;
mod reader_regions;
mod readiness;
mod stage_plan;
pub(crate) mod stage_view;
pub(super) mod summary_loaders;
mod support;
pub(crate) mod translation_request_recovery;

pub use control::wait_for_terminal_job;
pub(crate) use deps::{
    CommandJobsDeps, ControlDeps, JobSubmitDeps, QueryJobsDeps, ReplayDeps, SnapshotBuildDeps,
};
pub(crate) use downloads::{DocumentDownloadKind, FileDownload, MarkdownDownload};
pub(crate) use facade::build_jobs_facade;
pub use facade::JobsFacade;
pub(crate) use readiness::job_readiness;

pub use crate::services::job_validation::{
    validate_mineru_upload_limits, validate_ocr_provider_request, validate_provider_credentials,
};
