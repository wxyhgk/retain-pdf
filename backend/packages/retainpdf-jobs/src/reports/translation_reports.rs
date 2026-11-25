use std::path::Path;

use retainpdf_api_base::error::AppError;
use retainpdf_core::models::api::{redact_json_value, sensitive_values};
use crate::views::TranslationDiagnosticsView;
use retainpdf_core::models::domain::JobSnapshot;
use retainpdf_core::storage_paths::resolve_translation_diagnostics;

use crate::translations::common::read_json_value;

pub(crate) fn load_translation_diagnostics_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<TranslationDiagnosticsView, AppError> {
    // 任务在、报告还没生成：404 + `reason: not_ready`（任务不存在是调用方 `load_supported_job` 的普通 404）。
    let path = resolve_translation_diagnostics(job, data_root)
        .ok_or_else(|| AppError::not_ready("translation report"))?;
    let secrets = sensitive_values(&job.request_payload);
    let summary = redact_json_value(&read_json_value(&path)?, &secrets);
    Ok(TranslationDiagnosticsView {
        job_id: job.job_id.clone(),
        summary,
    })
}
