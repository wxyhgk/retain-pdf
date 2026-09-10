use std::path::Path;

use crate::models::domain::{JobSnapshot, JobStatusKind};
use crate::storage_paths::{resolve_markdown_path, resolve_output_pdf};

pub(crate) fn job_readiness(job: &JobSnapshot, data_root: &Path) -> (bool, bool, bool) {
    let pdf_ready = resolve_output_pdf(job, data_root)
        .map(|path| path.exists())
        .unwrap_or(false);
    let markdown_ready = resolve_markdown_path(job, data_root)
        .map(|path| path.exists())
        .unwrap_or(false);
    let bundle_ready = matches!(job.status, JobStatusKind::Succeeded);
    (pdf_ready, markdown_ready, bundle_ready)
}
