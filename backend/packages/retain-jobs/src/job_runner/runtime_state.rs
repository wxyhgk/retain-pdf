use crate::models::domain::{JobArtifacts, JobRuntimeState};
use crate::ocr_provider::{
    ensure_provider_diagnostics, parse_provider_kind, OcrProviderDiagnostics,
};

use super::stdout_parser;

pub(crate) fn attach_job_paths(
    job: &mut JobRuntimeState,
    job_paths: &crate::storage_paths::JobPaths,
) {
    job_artifacts_mut(job).job_root = Some(job_paths.root.to_string_lossy().to_string());
}

pub(crate) fn apply_job_stdout_line(job: &mut JobRuntimeState, line: &str) {
    let mut snapshot = job.snapshot();
    stdout_parser::apply_line(&mut snapshot, line);
    *job = snapshot.into_runtime();
    sync_runtime_state(job);
}

pub(crate) fn attach_job_provider_failure(job: &mut JobRuntimeState, stderr_text: &str) {
    let mut snapshot = job.snapshot();
    stdout_parser::attach_provider_failure(&mut snapshot, stderr_text);
    *job = snapshot.into_runtime();
    refresh_job_failure(job);
}

pub(crate) fn job_artifacts_mut(job: &mut JobRuntimeState) -> &mut JobArtifacts {
    if job.artifacts.is_none() {
        job.artifacts = Some(JobArtifacts::default());
    }
    job.artifacts.as_mut().unwrap()
}

pub(crate) fn clear_canceled_runtime_artifacts(job: &mut JobRuntimeState) {
    let artifacts = job_artifacts_mut(job);
    artifacts.normalized_document_json = None;
    artifacts.normalization_report_json = None;
    artifacts.schema_version = None;
}

pub(crate) fn sync_runtime_state(job: &mut JobRuntimeState) {
    job.sync_runtime_state();
}

pub(crate) fn clear_job_failure(job: &mut JobRuntimeState) {
    job.replace_failure_info(None);
}

pub(crate) fn register_job_retry(job: &mut JobRuntimeState) {
    job.register_retry();
    job.sync_runtime_state();
}

pub(crate) fn refresh_job_failure(job: &mut JobRuntimeState) {
    let snapshot = job.snapshot();
    job.replace_failure_info(crate::job_failure::classify_job_failure(&snapshot));
}

pub(crate) fn ocr_provider_diagnostics_mut(
    job: &mut JobRuntimeState,
) -> &mut OcrProviderDiagnostics {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr.provider);
    let artifacts = job_artifacts_mut(job);
    ensure_provider_diagnostics(artifacts, provider_kind)
}
