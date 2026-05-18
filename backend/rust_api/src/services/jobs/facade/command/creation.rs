use crate::error::AppError;
use crate::models::{CreateJobInput, JobStatusKind, JobSubmissionView, WorkflowKind};

use super::super::super::creation::context::BundleBuildDeps;
use super::super::super::creation::{
    create_ocr_job_from_upload, create_translation_bundle_job, create_translation_job,
    UploadedPdfInput,
};
use super::super::JobsFacade;

impl<'a> JobsFacade<'a> {
    pub fn create_submission(
        &self,
        base_url: &str,
        request: &CreateJobInput,
    ) -> Result<JobSubmissionView, AppError> {
        let workflow = request.workflow.clone();
        let job = create_translation_job(&self.command.submit, request)?;
        Ok(self.build_submission_view(base_url, &job, JobStatusKind::Queued, workflow))
    }

    pub async fn create_ocr_submission(
        &self,
        base_url: &str,
        request: &CreateJobInput,
        upload: Option<(String, Vec<u8>, bool)>,
    ) -> Result<JobSubmissionView, AppError> {
        let upload = upload.map(|(filename, bytes, developer_mode)| UploadedPdfInput {
            filename,
            bytes,
            developer_mode,
        });
        let job = create_ocr_job_from_upload(&self.command.submit, request, upload).await?;
        Ok(self.build_submission_view(base_url, &job, JobStatusKind::Queued, WorkflowKind::Ocr))
    }

    pub async fn create_translation_bundle_submission(
        &self,
        base_url: &str,
        request: CreateJobInput,
        filename: String,
        bytes: Vec<u8>,
        developer_mode: bool,
    ) -> Result<JobSubmissionView, AppError> {
        let workflow = request.workflow.clone();
        let job = create_translation_bundle_job(
            &BundleBuildDeps {
                submit: self.command.submit.clone(),
            },
            request,
            UploadedPdfInput {
                filename,
                bytes,
                developer_mode,
            },
        )
        .await?;
        Ok(self.build_submission_view(base_url, &job, JobStatusKind::Queued, workflow))
    }
}
