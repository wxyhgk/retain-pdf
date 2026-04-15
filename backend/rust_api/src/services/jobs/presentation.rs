use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::job_failure::classify_job_failure;
use crate::models::{
    build_artifact_links, build_artifact_manifest, build_job_actions, build_job_links_with_workflow,
    summarize_list_invocation, ArtifactLinksView, GlossaryUsageSummaryView,
    InvocationSummaryView, JobArtifactManifestView, JobDetailView, JobEventListView,
    JobFailureDiagnosticView, JobListItemView, JobListView, JobProgressView, JobSnapshot,
    JobTimestampsView, ListJobEventsQuery, ListJobsQuery, NormalizationSummaryView,
    OcrJobSummaryView,
};
use crate::services::artifacts::list_registry_for_job;
use crate::services::jobs::{
    ensure_supported_job_layout, list_jobs_filtered, load_job_or_404, readiness,
};
use crate::storage_paths::{
    resolve_data_path, resolve_markdown_path, resolve_normalization_report, resolve_output_pdf,
    resolve_translation_manifest,
};
use serde_json::Value;

pub fn build_job_list_view(
    db: &Db,
    data_root: &Path,
    query: &ListJobsQuery,
    base_url: &str,
) -> Result<JobListView, AppError> {
    let jobs = list_jobs_filtered(db, query)?;
    let items: Vec<_> = jobs
        .iter()
        .map(|job| build_job_list_item_view(db, data_root, job, base_url))
        .collect();
    let invocation_summary = summarize_list_invocation(&items);
    Ok(JobListView {
        items,
        invocation_summary,
    })
}

pub fn build_job_detail_view(data_root: &Path, job: &JobSnapshot, base_url: &str) -> JobDetailView {
    let (pdf_ready, markdown_ready, bundle_ready) = readiness(
        job,
        data_root,
        resolve_output_pdf,
        resolve_markdown_path,
    );
    let duration_seconds = match (&job.started_at, &job.finished_at, &job.result) {
        (_, _, Some(result)) => Some(result.duration_seconds),
        _ => None,
    };
    let percent = match (job.progress_current, job.progress_total) {
        (Some(current), Some(total)) if total > 0 => Some((current as f64 / total as f64) * 100.0),
        _ => None,
    };
    let failure = job.failure.clone().or_else(|| classify_job_failure(job));
    JobDetailView {
        job_id: job.job_id.clone(),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        request_payload: job.request_payload.clone(),
        trace_id: job.artifacts.as_ref().and_then(|item| item.trace_id.clone()),
        provider_trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.provider_trace_id.clone()),
        stage: job.stage.clone(),
        stage_detail: job.stage_detail.clone(),
        progress: JobProgressView {
            current: job.progress_current,
            total: job.progress_total,
            percent,
        },
        timestamps: JobTimestampsView {
            created_at: job.created_at.clone(),
            updated_at: job.updated_at.clone(),
            started_at: job.started_at.clone(),
            finished_at: job.finished_at.clone(),
            duration_seconds,
        },
        links: build_job_links_with_workflow(&job.job_id, &job.workflow, base_url),
        actions: build_job_actions(job, base_url, pdf_ready, markdown_ready, bundle_ready),
        artifacts: build_artifact_links(
            job,
            base_url,
            data_root,
            pdf_ready,
            markdown_ready,
            bundle_ready,
        ),
        ocr_job: build_ocr_job_summary(job, base_url),
        ocr_provider_diagnostics: job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.ocr_provider_diagnostics.clone()),
        runtime: job.runtime.clone(),
        failure: failure.clone(),
        error: job.error.clone(),
        failure_diagnostic: failure.as_ref().map(job_failure_to_legacy_view),
        normalization_summary: load_normalization_summary(job, data_root),
        glossary_summary: load_glossary_summary(job, data_root),
        invocation: load_invocation_summary(job, data_root),
        log_tail: job.log_tail.clone(),
    }
}

pub fn build_job_artifact_links_view(
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> ArtifactLinksView {
    let (pdf_ready, markdown_ready, bundle_ready) = readiness(
        job,
        data_root,
        resolve_output_pdf,
        resolve_markdown_path,
    );
    crate::models::build_artifact_links(
        job,
        base_url,
        data_root,
        pdf_ready,
        markdown_ready,
        bundle_ready,
    )
}

fn build_job_list_item_view(db: &Db, data_root: &Path, job: &JobSnapshot, base_url: &str) -> JobListItemView {
    let detail_path = format!("{}/{}", job_path_prefix(job), job.job_id);
    JobListItemView {
        job_id: job.job_id.clone(),
        display_name: derive_display_name(db, job),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        trace_id: job.artifacts.as_ref().and_then(|item| item.trace_id.clone()),
        stage: job.stage.clone(),
        invocation: load_invocation_summary(job, data_root),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_url: crate::models::to_absolute_url(base_url, &detail_path),
        detail_path,
    }
}

pub fn build_job_artifact_manifest_view(
    db: &Db,
    data_root: &Path,
    job: &JobSnapshot,
    base_url: &str,
) -> Result<JobArtifactManifestView, AppError> {
    let items = list_registry_for_job(db, data_root, job)?;
    Ok(build_artifact_manifest(job, base_url, &items))
}

pub fn build_job_events_view(
    db: &Db,
    job_id: &str,
    query: &ListJobEventsQuery,
) -> Result<JobEventListView, AppError> {
    let limit = query.limit.clamp(1, 500);
    let items = db.list_job_events(job_id, limit, query.offset)?;
    Ok(JobEventListView {
        items,
        limit,
        offset: query.offset,
    })
}

pub fn load_supported_job(db: &Db, data_root: &Path, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

pub fn load_ocr_job_or_404(db: &Db, job_id: &str) -> Result<JobSnapshot, AppError> {
    let job = load_job_or_404(db, job_id)?;
    if !matches!(job.workflow, crate::models::WorkflowKind::Ocr) {
        return Err(AppError::not_found(format!("ocr job not found: {job_id}")));
    }
    Ok(job)
}

pub fn load_ocr_job_with_supported_layout(
    db: &Db,
    data_root: &Path,
    job_id: &str,
) -> Result<JobSnapshot, AppError> {
    let job = load_ocr_job_or_404(db, job_id)?;
    ensure_supported_job_layout(data_root, &job)?;
    Ok(job)
}

fn derive_display_name(db: &Db, job: &JobSnapshot) -> String {
    if let Some(upload_id) = job
        .upload_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Ok(upload) = db.get_upload(upload_id) {
            let file_name = upload.filename.trim();
            if !file_name.is_empty() {
                return file_name.to_string();
            }
        }
    }

    if let Some(name) = source_url_file_name(&job.request_payload.source.source_url) {
        return name;
    }

    job.job_id.clone()
}

fn source_url_file_name(source_url: &str) -> Option<String> {
    let trimmed = source_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let no_fragment = trimmed.split('#').next().unwrap_or(trimmed);
    let no_query = no_fragment.split('?').next().unwrap_or(no_fragment);
    let candidate = no_query.rsplit('/').next().unwrap_or(no_query).trim();
    if candidate.is_empty() {
        return None;
    }
    Some(candidate.to_string())
}

fn job_path_prefix(job: &JobSnapshot) -> &'static str {
    match job.workflow {
        crate::models::WorkflowKind::Ocr => "/api/v1/ocr/jobs",
        crate::models::WorkflowKind::Mineru
        | crate::models::WorkflowKind::Translate
        | crate::models::WorkflowKind::Render => "/api/v1/jobs",
    }
}

fn build_ocr_job_summary(job: &JobSnapshot, base_url: &str) -> Option<OcrJobSummaryView> {
    let artifacts = job.artifacts.as_ref()?;
    let ocr_job_id = artifacts.ocr_job_id.as_ref()?;
    let detail_path = format!("/api/v1/ocr/jobs/{ocr_job_id}");
    Some(OcrJobSummaryView {
        job_id: ocr_job_id.clone(),
        status: artifacts.ocr_status.clone(),
        trace_id: artifacts.ocr_trace_id.clone(),
        provider_trace_id: artifacts.ocr_provider_trace_id.clone(),
        detail_path: detail_path.clone(),
        detail_url: crate::models::to_absolute_url(base_url, &detail_path),
    })
}

fn load_normalization_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<NormalizationSummaryView> {
    let path = resolve_normalization_report(job, data_root)?;
    let payload: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let normalization = payload.get("normalization").unwrap_or(&payload);
    let defaults = normalization.get("defaults");
    let validation = normalization.get("validation");
    Some(NormalizationSummaryView {
        provider: normalization.get("provider").and_then(Value::as_str).unwrap_or("").to_string(),
        detected_provider: normalization
            .get("detected_provider")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        provider_was_explicit: normalization
            .get("provider_was_explicit")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        pages_seen: defaults.and_then(|v| v.get("pages_seen")).and_then(Value::as_i64),
        blocks_seen: defaults.and_then(|v| v.get("blocks_seen")).and_then(Value::as_i64),
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
        page_count: validation.and_then(|v| v.get("page_count")).and_then(Value::as_i64),
        block_count: validation.and_then(|v| v.get("block_count")).and_then(Value::as_i64),
    })
}

fn load_glossary_summary(job: &JobSnapshot, data_root: &Path) -> Option<GlossaryUsageSummaryView> {
    load_glossary_summary_from_manifest(job, data_root)
        .or_else(|| load_glossary_summary_from_pipeline_summary(job, data_root))
}

fn load_invocation_summary(job: &JobSnapshot, data_root: &Path) -> Option<InvocationSummaryView> {
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

fn job_failure_to_legacy_view(failure: &crate::models::JobFailureInfo) -> JobFailureDiagnosticView {
    JobFailureDiagnosticView {
        failed_stage: failure.stage.clone(),
        error_kind: failure.category.clone(),
        summary: failure.summary.clone(),
        root_cause: failure.root_cause.clone(),
        retryable: failure.retryable,
        upstream_host: failure.upstream_host.clone(),
        suggestion: failure.suggestion.clone(),
        last_log_line: failure.last_log_line.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::source_url_file_name;

    #[test]
    fn source_url_file_name_extracts_tail() {
        assert_eq!(
            source_url_file_name("https://example.com/files/paper.pdf?download=1#top"),
            Some("paper.pdf".to_string())
        );
    }

    #[test]
    fn source_url_file_name_rejects_empty_tail() {
        assert_eq!(source_url_file_name("https://example.com/files/"), None);
    }
}
