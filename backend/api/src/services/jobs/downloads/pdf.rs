use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::models::domain::JobSnapshot;
use crate::services::derived_artifacts;

use super::QueryJobsDeps;

pub(super) fn linearized_pdf_or_original(
    deps: &QueryJobsDeps<'_>,
    job: &JobSnapshot,
    input_pdf: &Path,
    label: &str,
) -> Result<PathBuf, AppError> {
    derived_artifacts::pdf::linearized_pdf_or_original(deps.data_root, job, input_pdf, label)
}
