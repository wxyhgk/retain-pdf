use std::path::{Path, PathBuf};

use crate::models::{JobSnapshot, JobStatusKind};

mod control;
mod creation;
mod debug;
mod downloads;
mod facade;
pub(crate) mod presentation;
mod query;
mod reader_regions;
mod support;

pub use control::wait_for_terminal_job;
pub(crate) use creation::context::{
    CommandJobsDeps, ControlDeps, JobSubmitDeps, QueryJobsDeps, ReplayDeps, SnapshotBuildDeps,
    UploadStoreDeps,
};
pub(crate) use creation::{store_pdf_upload, UploadedPdfInput};
pub(crate) use downloads::{FileDownload, MarkdownDownload};
pub(crate) use facade::build_jobs_facade;
pub use facade::JobsFacade;

pub use crate::services::job_validation::{
    validate_mineru_upload_limits, validate_ocr_provider_request, validate_provider_credentials,
};

pub fn readiness(
    job: &JobSnapshot,
    data_root: &Path,
    resolve_output_pdf: impl Fn(&JobSnapshot, &Path) -> Option<PathBuf>,
    resolve_markdown_path: impl Fn(&JobSnapshot, &Path) -> Option<PathBuf>,
) -> (bool, bool, bool) {
    let pdf_ready = resolve_output_pdf(job, data_root)
        .map(|p: PathBuf| p.exists())
        .unwrap_or(false);
    let markdown_ready = resolve_markdown_path(job, data_root)
        .map(|p: PathBuf| p.exists())
        .unwrap_or(false);
    let bundle_ready = matches!(job.status, JobStatusKind::Succeeded);
    (pdf_ready, markdown_ready, bundle_ready)
}
