use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

pub const LOG_TAIL_LIMIT: usize = 40;

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
    Book,
    Ocr,
    Translate,
    Render,
}

impl Default for WorkflowKind {
    fn default() -> Self {
        Self::Book
    }
}

impl WorkflowKind {
    pub fn job_api_prefix(&self) -> &'static str {
        match self {
            Self::Ocr => "/api/v1/ocr/jobs",
            Self::Book | Self::Translate | Self::Render => "/api/v1/jobs",
        }
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
    /// sha256(文件字节),即 documents.document_id;空串表示旧记录未回填
    #[serde(default)]
    pub content_hash: String,
}

#[derive(Debug, Serialize)]
pub struct UploadView {
    pub upload_id: String,
    pub filename: String,
    pub bytes: u64,
    pub page_count: u32,
    pub uploaded_at: String,
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

pub fn build_job_id() -> String {
    let ts = Utc::now().format("%Y%m%d%H%M%S").to_string();
    let rand = format!("{:06x}", fastrand::u32(..=0xFFFFFF));
    format!("{ts}-{rand}")
}
