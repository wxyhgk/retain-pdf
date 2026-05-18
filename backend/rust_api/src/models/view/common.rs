use serde::{Deserialize, Serialize};

use crate::models::{JobStatusKind, WorkflowKind};

use super::super::defaults::{default_event_limit, default_limit};

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
