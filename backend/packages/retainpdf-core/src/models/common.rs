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

impl JobStatusKind {
    /// 库里存的写法（`jobs.status`，纯文本），和 serde 的取值一样。
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Canceled => "canceled",
        }
    }
}

impl WorkflowKind {
    /// 库里存的写法（`jobs.workflow`，纯文本），和 serde 的取值一样。
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Book => "book",
            Self::Ocr => "ocr",
            Self::Translate => "translate",
            Self::Render => "render",
        }
    }
}

impl Default for WorkflowKind {
    fn default() -> Self {
        Self::Book
    }
}

impl WorkflowKind {
    /// 任务链接（详情、事件、产物、取消……）的前缀。所有类型都走 `/api/v1/jobs`：
    /// 那些接口对 OCR 任务一样能用（取消按任务类型分支，不按路由）。`/api/v1/ocr/jobs/*`
    /// 镜像接口 2026-10-18 删了。
    pub fn job_api_prefix(&self) -> &'static str {
        "/api/v1/jobs"
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

pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

/// `now_iso()` 格式的时间戳距现在过去了几秒；解析不出来返回 None（调用方按「不知道」处理，别当成很久）。
pub fn seconds_since_iso(timestamp: &str) -> Option<i64> {
    let parsed = chrono::DateTime::parse_from_rfc3339(timestamp).ok()?;
    Some((Utc::now() - parsed.with_timezone(&Utc)).num_seconds())
}

/// book/translate 任务把 OCR 放在子任务里内联执行，子任务编号固定是 `{父任务}-ocr`。
/// 建子任务的 runner、找 OCR 派发记录的接口和恢复任务的种子都用这一个拼法。
pub fn ocr_child_job_id(parent_job_id: &str) -> String {
    format!("{parent_job_id}-ocr")
}

/// [`ocr_child_job_id`] 反过来：OCR 子任务的父任务编号；不是这种编号返回 None。数据库层写任务时用它填 `parent_job_id`。
pub fn ocr_parent_job_id(job_id: &str) -> Option<&str> {
    job_id.strip_suffix("-ocr").filter(|parent| !parent.is_empty())
}

pub fn build_job_id() -> String {
    let ts = Utc::now().format("%Y%m%d%H%M%S").to_string();
    let rand = format!("{:06x}", fastrand::u32(..=0xFFFFFF));
    format!("{ts}-{rand}")
}
