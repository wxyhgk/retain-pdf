use crate::models::domain::{JobArtifacts, JobSnapshot};
use crate::ocr_provider::{
    ensure_provider_diagnostics, parse_provider_kind, OcrProviderDiagnostics,
};

pub fn parse_labeled_value<'a>(line: &'a str, label: &str) -> Option<&'a str> {
    line.strip_prefix(label)
        .and_then(|rest| rest.strip_prefix(':'))
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

pub fn job_artifacts_mut(job: &mut JobSnapshot) -> &mut JobArtifacts {
    if job.artifacts.is_none() {
        job.artifacts = Some(JobArtifacts::default());
    }
    job.artifacts.as_mut().unwrap()
}

pub fn ocr_provider_diagnostics_mut(job: &mut JobSnapshot) -> &mut OcrProviderDiagnostics {
    let provider_kind = parse_provider_kind(&job.request_payload.ocr.provider);
    let artifacts = job_artifacts_mut(job);
    ensure_provider_diagnostics(artifacts, provider_kind)
}
