use serde::{Deserialize, Serialize};

use retainpdf_core::models::{JobStatusKind, WorkflowKind};
use retainpdf_files::JobActionsView;

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
    /// 同一次提交拆出来的其它任务（混合页码复用 OCR 时按连续段拆，见 api 的
    /// `library::translate_plan`）。上面的字段描述第一个任务。
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sibling_job_ids: Vec<String>,
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

#[derive(Debug, Deserialize, Clone)]
pub struct ListJobsQuery {
    /// false reads the persisted job summary only, without importing event
    /// history. Omitted/true preserves the complete live-stage projection.
    #[serde(default)]
    pub include_live_stage: Option<bool>,
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
    /// 只列这个账号的（多用户模式）。不从查询串读，由路由按当前用户填。
    #[serde(skip)]
    pub owner: Option<String>,
}

/// `DELETE /api/v1/jobs/:job_id` 的查询参数（书架删除的旧地址 `DELETE /library/books/:job_id` 2026-10-22 删了）。
#[derive(Debug, Deserialize, Clone, Default)]
pub struct DeleteJobQuery {
    /// 运行中的任务先取消再删；别的任务还在用它的产物也照删。
    #[serde(default)]
    pub force: bool,
}

/// 删一个任务的结果：任务本身 + 删掉的 `-ocr` 子任务。契约 `library-books.v1` 里叫 `LibraryDeleteResultView`（前端用这个名字）。
#[derive(Debug, Serialize)]
pub struct JobDeleteResultView {
    pub deleted: bool,
    pub job_id: String,
    pub removed_paths: Vec<String>,
    pub removed_child_jobs: Vec<String>,
}

/// Pagination for one document's complete OCR/translation task history.
/// Keep this deliberately narrower than `ListJobsQuery`: document scope is
/// supplied by the path and must not be overridable by list filters.
/// 只认 `limit`、`offset`，不认识的参数 400（2026-10-22 起）。
#[derive(Debug, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct ListDocumentJobsQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ListJobEventsStart {
    Head,
    Tail,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct ListJobEventsQuery {
    #[serde(default = "default_event_limit")]
    pub limit: u32,
    #[serde(default)]
    pub start: Option<ListJobEventsStart>,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
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

/// `/jobs/:id/files/…`、`/documents/:id/files/…` 的查询参数。
#[derive(Debug, Deserialize, Default)]
pub struct JobFilesQuery {
    /// `?download=1`：直接下载（`attachment`）。不带就在浏览器里打开（`inline`）。
    #[serde(default)]
    pub download: Option<String>,
    /// Word、预览图的清晰度。
    #[serde(default)]
    pub dpi: Option<u32>,
    /// 预览图宽度（像素）。
    #[serde(default)]
    pub width: Option<u32>,
    /// 译文 PDF、对照 PDF、Word 右下角的「logo + RetainPDF」水印（2026-11-20）：默认带，`?watermark=0` 取不带水印的。
    #[serde(default)]
    pub watermark: Option<String>,
}

impl JobFilesQuery {
    pub fn wants_download(&self) -> bool {
        matches!(self.download.as_deref().map(str::trim), Some("1" | "true"))
    }

    /// 默认带水印；`0` / `false` / `off` 不带。
    pub fn wants_watermark(&self) -> bool {
        !matches!(
            self.watermark.as_deref().map(|value| value.trim().to_ascii_lowercase()).as_deref(),
            Some("0" | "false" | "off")
        )
    }
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

fn default_limit() -> u32 {
    retainpdf_core::config::limits::DEFAULT_LIST_LIMIT
}

fn default_event_limit() -> u32 {
    500
}
