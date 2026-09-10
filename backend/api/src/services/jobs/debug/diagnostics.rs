use std::path::Path;

use crate::error::AppError;
use crate::models::api::{redact_json_value, sensitive_values, TranslationDiagnosticsView};
use crate::models::domain::JobSnapshot;
use crate::storage_paths::resolve_translation_diagnostics;

use super::common::read_json_value;

pub(crate) fn load_translation_diagnostics_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<TranslationDiagnosticsView, AppError> {
    let path = resolve_translation_diagnostics(job, data_root).ok_or_else(|| {
        AppError::not_found(format!("translation diagnostics not found: {}", job.job_id))
    })?;
    let secrets = sensitive_values(&job.request_payload);
    let summary = redact_json_value(&read_json_value(&path)?, &secrets);
    Ok(TranslationDiagnosticsView {
        job_id: job.job_id.clone(),
        summary,
    })
}
