use std::path::Path;

use crate::models::{
    JobArtifactRecord, JobSnapshot, JobStatusKind, UploadRecord, UploadView, WorkflowKind,
};
use crate::storage_paths::{
    resolve_markdown_path, resolve_normalization_report, resolve_normalized_document,
    resolve_output_pdf,
};

use super::super::common::{ActionLinkView, JobActionsView, JobLinksView};
#[cfg(test)]
use super::super::common::{JobProgressView, JobTimestampsView};
#[cfg(test)]
use super::super::test_support::{
    build_ocr_job_summary, job_failure_to_legacy_view, load_glossary_summary,
    load_invocation_summary, load_normalization_summary,
};
use super::super::to_absolute_url;
use super::types::*;
#[cfg(test)]
use crate::job_failure::classify_job_failure;
#[cfg(test)]
use crate::models::public_request_payload;
#[cfg(test)]
use crate::models::JobFailureInfo;

pub fn build_job_links(job_id: &str, base_url: &str) -> JobLinksView {
    build_job_links_with_workflow(job_id, &WorkflowKind::Book, base_url)
}

fn job_path_prefix(workflow: &WorkflowKind) -> &'static str {
    workflow.job_api_prefix()
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

fn can_rerun(job: &JobSnapshot) -> bool {
    if matches!(job.workflow, WorkflowKind::Ocr) {
        return false;
    }
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let has_source_pdf = artifacts
        .source_pdf
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let has_translations = artifacts
        .translations_dir
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    let has_normalized = artifacts
        .normalized_document_json
        .as_deref()
        .map(str::trim)
        .is_some_and(|value| !value.is_empty());
    has_source_pdf && (has_translations || has_normalized)
}

fn action_link(enabled: bool, method: &str, path: String, base_url: &str) -> ActionLinkView {
    ActionLinkView {
        enabled,
        method: method.to_string(),
        path: path.clone(),
        url: to_absolute_url(base_url, &path),
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
    let cancel_path = format!("{prefix}/{}/cancel", job.job_id);
    let rerun_path = format!("{prefix}/{}/rerun", job.job_id);
    let pdf_path = format!("{prefix}/{}/pdf", job.job_id);
    let markdown_path = format!("{prefix}/{}/markdown", job.job_id);
    let bundle_path = format!("{prefix}/{}/download", job.job_id);
    let self_path = format!("{prefix}/{}", job.job_id);
    let artifacts_path = format!("{prefix}/{}/artifacts", job.job_id);
    JobActionsView {
        open_job: action_link(true, "GET", self_path, base_url),
        open_artifacts: action_link(true, "GET", artifacts_path, base_url),
        cancel: action_link(can_cancel(&job.status), "POST", cancel_path, base_url),
        rerun: action_link(can_rerun(job), "POST", rerun_path, base_url),
        download_pdf: action_link(pdf_ready, "GET", pdf_path, base_url),
        open_markdown: action_link(markdown_ready, "GET", markdown_path.clone(), base_url),
        open_markdown_raw: action_link(
            markdown_ready,
            "GET",
            format!("{markdown_path}?raw=true"),
            base_url,
        ),
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
    let normalized_document_path = format!("{prefix}/{}/normalized-document", job.job_id);
    let normalization_report_path = format!("{prefix}/{}/normalization-report", job.job_id);
    let manifest_path = format!("{prefix}/{}/artifacts-manifest", job.job_id);
    let pdf_file_path = resolve_output_pdf(job, data_root);
    let markdown_file_path = resolve_markdown_path(job, data_root);

    ArtifactLinksView {
        pdf_ready,
        markdown_ready,
        bundle_ready,
        schema_version: job
            .artifacts
            .as_ref()
            .and_then(|a| a.schema_version.clone()),
        provider_raw_dir: job
            .artifacts
            .as_ref()
            .and_then(|a| a.provider_raw_dir.clone()),
        provider_zip: job.artifacts.as_ref().and_then(|a| a.provider_zip.clone()),
        provider_summary_json: job
            .artifacts
            .as_ref()
            .and_then(|a| a.provider_summary_json.clone()),
        pdf_url: to_absolute_url(base_url, &pdf_path),
        markdown_url: to_absolute_url(base_url, &markdown_path),
        markdown_images_base_url: to_absolute_url(base_url, &markdown_images_base_path),
        bundle_url: to_absolute_url(base_url, &bundle_path),
        normalized_document_url: to_absolute_url(base_url, &normalized_document_path),
        normalization_report_url: to_absolute_url(base_url, &normalization_report_path),
        manifest_path: manifest_path.clone(),
        manifest_url: to_absolute_url(base_url, &manifest_path),
        actions: build_job_actions(job, base_url, pdf_ready, markdown_ready, bundle_ready),
        normalized_document: ResourceLinkView {
            ready: resolve_normalized_document(job, data_root).is_some(),
            path: normalized_document_path.clone(),
            url: to_absolute_url(base_url, &normalized_document_path),
            method: "GET".to_string(),
            content_type: "application/json".to_string(),
            file_name: Some("document.v1.json".to_string()),
            size_bytes: file_size(resolve_normalized_document(job, data_root).as_deref()),
        },
        normalization_report: ResourceLinkView {
            ready: resolve_normalization_report(job, data_root).is_some(),
            path: normalization_report_path.clone(),
            url: to_absolute_url(base_url, &normalization_report_path),
            method: "GET".to_string(),
            content_type: "application/json".to_string(),
            file_name: Some("document.v1.report.json".to_string()),
            size_bytes: file_size(resolve_normalization_report(job, data_root).as_deref()),
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
            file_name: Some(format!("{}.zip", job.job_id)),
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
                resource_path: artifact_resource_path(job, &item.artifact_key),
                resource_url: artifact_resource_path(job, &item.artifact_key)
                    .map(|path| to_absolute_url(base_url, &path)),
            })
            .collect(),
    }
}

fn artifact_resource_path(job: &JobSnapshot, artifact_key: &str) -> Option<String> {
    let prefix = job.workflow.job_api_prefix();
    let job_prefix = format!("{prefix}/{}", job.job_id);
    match artifact_key {
        "source_pdf" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "translated_pdf" => Some(format!("{job_prefix}/pdf")),
        "typst_source" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "typst_render_pdf" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "markdown_raw" => Some(format!("{job_prefix}/markdown?raw=true")),
        "markdown_images_dir" => Some(format!("{job_prefix}/markdown/images/")),
        "markdown_bundle_zip" => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
        "normalized_document_json" => Some(format!("{job_prefix}/normalized-document")),
        "normalization_report_json" => Some(format!("{job_prefix}/normalization-report")),
        _ => Some(format!("{job_prefix}/artifacts/{artifact_key}")),
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
    let failure = job
        .failure
        .clone()
        .map(JobFailureInfo::with_formal_fields)
        .or_else(|| classify_job_failure(job).map(JobFailureInfo::with_formal_fields));
    JobDetailView {
        job_id: job.job_id.clone(),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        request_payload: public_request_payload(&job.request_payload),
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
        artifacts_display: Vec::new(),
        book_summary: BookSummaryView {
            title: job.job_id.clone(),
            authors: None,
            page_count: None,
            source_language: Some(job.request_payload.ocr.language.clone())
                .filter(|value| !value.trim().is_empty()),
            target_language: None,
            source_file_name: None,
            cover_url: None,
            file_size_bytes: None,
        },
        contracts: JobContractsView {
            schema_version: "job_stage_contracts.v1".to_string(),
            stages: Vec::new(),
        },
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
        stage_detail: job.stage_detail.clone(),
        progress: JobProgressView {
            current: job.progress_current,
            total: job.progress_total,
            percent: match (job.progress_current, job.progress_total) {
                (Some(current), Some(total)) if total > 0 => {
                    Some((current as f64 / total as f64) * 100.0)
                }
                _ => None,
            },
        },
        page_count: job
            .artifacts
            .as_ref()
            .and_then(|artifacts| artifacts.pages_processed),
        source_file_name: None,
        cover_url: None,
        thumbnail_url: None,
        output_pdf_ready: false,
        markdown_ready: false,
        bundle_ready: false,
        invocation: load_invocation_summary(job, data_root),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_path: detail_path.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
    }
}

pub fn summarize_list_invocation(items: &[JobListItemView]) -> JobListInvocationSummaryView {
    let stage_spec_count = items
        .iter()
        .filter(|item| {
            item.invocation
                .as_ref()
                .map(|value| value.input_protocol == "stage_spec")
                .unwrap_or(false)
        })
        .count();
    JobListInvocationSummaryView {
        stage_spec_count,
        unknown_count: items.len().saturating_sub(stage_spec_count),
    }
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

fn file_name_from_path(path: Option<&Path>) -> Option<String> {
    path.and_then(|value| {
        value
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
    })
}

fn file_size(path: Option<&Path>) -> Option<u64> {
    path.and_then(|value| std::fs::metadata(value).ok().map(|meta| meta.len()))
}
