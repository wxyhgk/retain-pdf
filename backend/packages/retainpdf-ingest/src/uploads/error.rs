use thiserror::Error;

#[derive(Debug, Error)]
pub enum UploadError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    PayloadTooLarge(&'static str),
    #[error("PDF processing capacity is busy; please retry")]
    Busy,
    #[error("PDF processing queue wait timed out")]
    QueueTimeout,
    #[error("PDF repair tool unavailable")]
    RepairUnavailable,
    #[error("PDF repair timed out")]
    RepairTimeout,
    /// 数据目录所在磁盘剩余空间不够（见 `retainpdf_api_base::disk_space`）。
    #[error("{0}")]
    InsufficientStorage(String),
    /// 正在恢复备份（`Db::hold_off_restore`），这次上传不落库。
    #[error("a database backup is being restored; try again in a moment")]
    RestoreInProgress,
    #[error("{0}")]
    Internal(&'static str),
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

impl UploadError {
    pub(super) fn bad_request(message: impl Into<String>) -> Self {
        Self::BadRequest(message.into())
    }

    pub(super) fn payload_too_large(message: &'static str) -> Self {
        Self::PayloadTooLarge(message)
    }

    pub(super) fn internal(message: &'static str) -> Self {
        Self::Internal(message)
    }
}
