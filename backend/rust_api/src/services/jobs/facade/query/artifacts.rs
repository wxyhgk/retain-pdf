use crate::error::AppError;
use crate::services::jobs::downloads::{registered_artifact_download, FileDownload};

use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn registered_artifact_download(
        &self,
        job_id: &str,
        artifact_key: &str,
        include_job_dir: bool,
        ocr_only: bool,
    ) -> Result<FileDownload, AppError> {
        let job = self.load_supported_job_snapshot(job_id, ocr_only)?;
        registered_artifact_download(&self.query, &job, artifact_key, include_job_dir)
    }
}
