//! 文件：任务产出的文件——列出来、取一个（唯一的下载入口 `JobDownloads::open`）、是否就绪。

pub(crate) mod downloads;
mod queries;
mod readiness;
#[cfg(all(unix, any(test, feature = "test-fixtures")))]
pub(crate) mod test_scripts;

pub use downloads::{
    Disposition, FileDownload, FileGroup, JobDownloads, JobFile, JobFilesView,
    stored_path, StoredFile,
};
pub use readiness::job_readiness;
