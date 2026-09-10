use crate::error::AppError;
use crate::services::jobs::downloads::{registered_artifact_download, FileDownload};

use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub async fn registered_artifact_download(
        &self,
        job_id: &str,
        artifact_key: &str,
        include_job_dir: bool,
        ocr_only: bool,
    ) -> Result<FileDownload, AppError> {
        let deps = self.query.owned();
        let job_id = job_id.to_owned();
        let artifact_key = artifact_key.to_owned();
        let key = format!("{job_id}:artifact:{artifact_key}:{include_job_dir}:{ocr_only}");
        self.query
            .download_generation
            .run(key, move || {
                let deps = deps.borrowed();
                let job = if ocr_only {
                    crate::services::jobs::query::load_ocr_job_with_supported_layout(
                        deps.db,
                        deps.data_root,
                        &job_id,
                    )?
                } else {
                    crate::services::jobs::query::load_supported_job(
                        deps.db,
                        deps.data_root,
                        &job_id,
                    )?
                };
                registered_artifact_download(&deps, &job, &artifact_key, include_job_dir)
            })
            .await
    }
}
