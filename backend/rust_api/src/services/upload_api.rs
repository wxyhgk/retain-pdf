use std::path::Path;

use crate::db::Db;
use crate::error::AppError;
use crate::models::{upload_to_response, UploadRecord, UploadView};
use crate::services::jobs::{store_pdf_upload, UploadedPdfInput};

pub async fn store_upload(
    db: &Db,
    uploads_dir: &Path,
    upload_max_bytes: u64,
    upload_max_pages: u32,
    python_bin: &str,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadRecord, AppError> {
    store_pdf_upload(
        db,
        uploads_dir,
        upload_max_bytes,
        upload_max_pages,
        python_bin,
        UploadedPdfInput {
            filename,
            bytes,
            developer_mode,
        },
    )
    .await
}

pub async fn store_upload_view(
    db: &Db,
    uploads_dir: &Path,
    upload_max_bytes: u64,
    upload_max_pages: u32,
    python_bin: &str,
    filename: String,
    bytes: Vec<u8>,
    developer_mode: bool,
) -> Result<UploadView, AppError> {
    let upload = store_upload(
        db,
        uploads_dir,
        upload_max_bytes,
        upload_max_pages,
        python_bin,
        filename,
        bytes,
        developer_mode,
    )
    .await?;
    Ok(upload_to_response(&upload))
}
