//! 产物链接和操作链接：任务详情里的 `artifacts`（每个产物的地址、是否就绪、大小）和 `actions`
//! （打开、取消、重跑、下载……）。2026-10-18 从核心包挪过来，任务、书库都往下用这里。

use std::path::Path;

use retainpdf_core::models::api::to_absolute_url;
use retainpdf_core::models::domain::{JobSnapshot, JobStatusKind, WorkflowKind};
use retainpdf_core::storage_paths::{
    resolve_markdown_path, resolve_normalization_report, resolve_normalized_document,
    resolve_output_pdf,
};
use serde::Serialize;

use crate::links::{
    job_bundle_path, job_file_path, job_files_list_path, job_markdown_view_path,
    job_ocr_images_base_path, job_ocr_markdown_path, job_translated_pdf_path,
};

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
pub struct ArtifactDisplayItemView {
    pub key: String,
    pub label: String,
    pub ready: bool,
    pub kind: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
    pub download_url: Option<String>,
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
    /// 从断点续跑（`POST actions/resume`）。
    pub resume: ActionLinkView,
    /// 旧名，和 `resume` 完全同值（地址也是 `actions/resume`：旧地址 `actions/rerun` 2026-11-25 删了）。
    /// 前端 `domain/job/actions.ts` 还拿它当兜底判断，字段先留着。
    pub rerun: ActionLinkView,
    pub download_pdf: ActionLinkView,
    pub open_markdown: ActionLinkView,
    pub open_markdown_raw: ActionLinkView,
    pub download_bundle: ActionLinkView,
}

pub fn build_job_actions(
    job: &JobSnapshot,
    base_url: &str,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobActionsView {
    let prefix = job.workflow.job_api_prefix();
    let cancel_path = format!("{prefix}/{}/actions/cancel", job.job_id);
    let resume_path = format!("{prefix}/{}/actions/resume", job.job_id);
    let pdf_path = job_translated_pdf_path(&job.job_id);
    let markdown_path = job_markdown_view_path(&job.job_id);
    let markdown_raw_path = job_ocr_markdown_path(&job.job_id);
    let bundle_path = job_bundle_path(&job.job_id);
    let self_path = format!("{prefix}/{}", job.job_id);
    let artifacts_path = job_files_list_path(&job.job_id);
    JobActionsView {
        open_job: action_link(true, "GET", self_path, base_url),
        open_artifacts: action_link(true, "GET", artifacts_path, base_url),
        cancel: action_link(can_cancel(&job.status), "POST", cancel_path, base_url),
        resume: action_link(can_rerun(job), "POST", resume_path.clone(), base_url),
        rerun: action_link(can_rerun(job), "POST", resume_path, base_url),
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
    let pdf_path = job_translated_pdf_path(&job.job_id);
    let markdown_path = job_markdown_view_path(&job.job_id);
    let markdown_raw_path = job_ocr_markdown_path(&job.job_id);
    let markdown_images_base_path = job_ocr_images_base_path(&job.job_id);
    let bundle_path = job_bundle_path(&job.job_id);
    let normalized_document_path = job_file_path(&job.job_id, "internal/normalized-document.json");
    let normalization_report_path = job_file_path(&job.job_id, "internal/normalization-report.json");
    let manifest_path = job_files_list_path(&job.job_id);
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
