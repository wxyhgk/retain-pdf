use crate::error::AppError;
use crate::models::api::{upload_to_response, UploadView};
use crate::models::domain::UploadRecord;
use super::{UploadService, UploadedPdfInput};

pub(crate) struct UploadApiDeps<'a> {
    uploads: &'a UploadService,
}

impl<'a> UploadApiDeps<'a> {
    pub(crate) fn new(uploads: &'a UploadService) -> Self {
        Self { uploads }
    }
}

pub(crate) async fn store_upload(
    deps: &UploadApiDeps<'_>,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    deps.uploads
        .store(UploadedPdfInput {
            filename,
            bytes,
            developer_mode,
        })
        .await
        .map_err(AppError::from)
}

pub(crate) async fn store_upload_view(
    deps: &UploadApiDeps<'_>,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadView, AppError> {
    let upload = store_upload(deps, filename, bytes, developer_mode).await?;
    Ok(upload_to_response(&upload))
}
