use serde::{Deserialize, Serialize};

use crate::models::{
    JobFailureInfo, JobRuntimeInfo, JobStatusKind, OcrProviderDiagnostics, PublicResolvedJobSpec,
    WorkflowKind,
};

use super::super::common::{JobActionsView, JobLinksView, JobProgressView, JobTimestampsView};

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

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderRegionBoxView {
    pub page: i64,
    pub bbox: Vec<f64>,
    pub unit: String,
    pub origin: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderRegionItemView {
    pub item_id: String,
    pub source: ReaderRegionBoxView,
    pub translated: ReaderRegionBoxView,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReaderRegionsView {
    pub items: Vec<ReaderRegionItemView>,
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
pub struct JobStageContractArtifactView {
    pub artifact_key: String,
    pub required: bool,
    pub ready: bool,
    pub relative_path: Option<String>,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobStageContractView {
    pub stage: String,
    pub ready: bool,
    pub artifacts: Vec<JobStageContractArtifactView>,
}

#[derive(Debug, Serialize)]
pub struct JobContractsView {
    pub schema_version: String,
    pub stages: Vec<JobStageContractView>,
}

#[derive(Debug, Serialize)]
pub struct JobDetailView {
    pub job_id: String,
    pub workflow: WorkflowKind,
    pub status: JobStatusKind,
    pub request_payload: PublicResolvedJobSpec,
    pub trace_id: Option<String>,
    pub provider_trace_id: Option<String>,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    pub timestamps: JobTimestampsView,
    pub links: JobLinksView,
    pub actions: JobActionsView,
    pub artifacts: ArtifactLinksView,
    pub artifacts_display: Vec<ArtifactDisplayItemView>,
    pub book_summary: BookSummaryView,
    pub contracts: JobContractsView,
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
pub struct BookSummaryView {
    pub title: String,
    pub authors: Option<String>,
    pub page_count: Option<i64>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub source_file_name: Option<String>,
    pub cover_url: Option<String>,
    pub file_size_bytes: Option<u64>,
}

impl BookSummaryView {
    pub fn with_cover_url(mut self, cover_url: Option<String>) -> Self {
        self.cover_url = cover_url;
        self
    }
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
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    pub page_count: Option<i64>,
    pub source_file_name: Option<String>,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub output_pdf_ready: bool,
    pub markdown_ready: bool,
    pub bundle_ready: bool,
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

#[derive(Debug, Serialize)]
pub struct LibraryBookListItemView {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub display_name: String,
    pub source_file_name: Option<String>,
    pub authors: Option<String>,
    pub page_count: Option<i64>,
    pub status: JobStatusKind,
    pub stage: Option<String>,
    pub stage_detail: Option<String>,
    pub progress: JobProgressView,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub output_pdf_ready: bool,
    pub markdown_ready: bool,
    pub bundle_ready: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct LibraryBookListView {
    pub items: Vec<LibraryBookListItemView>,
}

#[derive(Debug, Serialize)]
pub struct LibraryBookDetailView {
    pub id: String,
    pub job_id: String,
    pub title: String,
    pub authors: Option<String>,
    pub source_file_name: Option<String>,
    pub page_count: Option<i64>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub status: JobStatusKind,
    pub stage: Option<String>,
    pub progress: JobProgressView,
    pub cover_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub artifacts: Vec<ArtifactDisplayItemView>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryDeleteQuery {
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Deserialize)]
pub struct PagePreviewQuery {
    #[serde(default = "default_preview_kind")]
    pub kind: String,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub dpi: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct LibraryBatchDeleteInput {
    pub ids: Vec<String>,
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Serialize)]
pub struct LibraryDeleteResultView {
    pub deleted: bool,
    pub job_id: String,
    pub removed_paths: Vec<String>,
    pub removed_child_jobs: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LibraryBatchDeleteResultView {
    pub items: Vec<LibraryDeleteResultView>,
}

fn default_preview_kind() -> String {
    "translated".to_string()
}
