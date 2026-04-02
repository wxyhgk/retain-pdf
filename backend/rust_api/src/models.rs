use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::ocr_provider::{parse_provider_kind, OcrProviderDiagnostics};
use crate::storage_paths::{data_path_is_absolute, resolve_data_path};

pub const LOG_TAIL_LIMIT: usize = 40;

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn build_job_id() -> String {
    let ts = Utc::now().format("%Y%m%d%H%M%S").to_string();
    let rand = format!("{:06x}", fastrand::u32(..=0xFFFFFF));
    format!("{ts}-{rand}")
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: String,
    pub data: T,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            code: 0,
            message: "ok".to_string(),
            data,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatusKind {
    Queued,
    Running,
    Succeeded,
    Failed,
    Canceled,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowKind {
    Mineru,
    Ocr,
}

impl Default for WorkflowKind {
    fn default() -> Self {
        Self::Mineru
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UploadRecord {
    pub upload_id: String,
    pub filename: String,
    pub stored_path: String,
    pub bytes: u64,
    pub page_count: u32,
    pub uploaded_at: String,
    pub developer_mode: bool,
}

#[derive(Debug, Serialize)]
pub struct UploadResponseData {
    pub upload_id: String,
    pub filename: String,
    pub bytes: u64,
    pub page_count: u32,
    pub uploaded_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateJobRequest {
    #[serde(default)]
    pub workflow: WorkflowKind,
    pub upload_id: String,
    #[serde(default)]
    pub source_url: String,
    #[serde(default)]
    pub job_id: String,
    #[serde(default = "default_ocr_provider")]
    pub ocr_provider: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub skip_title_translation: bool,
    #[serde(default = "default_classify_batch_size")]
    pub classify_batch_size: i64,
    #[serde(default = "default_rule_profile_name")]
    pub rule_profile_name: String,
    #[serde(default)]
    pub custom_rules_text: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default = "default_render_mode")]
    pub render_mode: String,
    #[serde(default)]
    pub compile_workers: i64,
    #[serde(default = "default_typst_font_family")]
    pub typst_font_family: String,
    #[serde(default = "default_pdf_compress_dpi")]
    pub pdf_compress_dpi: i64,
    #[serde(default)]
    pub start_page: i64,
    #[serde(default = "default_end_page")]
    pub end_page: i64,
    #[serde(default = "default_batch_size")]
    pub batch_size: i64,
    #[serde(default)]
    pub workers: i64,
    #[serde(default)]
    pub translated_pdf_name: String,
    #[serde(default)]
    pub mineru_token: String,
    #[serde(default = "default_model_version")]
    pub model_version: String,
    #[serde(default)]
    pub paddle_token: String,
    #[serde(default)]
    pub paddle_api_url: String,
    #[serde(default = "default_paddle_model")]
    pub paddle_model: String,
    #[serde(default)]
    pub is_ocr: bool,
    #[serde(default)]
    pub disable_formula: bool,
    #[serde(default)]
    pub disable_table: bool,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub page_ranges: String,
    #[serde(default)]
    pub data_id: String,
    #[serde(default)]
    pub no_cache: bool,
    #[serde(default = "default_cache_tolerance")]
    pub cache_tolerance: i64,
    #[serde(default)]
    pub extra_formats: String,
    #[serde(default = "default_poll_interval")]
    pub poll_interval: i64,
    #[serde(default = "default_poll_timeout")]
    pub poll_timeout: i64,
    #[serde(default = "default_timeout_seconds")]
    pub timeout_seconds: i64,
    #[serde(default = "default_body_font_size_factor")]
    pub body_font_size_factor: f64,
    #[serde(default = "default_body_leading_factor")]
    pub body_leading_factor: f64,
    #[serde(default = "default_inner_bbox_shrink_x")]
    pub inner_bbox_shrink_x: f64,
    #[serde(default = "default_inner_bbox_shrink_y")]
    pub inner_bbox_shrink_y: f64,
    #[serde(default = "default_inner_bbox_dense_shrink_x")]
    pub inner_bbox_dense_shrink_x: f64,
    #[serde(default = "default_inner_bbox_dense_shrink_y")]
    pub inner_bbox_dense_shrink_y: f64,
}

impl CreateJobRequest {
    pub fn resolved_job_id(&self) -> String {
        if self.job_id.trim().is_empty() {
            build_job_id()
        } else {
            self.job_id.trim().to_string()
        }
    }

    pub fn resolved_workers(&self) -> i64 {
        if self.workers > 0 {
            return self.workers;
        }
        let model = self.model.to_lowercase();
        let base = self.base_url.to_lowercase();
        if model.contains("deepseek") || base.contains("deepseek.com") {
            100
        } else {
            4
        }
    }
}

impl Default for CreateJobRequest {
    fn default() -> Self {
        Self {
            workflow: WorkflowKind::default(),
            upload_id: String::new(),
            source_url: String::new(),
            job_id: String::new(),
            ocr_provider: default_ocr_provider(),
            mode: default_mode(),
            skip_title_translation: false,
            classify_batch_size: default_classify_batch_size(),
            rule_profile_name: default_rule_profile_name(),
            custom_rules_text: String::new(),
            api_key: String::new(),
            model: String::new(),
            base_url: String::new(),
            render_mode: default_render_mode(),
            compile_workers: 0,
            typst_font_family: default_typst_font_family(),
            pdf_compress_dpi: default_pdf_compress_dpi(),
            start_page: 0,
            end_page: default_end_page(),
            batch_size: default_batch_size(),
            workers: 0,
            translated_pdf_name: String::new(),
            mineru_token: String::new(),
            model_version: default_model_version(),
            paddle_token: String::new(),
            paddle_api_url: String::new(),
            paddle_model: default_paddle_model(),
            is_ocr: false,
            disable_formula: false,
            disable_table: false,
            language: default_language(),
            page_ranges: String::new(),
            data_id: String::new(),
            no_cache: false,
            cache_tolerance: default_cache_tolerance(),
            extra_formats: String::new(),
            poll_interval: default_poll_interval(),
            poll_timeout: default_poll_timeout(),
            timeout_seconds: default_timeout_seconds(),
            body_font_size_factor: default_body_font_size_factor(),
            body_leading_factor: default_body_leading_factor(),
            inner_bbox_shrink_x: default_inner_bbox_shrink_x(),
            inner_bbox_shrink_y: default_inner_bbox_shrink_y(),
            inner_bbox_dense_shrink_x: default_inner_bbox_dense_shrink_x(),
            inner_bbox_dense_shrink_y: default_inner_bbox_dense_shrink_y(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CreateJobResponseData {
    pub job_id: String,
    pub status: JobStatusKind,
    pub workflow: WorkflowKind,
    pub links: JobLinksData,
    pub actions: JobActionsData,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct JobArtifacts {
    pub ocr_job_id: Option<String>,
    pub ocr_status: Option<JobStatusKind>,
    pub ocr_trace_id: Option<String>,
    pub ocr_provider_trace_id: Option<String>,
    pub job_root: Option<String>,
    pub source_pdf: Option<String>,
    pub layout_json: Option<String>,
    pub normalized_document_json: Option<String>,
    pub normalization_report_json: Option<String>,
    pub provider_raw_dir: Option<String>,
    pub provider_zip: Option<String>,
    pub provider_summary_json: Option<String>,
    pub schema_version: Option<String>,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub translations_dir: Option<String>,
    pub output_pdf: Option<String>,
    pub summary: Option<String>,
    pub pages_processed: Option<i64>,
    pub translated_items: Option<i64>,
    pub translate_render_time_seconds: Option<f64>,
    pub save_time_seconds: Option<f64>,
    pub total_time_seconds: Option<f64>,
    pub ocr_provider_diagnostics: Option<OcrProviderDiagnostics>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProcessResult {
    pub success: bool,
    pub return_code: i32,
    pub duration_seconds: f64,
    pub command: Vec<String>,
    pub cwd: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredJob {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub upload_id: Option<String>,
    pub pid: Option<u32>,
    pub command: Vec<String>,
    pub request_payload: CreateJobRequest,
    pub error: Option<String>,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress_current: Option<i64>,
    pub progress_total: Option<i64>,
    pub log_tail: Vec<String>,
    pub result: Option<ProcessResult>,
    pub artifacts: Option<JobArtifacts>,
}

impl StoredJob {
    pub fn new(job_id: String, request_payload: CreateJobRequest, command: Vec<String>) -> Self {
        let now = now_iso();
        let provider_kind = parse_provider_kind(&request_payload.ocr_provider);
        Self {
            job_id,
            workflow: request_payload.workflow.clone(),
            status: JobStatusKind::Queued,
            created_at: now.clone(),
            updated_at: now,
            started_at: None,
            finished_at: None,
            upload_id: Some(request_payload.upload_id.clone()),
            pid: None,
            command,
            request_payload,
            error: None,
            stage: Some("queued".to_string()),
            stage_detail: Some("任务已创建，等待可用执行槽位".to_string()),
            progress_current: Some(0),
            progress_total: None,
            log_tail: Vec::new(),
            result: None,
            artifacts: Some(JobArtifacts {
                ocr_provider_diagnostics: Some(OcrProviderDiagnostics::new(provider_kind)),
                ..JobArtifacts::default()
            }),
        }
    }

    pub fn append_log(&mut self, line: &str) {
        let text = line.trim();
        if text.is_empty() {
            return;
        }
        self.log_tail.push(text.to_string());
        if self.log_tail.len() > LOG_TAIL_LIMIT {
            let drain = self.log_tail.len() - LOG_TAIL_LIMIT;
            self.log_tail.drain(0..drain);
        }
    }
}

#[derive(Debug, Serialize)]
pub struct JobProgressData {
    pub current: Option<i64>,
    pub total: Option<i64>,
    pub percent: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct JobTimestampsData {
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct JobLinksData {
    pub self_path: String,
    pub self_url: String,
    pub artifacts_path: String,
    pub artifacts_url: String,
    pub events_path: String,
    pub events_url: String,
    pub cancel_path: String,
    pub cancel_url: String,
}

#[derive(Debug, Serialize)]
pub struct ActionLinkData {
    pub enabled: bool,
    pub method: String,
    pub path: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct JobActionsData {
    pub open_job: ActionLinkData,
    pub open_artifacts: ActionLinkData,
    pub cancel: ActionLinkData,
    pub download_pdf: ActionLinkData,
    pub open_markdown: ActionLinkData,
    pub open_markdown_raw: ActionLinkData,
    pub download_bundle: ActionLinkData,
}

#[derive(Debug, Serialize)]
pub struct ResourceLinkData {
    pub ready: bool,
    pub path: String,
    pub url: String,
    pub method: String,
    pub content_type: String,
    pub file_name: Option<String>,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct MarkdownArtifactData {
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
pub struct ArtifactLinksData {
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
    pub actions: JobActionsData,
    pub normalized_document: ResourceLinkData,
    pub normalization_report: ResourceLinkData,
    pub pdf: ResourceLinkData,
    pub markdown: MarkdownArtifactData,
    pub bundle: ResourceLinkData,
}

#[derive(Debug, Serialize)]
pub struct JobDetailData {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressData,
    pub timestamps: JobTimestampsData,
    pub links: JobLinksData,
    pub actions: JobActionsData,
    pub artifacts: ArtifactLinksData,
    pub ocr_job: Option<OcrJobSummaryData>,
    pub ocr_provider_diagnostics: Option<OcrProviderDiagnostics>,
    pub error: Option<String>,
    pub failure_diagnostic: Option<JobFailureDiagnosticData>,
    pub normalization_summary: Option<NormalizationSummaryData>,
    pub log_tail: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct JobFailureDiagnosticData {
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
pub struct NormalizationSummaryData {
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

#[derive(Debug, Serialize)]
pub struct JobListItemData {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub trace_id: Option<String>,
    pub stage: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub detail_path: String,
    pub detail_url: String,
}

#[derive(Debug, Serialize)]
pub struct OcrJobSummaryData {
    pub job_id: String,
    pub status: Option<JobStatusKind>,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub detail_path: String,
    pub detail_url: String,
}

#[derive(Debug, Serialize)]
pub struct JobListResponseData {
    pub items: Vec<JobListItemData>,
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
pub struct JobEventListResponseData {
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

#[derive(Debug, Serialize)]
pub struct MarkdownResponseData {
    pub job_id: String,
    pub content: String,
    pub raw_path: String,
    pub raw_url: String,
    pub images_base_path: String,
    pub images_base_url: String,
}

pub fn build_job_links(job_id: &str, base_url: &str) -> JobLinksData {
    build_job_links_with_workflow(job_id, &WorkflowKind::Mineru, base_url)
}

fn job_path_prefix(workflow: &WorkflowKind) -> &'static str {
    match workflow {
        WorkflowKind::Ocr => "/api/v1/ocr/jobs",
        WorkflowKind::Mineru => "/api/v1/jobs",
    }
}

pub fn build_job_links_with_workflow(
    job_id: &str,
    workflow: &WorkflowKind,
    base_url: &str,
) -> JobLinksData {
    let prefix = job_path_prefix(workflow);
    let self_path = format!("{prefix}/{job_id}");
    let artifacts_path = format!("{prefix}/{job_id}/artifacts");
    let events_path = format!("{prefix}/{job_id}/events");
    let cancel_path = format!("{prefix}/{job_id}/cancel");
    JobLinksData {
        self_path: self_path.clone(),
        self_url: to_absolute_url(base_url, &self_path),
        artifacts_path: artifacts_path.clone(),
        artifacts_url: to_absolute_url(base_url, &artifacts_path),
        events_path: events_path.clone(),
        events_url: to_absolute_url(base_url, &events_path),
        cancel_path: cancel_path.clone(),
        cancel_url: to_absolute_url(base_url, &cancel_path),
    }
}

fn can_cancel(status: &JobStatusKind) -> bool {
    matches!(status, JobStatusKind::Queued | JobStatusKind::Running)
}

fn action_link(enabled: bool, method: &str, path: String, base_url: &str) -> ActionLinkData {
    ActionLinkData {
        enabled,
        method: method.to_string(),
        url: to_absolute_url(base_url, &path),
        path,
    }
}

pub fn build_job_actions(
    job: &StoredJob,
    base_url: &str,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobActionsData {
    let prefix = job_path_prefix(&job.workflow);
    let job_path = format!("{prefix}/{}", job.job_id);
    let artifacts_path = format!("{prefix}/{}/artifacts", job.job_id);
    let cancel_path = format!("{prefix}/{}/cancel", job.job_id);
    let pdf_path = format!("{prefix}/{}/pdf", job.job_id);
    let markdown_path = format!("{prefix}/{}/markdown", job.job_id);
    let markdown_raw_path = format!("{prefix}/{}/markdown?raw=true", job.job_id);
    let bundle_path = format!("{prefix}/{}/download", job.job_id);
    JobActionsData {
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
    job: &StoredJob,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> ArtifactLinksData {
    let prefix = job_path_prefix(&job.workflow);
    let pdf_path = format!("{prefix}/{}/pdf", job.job_id);
    let markdown_path = format!("{prefix}/{}/markdown", job.job_id);
    let markdown_raw_path = format!("{prefix}/{}/markdown?raw=true", job.job_id);
    let markdown_images_base_path = format!("{prefix}/{}/markdown/images/", job.job_id);
    let bundle_path = format!("{prefix}/{}/download", job.job_id);
    let normalized_document_path = format!("{prefix}/{}/normalized-document", job.job_id);
    let normalization_report_path = format!("{prefix}/{}/normalization-report", job.job_id);
    let pdf_file_path = resolve_output_pdf(job, data_root);
    let markdown_file_path = resolve_markdown_path(job, data_root);
    let normalized_document_file_path = resolve_normalized_document(job, data_root);
    let normalization_report_file_path = resolve_normalization_report(job, data_root);
    let bundle_file_name = format!("{}.zip", job.job_id);
    let actions = build_job_actions(job, base_url, pdf_ready, markdown_ready, bundle_ready);
    ArtifactLinksData {
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
        actions,
        normalized_document: ResourceLinkData {
            ready: normalized_document_file_path.is_some(),
            path: normalized_document_path.clone(),
            url: to_absolute_url(base_url, &normalized_document_path),
            method: "GET".to_string(),
            content_type: "application/json".to_string(),
            file_name: file_name_from_path(normalized_document_file_path.as_deref()),
            size_bytes: file_size(normalized_document_file_path.as_deref()),
        },
        normalization_report: ResourceLinkData {
            ready: normalization_report_file_path.is_some(),
            path: normalization_report_path.clone(),
            url: to_absolute_url(base_url, &normalization_report_path),
            method: "GET".to_string(),
            content_type: "application/json".to_string(),
            file_name: file_name_from_path(normalization_report_file_path.as_deref()),
            size_bytes: file_size(normalization_report_file_path.as_deref()),
        },
        pdf: ResourceLinkData {
            ready: pdf_ready,
            path: pdf_path.clone(),
            url: to_absolute_url(base_url, &pdf_path),
            method: "GET".to_string(),
            content_type: "application/pdf".to_string(),
            file_name: file_name_from_path(pdf_file_path.as_deref()),
            size_bytes: file_size(pdf_file_path.as_deref()),
        },
        markdown: MarkdownArtifactData {
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
        bundle: ResourceLinkData {
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

pub fn job_to_detail(
    job: &StoredJob,
    base_url: &str,
    data_root: &Path,
    pdf_ready: bool,
    markdown_ready: bool,
    bundle_ready: bool,
) -> JobDetailData {
    let duration_seconds = match (&job.started_at, &job.finished_at, &job.result) {
        (_, _, Some(result)) => Some(result.duration_seconds),
        _ => None,
    };
    let percent = match (job.progress_current, job.progress_total) {
        (Some(current), Some(total)) if total > 0 => Some((current as f64 / total as f64) * 100.0),
        _ => None,
    };
    JobDetailData {
        job_id: job.job_id.clone(),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
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
        progress: JobProgressData {
            current: job.progress_current,
            total: job.progress_total,
            percent,
        },
        timestamps: JobTimestampsData {
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
        error: job.error.clone(),
        failure_diagnostic: infer_job_failure_diagnostic(job),
        normalization_summary: load_normalization_summary(job, data_root),
        log_tail: job.log_tail.clone(),
    }
}

pub fn job_to_list_item(job: &StoredJob, base_url: &str) -> JobListItemData {
    let detail_path = format!("{}/{}", job_path_prefix(&job.workflow), job.job_id);
    JobListItemData {
        job_id: job.job_id.clone(),
        workflow: job.workflow.clone(),
        status: job.status.clone(),
        trace_id: job
            .artifacts
            .as_ref()
            .and_then(|item| item.trace_id.clone()),
        stage: job.stage.clone(),
        created_at: job.created_at.clone(),
        updated_at: job.updated_at.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
        detail_path,
    }
}

fn build_ocr_job_summary(job: &StoredJob, base_url: &str) -> Option<OcrJobSummaryData> {
    let artifacts = job.artifacts.as_ref()?;
    let ocr_job_id = artifacts.ocr_job_id.as_ref()?;
    let detail_path = format!("/api/v1/ocr/jobs/{ocr_job_id}");
    Some(OcrJobSummaryData {
        job_id: ocr_job_id.clone(),
        status: artifacts.ocr_status.clone(),
        trace_id: artifacts.ocr_trace_id.clone(),
        provider_trace_id: artifacts.ocr_provider_trace_id.clone(),
        detail_path: detail_path.clone(),
        detail_url: to_absolute_url(base_url, &detail_path),
    })
}

pub fn upload_to_response(upload: &UploadRecord) -> UploadResponseData {
    UploadResponseData {
        upload_id: upload.upload_id.clone(),
        filename: upload.filename.clone(),
        bytes: upload.bytes,
        page_count: upload.page_count,
        uploaded_at: upload.uploaded_at.clone(),
    }
}

const LEGACY_LAYOUT_DIR_NAMES: [&str; 4] = ["originPDF", "jsonPDF", "transPDF", "typstPDF"];
pub const LEGACY_JOB_UNSUPPORTED_MESSAGE: &str =
    "job uses legacy output layout/path storage and is no longer supported; rerun required";

pub fn job_uses_legacy_output_layout(job: &StoredJob, data_root: &Path) -> bool {
    let Some(job_root) = job
        .artifacts
        .as_ref()
        .and_then(|artifacts| artifacts.job_root.as_ref())
    else {
        return false;
    };
    let Ok(root) = resolve_data_path(data_root, job_root) else {
        return false;
    };
    LEGACY_LAYOUT_DIR_NAMES
        .iter()
        .any(|name| root.join(name).exists())
}

pub fn job_uses_legacy_path_storage(job: &StoredJob) -> bool {
    let Some(artifacts) = job.artifacts.as_ref() else {
        return false;
    };
    let top_level_paths = [
        artifacts.job_root.as_deref(),
        artifacts.source_pdf.as_deref(),
        artifacts.layout_json.as_deref(),
        artifacts.normalized_document_json.as_deref(),
        artifacts.normalization_report_json.as_deref(),
        artifacts.provider_raw_dir.as_deref(),
        artifacts.provider_zip.as_deref(),
        artifacts.provider_summary_json.as_deref(),
        artifacts.translations_dir.as_deref(),
        artifacts.output_pdf.as_deref(),
        artifacts.summary.as_deref(),
    ];
    if top_level_paths
        .into_iter()
        .flatten()
        .any(data_path_is_absolute)
    {
        return true;
    }
    artifacts
        .ocr_provider_diagnostics
        .as_ref()
        .map(|diagnostics| {
            [
                diagnostics.artifacts.provider_result_json.as_deref(),
                diagnostics.artifacts.provider_bundle_zip.as_deref(),
                diagnostics.artifacts.layout_json.as_deref(),
                diagnostics.artifacts.normalized_document_json.as_deref(),
                diagnostics.artifacts.normalization_report_json.as_deref(),
            ]
            .into_iter()
            .flatten()
            .any(data_path_is_absolute)
        })
        .unwrap_or(false)
}

pub fn resolve_markdown_path(job: &StoredJob, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join("ocr")
            .join("unpacked")
            .join("full.md"),
    )
}

pub fn resolve_markdown_images_dir(job: &StoredJob, data_root: &Path) -> Option<PathBuf> {
    let job_root = job.artifacts.as_ref()?.job_root.as_ref()?;
    Some(
        resolve_data_path(data_root, job_root)
            .ok()?
            .join("ocr")
            .join("unpacked")
            .join("images"),
    )
}

pub fn resolve_output_pdf(job: &StoredJob, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.output_pdf.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_normalized_document(job: &StoredJob, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.normalized_document_json.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn resolve_normalization_report(job: &StoredJob, data_root: &Path) -> Option<PathBuf> {
    let path = job.artifacts.as_ref()?.normalization_report_json.as_ref()?;
    resolve_data_path(data_root, path).ok()
}

pub fn load_normalization_summary(
    job: &StoredJob,
    data_root: &Path,
) -> Option<NormalizationSummaryData> {
    let path = resolve_normalization_report(job, data_root)?;
    let payload: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let normalization = payload.get("normalization").unwrap_or(&payload);
    let compat = normalization.get("compat");
    let validation = normalization.get("validation");
    Some(NormalizationSummaryData {
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
        pages_seen: compat
            .and_then(|v| v.get("pages_seen"))
            .and_then(Value::as_i64),
        blocks_seen: compat
            .and_then(|v| v.get("blocks_seen"))
            .and_then(Value::as_i64),
        document_defaults: compat
            .and_then(|v| v.get("document_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        page_defaults: compat
            .and_then(|v| v.get("page_defaults"))
            .and_then(Value::as_object)
            .map(|m| m.len())
            .unwrap_or(0),
        block_defaults: compat
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

fn infer_job_failure_diagnostic(job: &StoredJob) -> Option<JobFailureDiagnosticData> {
    if !matches!(job.status, JobStatusKind::Failed) {
        return None;
    }

    let error = job.error.as_deref().unwrap_or("").trim();
    let last_log_line = job
        .log_tail
        .iter()
        .rev()
        .find(|line| !line.trim().is_empty())
        .cloned();
    let haystack = if error.is_empty() {
        job.log_tail.join("\n")
    } else {
        format!("{error}\n{}", job.log_tail.join("\n"))
    };
    let failed_stage = infer_failed_stage(job, &haystack);

    if haystack.contains("Failed to resolve")
        || haystack.contains("NameResolutionError")
        || haystack.contains("Temporary failure in name resolution")
        || haystack.contains("socket.gaierror")
    {
        return Some(JobFailureDiagnosticData {
            failed_stage,
            error_kind: "dns_resolution_failed".to_string(),
            summary: "外部模型服务域名解析失败".to_string(),
            root_cause: Some(
                "容器在当前时刻无法解析上游模型服务域名，任务在翻译阶段中断".to_string(),
            ),
            retryable: true,
            upstream_host: extract_upstream_host(&haystack),
            suggestion: Some(
                "优先重试一次；若持续失败，请检查 Docker DNS、宿主机网络或代理配置".to_string(),
            ),
            last_log_line,
        });
    }

    if haystack.contains("ReadTimeout")
        || haystack.contains("ConnectTimeout")
        || haystack.contains("timed out")
        || haystack.contains("timeout=")
    {
        return Some(JobFailureDiagnosticData {
            failed_stage,
            error_kind: "upstream_timeout".to_string(),
            summary: "外部服务请求超时".to_string(),
            root_cause: Some("任务调用 OCR 或模型服务时等待过久，超过超时阈值".to_string()),
            retryable: true,
            upstream_host: extract_upstream_host(&haystack),
            suggestion: Some("可直接重试；若频繁发生，建议降低并发或检查网络稳定性".to_string()),
            last_log_line,
        });
    }

    if haystack.contains("401")
        || haystack.contains("403")
        || haystack.contains("missing or invalid X-API-Key")
        || haystack.contains("Unauthorized")
        || haystack.contains("permission denied")
    {
        return Some(JobFailureDiagnosticData {
            failed_stage,
            error_kind: "auth_failed".to_string(),
            summary: "鉴权失败".to_string(),
            root_cause: Some("当前任务使用的 API Key / Token 无效、过期或权限不足".to_string()),
            retryable: false,
            upstream_host: extract_upstream_host(&haystack),
            suggestion: Some("检查 MinerU Token、模型 API Key 或后端 X-API-Key 配置".to_string()),
            last_log_line,
        });
    }

    if haystack.contains("429")
        || haystack.contains("rate limit")
        || haystack.contains("Too Many Requests")
    {
        return Some(JobFailureDiagnosticData {
            failed_stage,
            error_kind: "rate_limited".to_string(),
            summary: "上游服务触发限流".to_string(),
            root_cause: Some("短时间内请求过多，上游服务拒绝继续处理".to_string()),
            retryable: true,
            upstream_host: extract_upstream_host(&haystack),
            suggestion: Some("等待一段时间后重试，或降低 workers / 并发配置".to_string()),
            last_log_line,
        });
    }

    if haystack.contains("typst") || haystack.contains("compile") || haystack.contains("render") {
        return Some(JobFailureDiagnosticData {
            failed_stage,
            error_kind: "render_failed".to_string(),
            summary: "排版或编译阶段失败".to_string(),
            root_cause: Some("翻译已部分完成，但在排版、渲染或 PDF 编译阶段中断".to_string()),
            retryable: false,
            upstream_host: None,
            suggestion: Some("检查 typst、字体、公式内容或中间产物目录是否完整".to_string()),
            last_log_line,
        });
    }

    Some(JobFailureDiagnosticData {
        failed_stage,
        error_kind: "unknown".to_string(),
        summary: "任务失败，但暂未识别出明确根因".to_string(),
        root_cause: if error.is_empty() {
            None
        } else {
            Some(error.lines().next().unwrap_or(error).to_string())
        },
        retryable: true,
        upstream_host: extract_upstream_host(&haystack),
        suggestion: Some("查看 log_tail 和完整错误日志进一步排查".to_string()),
        last_log_line,
    })
}

fn infer_failed_stage(job: &StoredJob, haystack: &str) -> String {
    let stage = job.stage.clone().unwrap_or_default();
    let stage_detail = job.stage_detail.clone().unwrap_or_default();
    let combined = format!("{stage}\n{stage_detail}\n{haystack}").to_lowercase();
    if combined.contains("translation") || stage_detail.contains("翻译") {
        return "translation".to_string();
    }
    if combined.contains("render") || combined.contains("compile") || stage_detail.contains("排版")
    {
        return "render".to_string();
    }
    if combined.contains("ocr") {
        return "ocr".to_string();
    }
    if stage.is_empty() {
        "unknown".to_string()
    } else {
        stage
    }
}

fn extract_upstream_host(haystack: &str) -> Option<String> {
    for marker in ["host='", "host=\"", "https://", "http://"] {
        if let Some(start) = haystack.find(marker) {
            let rest = &haystack[start + marker.len()..];
            let host: String = rest
                .chars()
                .take_while(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-'))
                .collect();
            if !host.is_empty() {
                return Some(host);
            }
        }
    }
    None
}

fn default_mode() -> String {
    "sci".to_string()
}
fn default_ocr_provider() -> String {
    "mineru".to_string()
}
fn default_classify_batch_size() -> i64 {
    12
}
fn default_rule_profile_name() -> String {
    "general_sci".to_string()
}
fn default_render_mode() -> String {
    "auto".to_string()
}
fn default_typst_font_family() -> String {
    "Source Han Serif SC".to_string()
}
fn default_pdf_compress_dpi() -> i64 {
    200
}
fn default_end_page() -> i64 {
    -1
}
fn default_batch_size() -> i64 {
    1
}
fn default_model_version() -> String {
    "vlm".to_string()
}
fn default_paddle_model() -> String {
    "PaddleOCR-VL".to_string()
}
fn default_language() -> String {
    "ch".to_string()
}
fn default_cache_tolerance() -> i64 {
    900
}
fn default_poll_interval() -> i64 {
    5
}
fn default_poll_timeout() -> i64 {
    1800
}
fn default_timeout_seconds() -> i64 {
    1800
}
fn default_body_font_size_factor() -> f64 {
    0.95
}
fn default_body_leading_factor() -> f64 {
    1.08
}
fn default_inner_bbox_shrink_x() -> f64 {
    0.035
}
fn default_inner_bbox_shrink_y() -> f64 {
    0.04
}
fn default_inner_bbox_dense_shrink_x() -> f64 {
    0.025
}
fn default_inner_bbox_dense_shrink_y() -> f64 {
    0.03
}
fn default_limit() -> u32 {
    20
}

fn default_event_limit() -> u32 {
    100
}
