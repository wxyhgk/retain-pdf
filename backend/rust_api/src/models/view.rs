use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ocr_provider::OcrProviderDiagnostics;
use crate::storage_paths::{
    resolve_markdown_path, resolve_normalization_report, resolve_normalized_document,
    resolve_output_pdf,
};
#[cfg(test)]
use crate::job_failure::classify_job_failure;
#[cfg(test)]
use crate::storage_paths::{resolve_data_path, resolve_translation_manifest};

use super::common::{JobStatusKind, UploadRecord, UploadView, WorkflowKind};
use super::defaults::{default_event_limit, default_limit};
use super::input::ResolvedJobSpec;
use super::job::{JobArtifactRecord, JobFailureInfo, JobRuntimeInfo, JobSnapshot};

#[derive(Debug, Serialize)]
pub struct JobSubmissionView {
    pub job_id: String,
    pub status: JobStatusKind,
    pub workflow: WorkflowKind,
    pub links: JobLinksView,
    pub actions: JobActionsView,
}

#[derive(Debug, Serialize)]
pub struct JobProgressView {
    pub current: Option<i64>,
    pub total: Option<i64>,
    pub percent: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct JobTimestampsView {
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct JobLinksView {
    pub self_path: String,
    pub self_url: String,
    pub artifacts_path: String,
    pub artifacts_url: String,
    pub artifacts_manifest_path: String,
    pub artifacts_manifest_url: String,
    pub events_path: String,
    pub events_url: String,
    pub cancel_path: String,
    pub cancel_url: String,
}

#[derive(Debug, Serialize)]
pub struct ActionLinkView {
    pub enabled: bool,
    pub method: String,
    pub path: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct JobActionsView {
    pub open_job: ActionLinkView,
    pub open_artifacts: ActionLinkView,
    pub cancel: ActionLinkView,
    pub download_pdf: ActionLinkView,
    pub open_markdown: ActionLinkView,
    pub open_markdown_raw: ActionLinkView,
    pub download_bundle: ActionLinkView,
}

#[derive(Debug, Serialize)]
pub struct ResourceLinkView {
    pub ready: bool,
    pub path: String,
    pub url: String,
    pub method: String,
    pub content_type: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct MarkdownArtifactView {
    pub ready: bool,
    pub json_path: String,
    pub json_url: String,
    pub raw_path: String,
    pub raw_url: String,
    pub images_base_path: String,
    pub images_base_url: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ArtifactLinksView {
    pub pdf_ready: bool,
    pub markdown_ready: bool,
    pub bundle_ready: bool,
    pub schema_version: Option<String>,
    pub provider_raw_dir: Option<String>,
    pub provider_zip: Option<String>,
    pub provider_summary_json: Option<String>,
    pub pdf_url: String,
    pub markdown_url: String,
    pub markdown_images_base_url: String,
    pub bundle_url: String,
    pub normalized_document_url: String,
    pub normalization_report_url: String,
    pub manifest_path: String,
    pub manifest_url: String,
    pub actions: JobActionsView,
    pub normalized_document: ResourceLinkView,
    pub normalization_report: ResourceLinkView,
    pub pdf: ResourceLinkView,
    pub markdown: MarkdownArtifactView,
    pub bundle: ResourceLinkView,
}

#[derive(Debug, Serialize)]
pub struct JobArtifactItemView {
    pub artifact_key: String,
    pub artifact_group: String,
    pub artifact_kind: String,
    pub ready: bool,
    pub file_name: Option<String>,
    pub content_type: String,
    pub size_bytes: Option<u64>,
    pub relative_path: String,
    pub checksum: Option<String>,
    pub source_stage: Option<String>,
    pub updated_at: String,
    pub resource_path: Option<String>,
    pub resource_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobArtifactManifestView {
    pub job_id: String,
    pub items: Vec<JobArtifactItemView>,
}

#[derive(Debug, Serialize)]
pub struct JobDetailView {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub request_payload: ResolvedJobSpec,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    pub timestamps: JobTimestampsView,
    pub links: JobLinksView,
    pub actions: JobActionsView,
    pub artifacts: ArtifactLinksView,
    pub ocr_job: Option<OcrJobSummaryView>,
    pub ocr_provider_diagnostics: Option<OcrProviderDiagnostics>,
    pub runtime: Option<JobRuntimeInfo>,
    pub failure: Option<JobFailureInfo>,
    pub error: Option<String>,
    pub failure_diagnostic: Option<JobFailureDiagnosticView>,
    pub normalization_summary: Option<NormalizationSummaryView>,
    pub glossary_summary: Option<GlossaryUsageSummaryView>,
    pub invocation: Option<InvocationSummaryView>,
    pub log_tail: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct JobFailureDiagnosticView {
    pub failed_stage: String,
    pub error_kind: String,
    pub summary: String,
    pub root_cause: Option<String>,
    pub retryable: bool,
    pub upstream_host: Option<String>,
    pub suggestion: Option<String>,
    pub last_log_line: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NormalizationSummaryView {
    pub provider: String,
    pub detected_provider: String,
    pub provider_was_explicit: bool,
    pub pages_seen: Option<i64>,
    pub blocks_seen: Option<i64>,
    pub document_defaults: usize,
    pub page_defaults: usize,
    pub block_defaults: usize,
    pub schema: String,
    pub schema_version: String,
    pub page_count: Option<i64>,
    pub block_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct GlossaryUsageSummaryView {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub glossary_id: String,
    #[serde(default)]
    pub glossary_name: String,
    #[serde(default)]
    pub entry_count: i64,
    #[serde(default)]
    pub resource_entry_count: i64,
    #[serde(default)]
    pub inline_entry_count: i64,
    #[serde(default)]
    pub overridden_entry_count: i64,
    #[serde(default)]
    pub source_hit_entry_count: i64,
    #[serde(default)]
    pub target_hit_entry_count: i64,
    #[serde(default)]
    pub unused_entry_count: i64,
    #[serde(default)]
    pub unapplied_source_hit_entry_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
pub struct InvocationSummaryView {
    #[serde(default)]
    pub stage: String,
    #[serde(default)]
    pub input_protocol: String,
    #[serde(default)]
    pub stage_spec_schema_version: String,
}

#[derive(Debug, Serialize)]
pub struct JobListItemView {
    pub job_id: String,
    pub display_name: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub trace_id: Option<String>,
    pub stage: Option<String>,
    pub invocation: Option<InvocationSummaryView>,
    pub created_at: String,
    pub updated_at: String,
    pub detail_path: String,
    pub detail_url: String,
}

#[derive(Debug, Serialize, Default)]
pub struct JobListInvocationSummaryView {
    pub stage_spec_count: usize,
    pub unknown_count: usize,
}

#[derive(Debug, Serialize)]
pub struct OcrJobSummaryView {
    pub job_id: String,
    pub status: Option<JobStatusKind>,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub detail_path: String,
    pub detail_url: String,
}

#[derive(Debug, Serialize)]
pub struct JobListView {
    pub items: Vec<JobListItemView>,
    pub invocation_summary: JobListInvocationSummaryView,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobEventRecord {
    pub job_id: String,
    pub seq: i64,
    pub ts: String,
    pub level: String,
    pub stage: Option<String>,
    pub event: String,
    pub message: String,
    pub payload: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct JobEventListView {
    pub items: Vec<JobEventRecord>,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct ListJobsQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    #[serde(default)]
    pub status: Option<JobStatusKind>,
    #[serde(default)]
    pub workflow: Option<WorkflowKind>,
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListJobEventsQuery {
    #[serde(default = "default_event_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct MarkdownQuery {
    #[serde(default)]
    pub raw: bool,
}

#[derive(Debug, Deserialize, Default)]
pub struct ArtifactDownloadQuery {
    #[serde(default)]
    pub include_job_dir: bool,
}

#[derive(Debug, Serialize)]
pub struct MarkdownView {
    pub job_id: String,
    pub content: String,
    pub raw_path: String,
    pub raw_url: String,
    pub images_base_path: String,
    pub images_base_url: String,
}

pub fn build_job_links(job_id: &str, base_url: &str) -> JobLinksView {
    build_job_links_with_workflow(job_id, &WorkflowKind::Mineru, base_url)
}

fn job_path_prefix(workflow: &WorkflowKind) -> &'static str {
    match workflow {
        WorkflowKind::Ocr => "/api/v1/ocr/jobs",
        WorkflowKind::Mineru | WorkflowKind::Translate | WorkflowKind::Render => "/api/v1/jobs",
    }
}

pub fn build_job_links_with_workflow(
    job_id: &str,
    workflow: &WorkflowKind,
    base_url: &str,
) -> JobLinksView {
    let prefix = job_path_prefix(workflow);
    let self_path = format!("{prefix}/{job_id}");
    let artifacts_path = format!("{prefix}/{job_id}/artifacts");
    let artifacts_manifest_path = format!("{prefix}/{job_id}/artifacts-manifest");
    let events_path = format!("{prefix}/{job_id}/events");
    let cancel_path = format!("{prefix}/{job_id}/cancel");
    JobLinksView {
        self_path: self_path.clone(),
        self_url: to_absolute_url(base_url, &self_path),
        artifacts_path: artifacts_path.clone(),
        artifacts_url: to_absolute_url(base_url, &artifacts_path),
        artifacts_manifest_path: artifacts_manifest_path.clone(),
        artifacts_manifest_url: to_absolute_url(base_url, &artifacts_manifest_path),
        events_path: events_path.clone(),
        events_url: to_absolute_url(base_url, &events_path),
        cancel_path: cancel_path.clone(),
        cancel_url: to_absolute_url(base_url, &cancel_path),
    }
}

fn can_cancel(status: &JobStatusKind) -> bool {
    matches!(status, JobStatusKind::Queued | JobStatusKind::Running)
}

fn action_link(enabled: bool, method: &str, path: String, base_url: &str) -> ActionLinkView {
    ActionLinkView {
        enabled,
        method: method.to_string(),
        url: to_absolute_url(base_url, &path),
        path,
    }
}

pub fn build_job_actions(
    job: &JobSnapshot,
    base_url: &str,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobActionsView {
    let prefix = job_path_prefix(&job.workflow);
    let job_path = format!("{prefix}/{}", job.job_id);
    let artifacts_path = format!("{prefix}/{}/artifacts", job.job_id);
    let cancel_path = format!("{prefix}/{}/cancel", job.job_id);
    let pdf_path = format!("{prefix}/{}/pdf", job.job_id);
    let markdown_path = format!("{prefix}/{}/markdown", job.job_id);
    let markdown_raw_path = format!("{prefix}/{}/markdown?raw=true", job.job_id);
    let bundle_path = format!("{prefix}/{}/download", job.job_id);
    JobActionsView {
        open_job: action_link(true, "GET", job_path, base_url),
        open_artifacts: action_link(true, "GET", artifacts_path, base_url),
        cancel: action_link(can_cancel(&job.status), "POST", cancel_path, base_url),
        download_pdf: action_link(pdf_ready, "GET", pdf_path, base_url),
        open_markdown: action_link(markdown_ready, "GET", markdown_path, base_url),
        open_markdown_raw: action_link(markdown_ready, "GET", markdown_raw_path, base_url),
        download_bundle: action_link(bundle_ready, "GET", bundle_path, base_url),
    }
}

pub fn build_artifact_links(
    job: &JobSnapshot,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> ArtifactLinksView {
    let prefix = job_path_prefix(&job.workflow);
    let pdf_path = format!("{prefix}/{}/pdf", job.job_id);
    let markdown_path = format!("{prefix}/{}/markdown", job.job_id);
    let markdown_raw_path = format!("{prefix}/{}/markdown?raw=true", job.job_id);
    let markdown_images_base_path = format!("{prefix}/{}/markdown/images/", job.job_id);
    let bundle_path = format!("{prefix}/{}/download", job.job_id);
    let manifest_path = format!("{prefix}/{}/artifacts-manifest", job.job_id);
    let normalized_document_path = format!("{prefix}/{}/normalized-document", job.job_id);
    let normalization_report_path = format!("{prefix}/{}/normalization-report", job.job_id);
    let pdf_file_path = resolve_output_pdf(job, data_root);
    let markdown_file_path = resolve_markdown_path(job, data_root);
    let normalized_document_file_path = resolve_normalized_document(job, data_root);
    let normalization_report_file_path = resolve_normalization_report(job, data_root);
    let bundle_file_name = format!("{}.zip", job.job_id);
    let actions = build_job_actions(job, base_url, pdf_ready, markdown_ready, bundle_ready);
    ArtifactLinksView {
        pdf_ready,
        markdown_ready,
        bundle_ready,
        schema_version: job
            .artifacts
            .as_ref()
            .and_then(|item| item.schema_version.clone()),
        provider_raw_dir: job
            .artifacts
            .as_ref()
            .and_then(|item| item.provider_raw_dir.clone()),
        provider_zip: job
            .artifacts
            .as_ref()
            .and_then(|item| item.provider_zip.clone()),
        provider_summary_json: job
            .artifacts
            .as_ref()
            .and_then(|item| item.provider_summary_json.clone()),
        pdf_url: pdf_path.clone(),
        markdown_url: markdown_path.clone(),
        markdown_images_base_url: markdown_images_base_path.clone(),
        bundle_url: bundle_path.clone(),
        normalized_document_url: normalized_document_path.clone(),
        normalization_report_url: normalization_report_path.clone(),
        manifest_path: manifest_path.clone(),
        manifest_url: to_absolute_url(base_url, &manifest_path),
        actions,
        normalized_document: ResourceLinkView {
            ready: normalized_document_file_path.is_some(),
            path: normalized_document_path.clone(),
            url: to_absolute_url(base_url, &normalized_document_path),
            method: "GET".to_string(),
            content_type: "application/json".to_string(),
            file_name: file_name_from_path(normalized_document_file_path.as_deref()),
            size_bytes: file_size(normalized_document_file_path.as_deref()),
        },
        normalization_report: ResourceLinkView {
            ready: normalization_report_file_path.is_some(),
            path: normalization_report_path.clone(),
            url: to_absolute_url(base_url, &normalization_report_path),
            method: "GET".to_string(),
            content_type: "application/json".to_string(),
            file_name: file_name_from_path(normalization_report_file_path.as_deref()),
            size_bytes: file_size(normalization_report_file_path.as_deref()),
        },
        pdf: ResourceLinkView {
            ready: pdf_ready,
            path: pdf_path.clone(),
            url: to_absolute_url(base_url, &pdf_path),
            method: "GET".to_string(),
            content_type: "application/pdf".to_string(),
            file_name: file_name_from_path(pdf_file_path.as_deref()),
            size_bytes: file_size(pdf_file_path.as_deref()),
        },
        markdown: MarkdownArtifactView {
            ready: markdown_ready,
            json_path: markdown_path.clone(),
            json_url: to_absolute_url(base_url, &markdown_path),
            raw_path: markdown_raw_path.clone(),
            raw_url: to_absolute_url(base_url, &markdown_raw_path),
            images_base_path: markdown_images_base_path.clone(),
            images_base_url: to_absolute_url(base_url, &markdown_images_base_path),
            file_name: file_name_from_path(markdown_file_path.as_deref()),
            size_bytes: file_size(markdown_file_path.as_deref()),
        },
        bundle: ResourceLinkView {
            ready: bundle_ready,
            path: bundle_path.clone(),
            url: to_absolute_url(base_url, &bundle_path),
            method: "GET".to_string(),
            content_type: "application/zip".to_string(),
            file_name: Some(bundle_file_name),
            size_bytes: None,
        },
    }
}

pub fn build_artifact_manifest(
    job: &JobSnapshot,
    base_url: &str,
    items: &[JobArtifactRecord],
) -> JobArtifactManifestView {
    JobArtifactManifestView {
        job_id: job.job_id.clone(),
        items: items
            .iter()
            .map(|item| JobArtifactItemView {
                artifact_key: item.artifact_key.clone(),
                artifact_group: item.artifact_group.clone(),
                artifact_kind: item.artifact_kind.clone(),
                ready: item.ready,
                file_name: item.file_name.clone(),
                content_type: item.content_type.clone(),
                size_bytes: item.size_bytes,
                relative_path: item.relative_path.clone(),
                checksum: item.checksum.clone(),
                source_stage: item.source_stage.clone(),
                updated_at: item.updated_at.clone(),
                resource_path: crate::services::artifacts::artifact_resource_path(
                    job,
                    &item.artifact_key,
                ),
                resource_url: crate::services::artifacts::artifact_resource_path(
                    job,
                    &item.artifact_key,
                )
                .map(|path| to_absolute_url(base_url, &path)),
            })
            .collect(),
    }
}

#[cfg(test)]
pub fn job_to_detail(
    job: &JobSnapshot,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobDetailView {
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
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
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

#[cfg(test)]
pub fn job_to_list_item(
    job: &JobSnapshot,
    base_url: &str,
    display_name: String,
    data_root: &Path,
) -> JobListItemView {
    let detail_path = format!("{}/{}", job_path_prefix(&job.workflow), job.job_id);
    JobListItemView {
        job_id: job.job_id.clone(),
        display_name,
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        stage: job.stage.clone(),
        invocation: load_invocation_summary(job, data_root),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
        detail_path,
    }
}

pub fn summarize_list_invocation(items: &[JobListItemView]) -> JobListInvocationSummaryView {
    let mut summary = JobListInvocationSummaryView::default();
    for item in items {
        match item
            .invocation
            .as_ref()
            .map(|value| value.input_protocol.as_str())
            .unwrap_or("")
        {
            "stage_spec" => summary.stage_spec_count += 1,
            _ => summary.unknown_count += 1,
        }
    }
    summary
}

#[cfg(test)]
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
        detail_url: to_absolute_url(base_url, &detail_path),
    })
}

pub fn upload_to_response(upload: &UploadRecord) -> UploadView {
    UploadView {
        upload_id: upload.upload_id.clone(),
        filename: upload.filename.clone(),
        bytes: upload.bytes,
        page_count: upload.page_count,
        uploaded_at: upload.uploaded_at.clone(),
    }
}

#[cfg(test)]
pub fn load_normalization_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<NormalizationSummaryView> {
    let path = resolve_normalization_report(job, data_root)?;
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

#[cfg(test)]
pub fn load_glossary_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    load_glossary_summary_from_manifest(job, data_root)
        .or_else(|| load_glossary_summary_from_pipeline_summary(job, data_root))
}

#[cfg(test)]
pub fn load_invocation_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    load_invocation_summary_from_manifest(job, data_root)
        .or_else(|| load_invocation_summary_from_pipeline_summary(job, data_root))
}

#[cfg(test)]
fn load_invocation_summary_from_manifest(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    let path = resolve_translation_manifest(job, data_root)?;
    load_invocation_summary_from_json_path(&path)
}

#[cfg(test)]
fn load_invocation_summary_from_pipeline_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<InvocationSummaryView> {
    let path = job.artifacts.as_ref()?.summary.as_ref()?;
    let path = resolve_data_path(data_root, path).ok()?;
    load_invocation_summary_from_json_path(&path)
}

#[cfg(test)]
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

#[cfg(test)]
fn load_glossary_summary_from_manifest(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    let path = resolve_translation_manifest(job, data_root)?;
    load_glossary_summary_from_json_path(&path)
}

#[cfg(test)]
fn load_glossary_summary_from_pipeline_summary(
    job: &JobSnapshot,
    data_root: &Path,
) -> Option<GlossaryUsageSummaryView> {
    let path = job.artifacts.as_ref()?.summary.as_ref()?;
    let path = resolve_data_path(data_root, path).ok()?;
    load_glossary_summary_from_json_path(&path)
}

#[cfg(test)]
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

fn file_name_from_path(path: Option<&Path>) -> Option<String> {
    path.and_then(|p| p.file_name())
        .map(|v| v.to_string_lossy().to_string())
}

fn file_size(path: Option<&Path>) -> Option<u64> {
    path.and_then(|p| std::fs::metadata(p).ok())
        .map(|meta| meta.len())
}

pub fn to_absolute_url(base_url: &str, path: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), path)
}

#[cfg(test)]
fn job_failure_to_legacy_view(failure: &JobFailureInfo) -> JobFailureDiagnosticView {
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
    use std::fs;

    use super::{
        build_artifact_manifest, build_job_actions, build_job_links_with_workflow, job_to_detail,
        job_to_list_item, summarize_list_invocation, InvocationSummaryView, JobListItemView,
    };
    use crate::models::{
        CreateJobInput, JobArtifactRecord, JobFailureInfo, JobSnapshot, JobStatusKind, WorkflowKind,
    };
    use crate::storage_paths::{
        ARTIFACT_KEY_MARKDOWN_RAW, ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
        ARTIFACT_KEY_TRANSLATED_PDF, ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON,
    };

    fn build_job(job_id: &str, workflow: WorkflowKind) -> JobSnapshot {
        let mut input = CreateJobInput::default();
        input.workflow = workflow;
        JobSnapshot::new(job_id.to_string(), input, vec!["python".to_string()])
    }

    fn artifact_record(job_id: &str, artifact_key: &str) -> JobArtifactRecord {
        JobArtifactRecord {
            job_id: job_id.to_string(),
            artifact_key: artifact_key.to_string(),
            artifact_group: "test".to_string(),
            artifact_kind: "file".to_string(),
            relative_path: format!("jobs/{job_id}/{artifact_key}"),
            file_name: Some(format!("{artifact_key}.bin")),
            content_type: "application/octet-stream".to_string(),
            ready: true,
            size_bytes: Some(42),
            checksum: None,
            source_stage: Some("test".to_string()),
            created_at: "2026-04-11T00:00:00Z".to_string(),
            updated_at: "2026-04-11T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn job_detail_view_contains_request_payload() {
        let mut input = CreateJobInput::default();
        input.ocr.page_ranges = "1-5".to_string();
        input.source.upload_id = "upload-1".to_string();
        let job = JobSnapshot::new(
            "job-view-test".to_string(),
            input,
            vec!["python".to_string()],
        );

        let detail = job_to_detail(
            &job,
            "http://127.0.0.1:41000",
            std::path::Path::new("/tmp"),
            false,
            false,
            false,
        );

        assert_eq!(detail.request_payload.ocr.page_ranges, "1-5");
        assert_eq!(detail.request_payload.source.upload_id, "upload-1");
    }

    #[test]
    fn workflow_contract_uses_expected_route_prefixes() {
        let cases = [
            (WorkflowKind::Mineru, "/api/v1/jobs"),
            (WorkflowKind::Translate, "/api/v1/jobs"),
            (WorkflowKind::Render, "/api/v1/jobs"),
            (WorkflowKind::Ocr, "/api/v1/ocr/jobs"),
        ];

        for (workflow, prefix) in cases {
            let job = build_job("job-contract", workflow.clone());
            let links =
                build_job_links_with_workflow("job-contract", &workflow, "https://api.example");
            let pdf_ready = !matches!(workflow, WorkflowKind::Ocr);
            let actions = build_job_actions(&job, "https://api.example", pdf_ready, false, false);
            let item = job_to_list_item(
                &job,
                "https://api.example",
                "paper.pdf".to_string(),
                std::path::Path::new("/tmp"),
            );

            assert_eq!(links.self_path, format!("{prefix}/job-contract"));
            assert_eq!(links.events_path, format!("{prefix}/job-contract/events"));
            assert_eq!(actions.open_job.path, format!("{prefix}/job-contract"));
            assert_eq!(
                actions.open_artifacts.path,
                format!("{prefix}/job-contract/artifacts")
            );
            assert_eq!(
                actions.download_pdf.path,
                format!("{prefix}/job-contract/pdf")
            );
            assert_eq!(actions.download_pdf.enabled, pdf_ready);
            assert!(!actions.open_markdown.enabled);
            assert_eq!(item.detail_path, format!("{prefix}/job-contract"));
        }
    }

    #[test]
    fn summarize_list_invocation_counts_stage_spec_and_unknown() {
        let items = vec![
            JobListItemView {
                job_id: "job-1".to_string(),
                display_name: "a.pdf".to_string(),
                workflow: WorkflowKind::Translate,
                status: JobStatusKind::Succeeded,
                trace_id: None,
                stage: Some("done".to_string()),
                invocation: Some(InvocationSummaryView {
                    stage: "translate".to_string(),
                    input_protocol: "stage_spec".to_string(),
                    stage_spec_schema_version: "translate.stage.v1".to_string(),
                }),
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                detail_path: "/api/v1/jobs/job-1".to_string(),
                detail_url: "https://api.example/api/v1/jobs/job-1".to_string(),
            },
            JobListItemView {
                job_id: "job-2".to_string(),
                display_name: "b.pdf".to_string(),
                workflow: WorkflowKind::Mineru,
                status: JobStatusKind::Queued,
                trace_id: None,
                stage: None,
                invocation: None,
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                detail_path: "/api/v1/jobs/job-2".to_string(),
                detail_url: "https://api.example/api/v1/jobs/job-2".to_string(),
            },
        ];

        let summary = summarize_list_invocation(&items);

        assert_eq!(summary.stage_spec_count, 1);
        assert_eq!(summary.unknown_count, 1);
    }

    #[test]
    fn artifact_manifest_maps_canonical_resource_paths() {
        let job = build_job("job-artifacts", WorkflowKind::Translate);
        let manifest = build_artifact_manifest(
            &job,
            "https://api.example",
            &[
                artifact_record("job-artifacts", ARTIFACT_KEY_TRANSLATED_PDF),
                artifact_record("job-artifacts", ARTIFACT_KEY_MARKDOWN_RAW),
                artifact_record("job-artifacts", ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON),
            ],
        );

        let translated_pdf = manifest
            .items
            .iter()
            .find(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATED_PDF)
            .expect("translated pdf item");
        assert_eq!(
            translated_pdf.resource_path.as_deref(),
            Some("/api/v1/jobs/job-artifacts/pdf")
        );
        assert_eq!(
            translated_pdf.resource_url.as_deref(),
            Some("https://api.example/api/v1/jobs/job-artifacts/pdf")
        );

        let markdown_raw = manifest
            .items
            .iter()
            .find(|item| item.artifact_key == ARTIFACT_KEY_MARKDOWN_RAW)
            .expect("markdown raw item");
        assert_eq!(
            markdown_raw.resource_path.as_deref(),
            Some("/api/v1/jobs/job-artifacts/markdown?raw=true")
        );

        let translation_manifest = manifest
            .items
            .iter()
            .find(|item| item.artifact_key == ARTIFACT_KEY_TRANSLATION_MANIFEST_JSON)
            .expect("translation manifest item");
        assert_eq!(
            translation_manifest.resource_path.as_deref(),
            Some("/api/v1/jobs/job-artifacts/artifacts/translation_manifest_json")
        );
    }

    #[test]
    fn ocr_artifact_manifest_uses_ocr_route_family() {
        let job = build_job("ocr-artifacts", WorkflowKind::Ocr);
        let manifest = build_artifact_manifest(
            &job,
            "https://api.example",
            &[artifact_record(
                "ocr-artifacts",
                ARTIFACT_KEY_NORMALIZED_DOCUMENT_JSON,
            )],
        );

        let document = manifest.items.first().expect("normalized document item");
        assert_eq!(
            document.resource_path.as_deref(),
            Some("/api/v1/ocr/jobs/ocr-artifacts/normalized-document")
        );
    }

    #[test]
    fn job_detail_view_exposes_runtime_and_failure_contract() {
        let mut job = build_job("job-failure", WorkflowKind::Render);
        job.status = JobStatusKind::Failed;
        job.stage = Some("rendering".to_string());
        job.stage_detail = Some("render failed".to_string());
        job.error = Some("TypstCompileError".to_string());
        job.updated_at = "2026-04-11T00:00:10Z".to_string();
        job.replace_failure_info(Some(JobFailureInfo {
            stage: "rendering".to_string(),
            category: "render_failure".to_string(),
            code: Some("typst_compile_error".to_string()),
            summary: "渲染阶段失败".to_string(),
            root_cause: Some("Typst syntax error".to_string()),
            retryable: false,
            upstream_host: None,
            provider: None,
            suggestion: Some("检查渲染输入".to_string()),
            last_log_line: Some("compile error".to_string()),
            raw_error_excerpt: Some("compile error".to_string()),
            raw_diagnostic: None,
            ai_diagnostic: None,
        }));
        job.sync_runtime_state();

        let detail = job_to_detail(
            &job,
            "https://api.example",
            std::path::Path::new("/tmp"),
            false,
            false,
            false,
        );

        assert_eq!(detail.status, JobStatusKind::Failed);
        assert_eq!(detail.workflow, WorkflowKind::Render);
        assert_eq!(
            detail.failure.as_ref().map(|item| item.category.as_str()),
            Some("render_failure")
        );
        assert_eq!(
            detail
                .failure_diagnostic
                .as_ref()
                .map(|item| item.failed_stage.as_str()),
            Some("rendering")
        );
        assert_eq!(
            detail
                .failure_diagnostic
                .as_ref()
                .map(|item| item.error_kind.as_str()),
            Some("render_failure")
        );
        assert_eq!(detail.error.as_deref(), Some("TypstCompileError"));
        assert_eq!(
            detail
                .runtime
                .as_ref()
                .and_then(|runtime| runtime.terminal_reason.as_deref()),
            Some("failed")
        );
        assert_eq!(detail.actions.cancel.enabled, false);
        assert_eq!(detail.artifacts.pdf.ready, false);
    }

    #[test]
    fn job_detail_view_loads_glossary_summary_from_translation_manifest() {
        let temp = std::env::temp_dir().join(format!("view-glossary-{}", fastrand::u64(..)));
        let data_root = temp.join("data");
        let translations_dir = data_root.join("jobs/job-glossary/translated");
        fs::create_dir_all(&translations_dir).expect("create translations dir");
        fs::write(
            translations_dir.join("translation-manifest.json"),
            r#"{
              "schema": "translation_manifest_v1",
              "schema_version": 1,
              "pages": [],
              "glossary": {
                "enabled": true,
                "glossary_id": "glossary-123",
                "glossary_name": "materials",
                "entry_count": 2,
                "resource_entry_count": 1,
                "inline_entry_count": 1,
                "overridden_entry_count": 1,
                "source_hit_entry_count": 2,
                "target_hit_entry_count": 1,
                "unused_entry_count": 0,
                "unapplied_source_hit_entry_count": 1
              }
            }"#,
        )
        .expect("write manifest");

        let mut job = build_job("job-glossary", WorkflowKind::Translate);
        job.artifacts = Some(crate::models::JobArtifacts {
            translations_dir: Some("jobs/job-glossary/translated".to_string()),
            ..Default::default()
        });

        let detail = job_to_detail(&job, "https://api.example", &data_root, false, false, false);

        assert_eq!(
            detail
                .glossary_summary
                .as_ref()
                .map(|item| item.glossary_id.as_str()),
            Some("glossary-123")
        );
        assert_eq!(
            detail
                .glossary_summary
                .as_ref()
                .map(|item| item.target_hit_entry_count),
            Some(1)
        );
    }

    #[test]
    fn job_detail_view_loads_invocation_from_translation_manifest() {
        let temp = std::env::temp_dir().join(format!("view-invocation-{}", fastrand::u64(..)));
        let data_root = temp.join("data");
        let translations_dir = data_root.join("jobs/job-invocation/translated");
        fs::create_dir_all(&translations_dir).expect("create translations dir");
        fs::write(
            translations_dir.join("translation-manifest.json"),
            r#"{
              "schema": "translation_manifest_v1",
              "schema_version": 1,
              "pages": [],
              "invocation": {
                "stage": "translate",
                "input_protocol": "stage_spec",
                "stage_spec_schema_version": "translate.stage.v1"
              }
            }"#,
        )
        .expect("write manifest");

        let mut job = build_job("job-invocation", WorkflowKind::Translate);
        job.artifacts = Some(crate::models::JobArtifacts {
            translations_dir: Some("jobs/job-invocation/translated".to_string()),
            ..Default::default()
        });

        let detail = job_to_detail(&job, "https://api.example", &data_root, false, false, false);

        assert_eq!(
            detail.invocation.as_ref().map(|item| item.stage.as_str()),
            Some("translate")
        );
        assert_eq!(
            detail
                .invocation
                .as_ref()
                .map(|item| item.input_protocol.as_str()),
            Some("stage_spec")
        );
        assert_eq!(
            detail
                .invocation
                .as_ref()
                .map(|item| item.stage_spec_schema_version.as_str()),
            Some("translate.stage.v1")
        );
    }

    #[test]
    fn job_detail_view_loads_invocation_from_pipeline_summary_fallback() {
        let temp =
            std::env::temp_dir().join(format!("view-invocation-summary-{}", fastrand::u64(..)));
        let data_root = temp.join("data");
        let artifacts_dir = data_root.join("jobs/job-invocation-summary/artifacts");
        fs::create_dir_all(&artifacts_dir).expect("create artifacts dir");
        fs::write(
            artifacts_dir.join("pipeline_summary.json"),
            r#"{
              "invocation": {
                "stage": "render",
                "input_protocol": "stage_spec",
                "stage_spec_schema_version": "render.stage.v1"
              }
            }"#,
        )
        .expect("write summary");

        let mut job = build_job("job-invocation-summary", WorkflowKind::Render);
        job.artifacts = Some(crate::models::JobArtifacts {
            summary: Some(
                "jobs/job-invocation-summary/artifacts/pipeline_summary.json".to_string(),
            ),
            ..Default::default()
        });

        let detail = job_to_detail(&job, "https://api.example", &data_root, false, false, false);

        assert_eq!(
            detail.invocation.as_ref().map(|item| item.stage.as_str()),
            Some("render")
        );
        assert_eq!(
            detail
                .invocation
                .as_ref()
                .map(|item| item.input_protocol.as_str()),
            Some("stage_spec")
        );
        assert_eq!(
            detail
                .invocation
                .as_ref()
                .map(|item| item.stage_spec_schema_version.as_str()),
            Some("render.stage.v1")
        );
    }
}
