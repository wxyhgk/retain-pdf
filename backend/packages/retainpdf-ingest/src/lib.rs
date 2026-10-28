//! 入口：上传。建任务的 `submit_job` 还在 rust_api 的 `services/jobs/lifecycle/creation/`：它要用任务领域的依赖、
//! 调度和视图，现在挪进来会成环，等拆任务时再定（见 docs/ops/planning/api-reorg/20261016-入口拆包实现记录.md）。

#[cfg(any(test, feature = "test-fixtures"))]
mod test_fixtures;
mod uploads;

// 门面：领域外只能用这里导出的东西，子模块都是私有的（见 BOUNDARIES.md「Domain Facades」）。
pub use uploads::{
    IncomingFile, IncomingUpload, UploadError, UploadedPdfInput, UploadService, UploadServiceConfig,
};
pub use uploads::api::{
    begin_upload, ensure_upload_disk_space, store_incoming_upload_view, store_upload,
    store_upload_view, UploadApiDeps,
};
pub use uploads::view::{upload_to_response, UploadView};
// 只给测试用的：rust_api 的测试经 `test-fixtures` 特性用它，生产构建里没有。
#[cfg(any(test, feature = "test-fixtures"))]
pub use test_fixtures::build_test_pdf_bytes;

use retainpdf_api_base::error::AppError;

// 上传只返回自己的 UploadError（uploads/ 里不碰 HTTP），转成对外的 HTTP 错误在领域门面这里做。
impl From<UploadError> for AppError {
    fn from(value: UploadError) -> Self {
        match value {
            UploadError::BadRequest(message) => Self::bad_request(message),
            UploadError::PayloadTooLarge(message) => Self::payload_too_large(message),
            UploadError::Busy => {
                Self::service_unavailable("PDF processing capacity is busy; please retry")
            }
            UploadError::QueueTimeout => {
                Self::service_unavailable("PDF processing queue wait timed out")
            }
            UploadError::RepairUnavailable => {
                Self::service_unavailable("PDF repair tool unavailable")
            }
            UploadError::RepairTimeout => Self::service_unavailable("PDF repair timed out"),
            UploadError::InsufficientStorage(message) => Self::service_unavailable_because(
                retainpdf_api_base::disk_space::INSUFFICIENT_STORAGE,
                message,
            ),
            UploadError::RestoreInProgress => Self::conflict_because(
                retainpdf_data::db::backup::RestoreInProgress::REASON,
                "a database backup is being restored; try again in a moment",
            ),
            UploadError::Internal(message) => Self::internal(message),
            UploadError::Io(error) => Self::from(error),
        }
    }
}
