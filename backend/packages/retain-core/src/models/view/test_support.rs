use std::path::Path;

use serde_json::Value;

use crate::models::{
    GlossaryUsageSummaryView, InvocationSummaryView, JobFailureDiagnosticView, JobFailureInfo,
    JobSnapshot, NormalizationSummaryView, OcrJobSummaryView,
};
use crate::storage_paths::{resolve_data_path, resolve_translation_manifest};

use super::to_absolute_url;

pub(super) fn build_ocr_job_summary(
    job: &JobSnapshot,
    base_url: &str,
) -> Option<OcrJobSummaryView> {
    let artifacts = job.artifacts.as_ref()?;
    let ocr_job_id = artifacts.ocr_job_id.as_ref()?;
    let detail_path = format!("/api/v1/ocr/jobs/{ocr_job_id}");
    Some(OcrJobSummaryView {
        job_id: ocr_job_id.clone(),
        status: artifacts.ocr_status.clone(),
        trace_id: artifacts.ocr_trace_id.clone(),
        provider_trace_id: artifacts.ocr_provider_trace_id.clone(),
        detail_path: detail_path.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
    })
}

pub(super) fn load_normalization_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<NormalizationSummaryView> {
    let path = crate::storage_paths::resolve_normalization_report(job, data_root)?;
    let payload: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let normalization = payload.get("normalization").unwrap_or(&payload);
    let defaults = normalization.get("defaults");
    let validation = normalization.get("validation");
    Some(NormalizationSummaryView {
        provider: normalization
            .get("provider")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        detected_provider: normalization
            .get("detected_provider")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        provider_was_explicit: normalization
            .get("provider_was_explicit")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        pages_seen: defaults
            .and_then(|v| v.get("pages_seen"))
            .and_then(Value::as_i64),
        blocks_seen: defaults
            .and_then(|v| v.get("blocks_seen"))
            .and_then(Value::as_i64),
        document_defaults: defaults
            .and_then(|v| v.get("document_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        page_defaults: defaults
            .and_then(|v| v.get("page_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        block_defaults: defaults
            .and_then(|v| v.get("block_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        schema: validation
            .and_then(|v| v.get("schema"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        schema_version: validation
            .and_then(|v| v.get("schema_version"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        page_count: validation
            .and_then(|v| v.get("page_count"))
            .and_then(Value::as_i64),
        block_count: validation
            .and_then(|v| v.get("block_count"))
            .and_then(Value::as_i64),
    })
}

pub(super) fn load_glossary_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    load_glossary_summary_from_manifest(job, data_root)
        .or_else(|| load_glossary_summary_from_pipeline_summary(job, data_root))
}

pub(super) fn load_invocation_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    load_invocation_summary_from_manifest(job, data_root)
        .or_else(|| load_invocation_summary_from_pipeline_summary(job, data_root))
}

fn load_invocation_summary_from_manifest(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    let path = resolve_translation_manifest(job, data_root)?;
    load_invocation_summary_from_json_path(&path)
}

fn load_invocation_summary_from_pipeline_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    let path = job.artifacts.as_ref()?.summary.as_ref()?;
    let path = resolve_data_path(data_root, path).ok()?;
    load_invocation_summary_from_json_path(&path)
}

fn load_invocation_summary_from_json_path(path: &Path) -> Option<InvocationSummaryView> {
    let payload: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let summary: InvocationSummaryView =
        serde_json::from_value(payload.get("invocation")?.clone()).ok()?;
    if !summary.stage.is_empty()
        || !summary.input_protocol.is_empty()
        || !summary.stage_spec_schema_version.is_empty()
    {
        Some(summary)
    } else {
        None
    }
}

fn load_glossary_summary_from_manifest(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    let path = resolve_translation_manifest(job, data_root)?;
    load_glossary_summary_from_json_path(&path)
}

fn load_glossary_summary_from_pipeline_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    let path = job.artifacts.as_ref()?.summary.as_ref()?;
    let path = resolve_data_path(data_root, path).ok()?;
    load_glossary_summary_from_json_path(&path)
}

fn load_glossary_summary_from_json_path(path: &Path) -> Option<GlossaryUsageSummaryView> {
    let payload: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let summary: GlossaryUsageSummaryView =
        serde_json::from_value(payload.get("glossary")?.clone()).ok()?;
    if summary.enabled
        || summary.entry_count > 0
        || !summary.glossary_id.is_empty()
        || !summary.glossary_name.is_empty()
    {
        Some(summary)
    } else {
        None
    }
}

pub(super) fn job_failure_to_legacy_view(failure: &JobFailureInfo) -> JobFailureDiagnosticView {
    let failure = failure.clone().with_formal_fields();
    JobFailureDiagnosticView {
        failed_stage: failure.failed_stage_value().to_string(),
        error_kind: failure.failure_code_value().to_string(),
        summary: failure.summary.clone(),
        root_cause: failure.root_cause.clone(),
        retryable: failure.retryable,
        upstream_host: failure.upstream_host.clone(),
        suggestion: failure.suggestion.clone(),
        last_log_line: failure.last_log_line.clone(),
    }
}
