use serde::{Deserialize, Serialize};

use crate::models::{JobStatusKind, WorkflowKind};

use super::super::defaults::{default_event_limit, default_limit};

#[derive(Debug, Serialize)]
pub struct JobSubmissionView {
    pub job_id: String,
    pub status: JobStatusKind,
    pub workflow: WorkflowKind,
    pub ocr_reused: bool,
    pub source_artifact_job_id: Option<String>,
    pub stages: JobStagesView,
    pub links: JobLinksView,
    pub actions: JobActionsView,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct JobProgressView {
    pub current: Option<i64>,
    pub total: Option<i64>,
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum JobStageStateView {
    Reused,
    Queued,
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct JobStageRuntimeView {
    pub state: JobStageStateView,
    pub progress: JobProgressView,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct JobStagesView {
    pub ocr: JobStageRuntimeView,
    pub translation: JobStageRuntimeView,
    pub render: JobStageRuntimeView,
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
    pub rerun: ActionLinkView,
    pub download_pdf: ActionLinkView,
    pub open_markdown: ActionLinkView,
    pub open_markdown_raw: ActionLinkView,
    pub download_bundle: ActionLinkView,
}

#[derive(Debug, Deserialize, Clone)]
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
    #[serde(default)]
    pub q: Option<String>,
    /// 逗号分隔的 job_id 白名单(可选)。分类文件夹展开时用它把
    /// `GET /api/v1/documents?collection_id=` 解出的 active_job_id 集合
    /// 转成图书馆卡片数据——不传时行为与现状完全一致。
    #[serde(default)]
    pub job_ids: Option<String>,
}

/// Pagination for one document's complete OCR/translation task history.
/// Keep this deliberately narrower than `ListJobsQuery`: document scope is
/// supplied by the path and must not be overridable by list filters.
#[derive(Debug, Deserialize, Clone)]
pub struct ListDocumentJobsQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ListGlossariesQuery {
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub source_lang: Option<String>,
    #[serde(default)]
    pub target_lang: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListJobEventsQuery {
    #[serde(default = "default_event_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct ListTranslationItemsQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub final_status: Option<String>,
    #[serde(default)]
    pub error_type: Option<String>,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
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

#[derive(Debug, Serialize)]
pub struct MarkdownImageView {
    pub path: String,
    pub url: String,
    pub content_type: String,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct MarkdownDocumentView {
    pub job_id: String,
    pub ready: bool,
    pub content: String,
    pub content_with_absolute_image_urls: String,
    pub markdown_path: String,
    pub markdown_url: String,
    pub raw_path: String,
    pub raw_url: String,
    pub images_base_path: String,
    pub images_base_url: String,
    pub images: Vec<MarkdownImageView>,
}
