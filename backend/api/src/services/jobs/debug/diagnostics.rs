use std::path::Path;

use crate::error::AppError;
use crate::models::api::{
    redact_json_value, sensitive_values, JobReportView, TranslationDiagnosticsView,
};
use crate::models::domain::JobSnapshot;
use crate::storage_paths::{
    resolve_fit_report, resolve_translation_diagnostics, resolve_translation_qa,
};

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

pub(crate) fn load_translation_qa_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<JobReportView, AppError> {
    let path = resolve_translation_qa(job, data_root).ok_or_else(|| {
        AppError::not_found(format!("translation qa report not found: {}", job.job_id))
    })?;
    load_report_view(&path, job)
}

pub(crate) fn load_fit_report_view(
    data_root: &Path,
    job: &JobSnapshot,
) -> Result<JobReportView, AppError> {
    let path = resolve_fit_report(job, data_root).ok_or_else(|| {
        AppError::not_found(format!("fit report not found: {}", job.job_id))
    })?;
    load_report_view(&path, job)
}

fn load_report_view(path: &Path, job: &JobSnapshot) -> Result<JobReportView, AppError> {
    // 报告里带原文、译文片段和任务目录路径；和 diagnostics 一样过一遍脱敏。
    let secrets = sensitive_values(&job.request_payload);
    Ok(JobReportView {
        job_id: job.job_id.clone(),
        report: redact_json_value(&read_json_value(path)?, &secrets),
    })
}
